from __future__ import annotations

import json
import os
import socket
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import socketio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.routing import APIRouter
from fastapi.staticfiles import StaticFiles

from .counts import build_counts
from .event_store import get_all_events, get_events_since, save_event
from .models import FramePayload, VisionInferRequest, VisionInferResponse
from .mqtt_client import MqttBridge
from .presence_signal import get_presence_signal_state, update_presence_signal
from .report_service import export_daily_pdf, export_events_to_csv
from .risk import calculate_risk
from .stats_service import aggregate_stats
from .tracker import update_tracks
from .traffic_counter import get_traffic_report, register_tracks_for_report
from .vision_service import vision_service

ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT_DIR / "frontend"
DATA_DIR = ROOT_DIR / "data"
TMP_DIR = ROOT_DIR / ".tmp"

PORT = int(os.getenv("PORT", "4000"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")
USE_MQTT = str(os.getenv("USE_MQTT", "false")).lower() == "true"
MQTT_BROKER_URL = os.getenv("MQTT_BROKER_URL", "mqtt://localhost:1883")
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "yolo/crosswalk/cam-001")
LAN_IP = os.getenv("LAN_IP", "").strip()

SPECIAL_EVENTS = {"bus_transcaribe", "bicicleta", "senal_paso", "ambulancia", "gesto"}
MAP_BOUNDS = {
    "north": 10.4265,
    "south": 10.4203,
    "east": -75.5402,
    "west": -75.5498,
}

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI(title="Seguridad Vial Backend Python", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

latest_fence_update: dict[str, Any] | None = None
connected_devices: dict[str, dict[str, Any]] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _dedupe(items: list[str]) -> list[str]:
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def get_local_ips() -> list[str]:
    ips: list[str] = []
    if LAN_IP:
        ips.append(LAN_IP)

    try:
        hostname_ips = socket.gethostbyname_ex(socket.gethostname())[2]
        ips.extend([ip for ip in hostname_ips if not ip.startswith("127.")])
    except Exception:
        pass

    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        local_ip = probe.getsockname()[0]
        probe.close()
        if local_ip and not local_ip.startswith("127."):
            ips.append(local_ip)
    except Exception:
        pass

    return _dedupe(ips)


def get_public_tunnel_url() -> str | None:
    try:
        url_file = TMP_DIR / "public_url.txt"
        if url_file.exists():
            url = url_file.read_text(encoding="utf-8").strip()
            if url.startswith("https://"):
                return url

        cf_log = TMP_DIR / "cloudflared.err.log"
        if cf_log.exists():
            text = cf_log.read_text(encoding="utf-8", errors="ignore")
            for token in text.split():
                if token.startswith("https://") and "trycloudflare.com" in token:
                    return token.strip()
    except Exception:
        return None
    return None


def _safe_to_dt(iso_ts: str | None) -> datetime | None:
    if not iso_ts:
        return None
    try:
        return datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    except Exception:
        return None


def _to_latlng(point: dict[str, float], frame_size: dict[str, int]) -> dict[str, float]:
    width = max(1, int(frame_size.get("width", 1)))
    height = max(1, int(frame_size.get("height", 1)))
    nx = min(1.0, max(0.0, point["x"] / width))
    ny = min(1.0, max(0.0, point["y"] / height))

    lat = MAP_BOUNDS["north"] - (MAP_BOUNDS["north"] - MAP_BOUNDS["south"]) * ny
    lng = MAP_BOUNDS["west"] + (MAP_BOUNDS["east"] - MAP_BOUNDS["west"]) * nx
    return {"lat": lat, "lng": lng}


def build_metrics(event: dict | None) -> dict[str, Any]:
    if not event:
        return {"risk": "BAJO", "ttc": None, "pet": None, "vRel": 0}

    vehicle = event.get("vehicle") or {}
    pedestrian = event.get("pedestrian") or {}
    vv = vehicle.get("velocityPxPerSec") or {"x": 0, "y": 0}
    pv = pedestrian.get("velocityPxPerSec") or {"x": 0, "y": 0}
    vveh = (float(vv.get("x", 0)) ** 2 + float(vv.get("y", 0)) ** 2) ** 0.5
    vped = (float(pv.get("x", 0)) ** 2 + float(pv.get("y", 0)) ** 2) ** 0.5

    return {
        "risk": event.get("risk_level", "BAJO"),
        "ttc": event.get("ttc_seconds"),
        "pet": event.get("pet_seconds"),
        "vRel": abs(vveh - vped),
    }


def build_events_from_tracks(tracks: list[dict]) -> list[dict]:
    events = []
    for t in tracks:
        cls = t.get("className")
        if cls in SPECIAL_EVENTS:
            events.append(
                {
                    "type": cls,
                    "label": f"{cls} detectado",
                    "trackId": t.get("trackId"),
                    "at": now_iso(),
                }
            )
    return events


def build_objects_envelope(
    camera_id: str,
    timestamp: str,
    tracks: list[dict],
    metrics: dict[str, Any],
    frame_size: dict[str, int],
    events: list[dict],
) -> dict[str, Any]:
    objects = []
    for t in tracks:
        center = t.get("center") or {"x": 0, "y": 0}
        objects.append(
            {
                "id": t.get("trackId"),
                "classType": t.get("className"),
                "score": t.get("score", 0),
                "center": center,
                "latLng": _to_latlng(center, frame_size),
                "bbox": t.get("bbox"),
                "predicted": (t.get("predictedPath") or [{}])[0] if t.get("predictedPath") else None,
                "trail": t.get("trail", []),
            }
        )

    return {
        "schema": "vision-frame/v1",
        "cameraId": camera_id,
        "timestamp": timestamp,
        "state": {
            "risk": metrics["risk"],
            "ttc": metrics["ttc"],
            "pet": metrics["pet"],
            "vRel": metrics["vRel"],
        },
        "objects": objects,
        "events": events,
    }


async def emit_devices_update() -> None:
    await sio.emit(
        "devices_update",
        {"total": len(connected_devices), "devices": list(connected_devices.values())},
    )


async def process_frame_payload(payload: FramePayload, source: str, emit_snapshot: bool = True) -> tuple[dict, list[dict], dict | None]:
    update_presence_signal(payload)
    tracks = update_tracks(payload)
    event = calculate_risk(payload, tracks, source)
    register_tracks_for_report(payload.camera_id, tracks, payload.timestamp)
    counts = build_counts(tracks)

    snapshot = {
        "type": "realtime_snapshot",
        "camera_id": payload.camera_id,
        "timestamp": payload.timestamp,
        "gps": payload.gps.model_dump(),
        "counts": counts,
        "risk_event": event,
    }

    if event and event.get("risk_level") in {"ALTO", "CRITICO"}:
        save_event(event)

    if emit_snapshot:
        await sio.emit("snapshot", snapshot)

    return snapshot, tracks, event


def default_crosswalk_polygon(width: int, height: int) -> list[dict[str, float]]:
    return [
        {"x": width * 0.34, "y": height * 0.53},
        {"x": width * 0.66, "y": height * 0.53},
        {"x": width * 0.74, "y": height * 0.90},
        {"x": width * 0.26, "y": height * 0.90},
    ]


api = APIRouter(prefix="/api")


@api.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "seguridad-vial-python-backend"}


@api.post("/ingest")
async def ingest(payload: FramePayload) -> dict:
    snapshot, _, _ = await process_frame_payload(payload, "http", emit_snapshot=True)
    return {"ok": True, "snapshot": snapshot}


@api.post("/vision/infer", response_model=VisionInferResponse)
async def vision_infer(request: VisionInferRequest) -> VisionInferResponse:
    timestamp = request.timestamp or now_iso()
    frame_size = request.frame_size.model_dump() if request.frame_size else {"width": 1280, "height": 720}
    width = int(frame_size.get("width", 1280))
    height = int(frame_size.get("height", 720))

    crosswalk = (
        [p.model_dump() for p in request.crosswalk_polygon]
        if request.crosswalk_polygon
        else default_crosswalk_polygon(width, height)
    )

    try:
        image_bgr = vision_service.decode_data_url(request.image_base64)
    except Exception as ex:
        raise HTTPException(status_code=400, detail=str(ex)) from ex

    detections = vision_service.infer(image_bgr)

    frame_payload = FramePayload(
        camera_id=request.camera_id,
        timestamp=timestamp,
        gps=request.gps,
        frame_size={"width": width, "height": height},
        crosswalk_polygon=crosswalk,
        detections=detections,
    )

    snapshot, tracks, event = await process_frame_payload(frame_payload, "http", emit_snapshot=True)
    metrics = build_metrics(event)
    events = build_events_from_tracks(tracks)

    tracks_ui = [
        {
            "id": t["trackId"],
            "classType": t["className"],
            "score": t.get("score", 0),
            "bbox": t.get("bbox"),
            "center": t.get("center"),
            "predicted": (t.get("predictedPath") or [{}])[0] if t.get("predictedPath") else None,
            "trail": t.get("trail", []),
        }
        for t in tracks
    ]

    envelope = build_objects_envelope(request.camera_id, timestamp, tracks, metrics, frame_size, events)

    await sio.emit(
        "state_update",
        {
            "source": "backend",
            "timestamp": timestamp,
            "cameraId": request.camera_id,
            "risk": metrics["risk"],
            "ttc": metrics["ttc"],
            "pet": metrics["pet"],
            "vRel": metrics["vRel"],
            "objectCount": len(tracks_ui),
        },
    )
    await sio.emit("objects_update", envelope)

    return VisionInferResponse(
        ok=True,
        snapshot=snapshot,
        tracks=tracks_ui,
        metrics=metrics,
        envelope=envelope,
        events=events,
    )


@api.post("/simulate/offline")
async def simulate_offline() -> dict:
    sample_path = DATA_DIR / "sample-sensecraft-json.json"
    if not sample_path.exists():
        raise HTTPException(status_code=404, detail="No existe archivo de simulacion")

    raw = json.loads(sample_path.read_text(encoding="utf-8"))
    for item in raw:
        payload = FramePayload.model_validate(item)
        await process_frame_payload(payload, "mock", emit_snapshot=True)

    return {"ok": True, "message": "Simulacion offline ejecutada"}


@api.get("/events")
async def events() -> list[dict]:
    return get_all_events()


@api.get("/stats")
async def stats(period: str = "day") -> dict:
    hours = 1 if period == "hour" else 24 * 7 if period == "week" else 24
    events = get_events_since(hours)
    return {"period": period, **aggregate_stats(events)}


@api.get("/report/traffic")
async def report_traffic() -> dict:
    return get_traffic_report()


@api.get("/esp32/person-status")
async def person_status() -> dict:
    return get_presence_signal_state()


@api.get("/export/csv")
async def export_csv() -> FileResponse:
    file_path = export_events_to_csv(get_all_events())
    return FileResponse(file_path, filename=Path(file_path).name)


@api.get("/export/pdf")
async def export_pdf() -> FileResponse:
    file_path = export_daily_pdf(get_events_since(24))
    return FileResponse(file_path, filename=Path(file_path).name)


@api.get("/network-qr")
async def network_qr() -> dict:
    local_ips = get_local_ips()
    protocol = "https"
    public_url = get_public_tunnel_url()

    if public_url:
        public_url = public_url.rstrip("/")
        return {
            "primary": f"{public_url}/viewer.html?qr=1",
            "urls": [f"{public_url}/viewer.html?qr=1"],
            "hasSecure": True,
        }

    primary_ip = local_ips[0] if local_ips else "localhost"
    primary = f"{protocol}://{primary_ip}:{PORT}/viewer.html?qr=1"
    urls = [f"{protocol}://{ip}:{PORT}/viewer.html?qr=1" for ip in local_ips] or [primary]

    return {"primary": primary, "urls": urls, "hasSecure": True}


app.include_router(api)
app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")


@app.get("/esp32/light", response_class=HTMLResponse)
async def esp32_light() -> HTMLResponse:
    status = get_presence_signal_state()
    signal_state = status.get("state")
    if signal_state == "GREEN":
        bg_color = "#00b050"
        label = "PERSONA DETECTADA"
    elif signal_state == "RED":
        bg_color = "#d22222"
        label = "VEHICULO DETECTADO"
    else:
        bg_color = "#2f2f2f"
        label = "SIN DETECCION"

    html = f"""<!doctype html>
<html lang='es'>
<head>
  <meta charset='utf-8' />
  <meta name='viewport' content='width=device-width, initial-scale=1' />
  <meta http-equiv='refresh' content='1' />
  <title>ESP32 Luz de Estado</title>
  <style>
    html, body {{ width:100%; height:100%; margin:0; font-family:sans-serif; background:{bg_color}; color:#fff; }}
    .center {{ height:100%; display:grid; place-items:center; text-align:center; }}
    h1 {{ margin:0; font-size: clamp(22px, 7vw, 44px); letter-spacing: .06em; }}
    p {{ margin-top:10px; opacity:.9; }}
  </style>
</head>
<body>
    <main class='center'><div><h1>{label}</h1><p>Estado se actualiza cada 1 segundo ({signal_state or 'GRAY'})</p></div></main>
</body>
</html>"""
    return HTMLResponse(html)


@app.get("/viewer.html")
async def viewer_html() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "viewer.html")


@app.get("/")
async def root() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/{file_path:path}")
async def frontend_files(file_path: str):
    candidate = (FRONTEND_DIR / file_path).resolve()
    if candidate.exists() and candidate.is_file() and str(candidate).startswith(str(FRONTEND_DIR.resolve())):
        return FileResponse(candidate)
    return FileResponse(FRONTEND_DIR / "index.html")


@sio.event
async def connect(sid, environ):
    global latest_fence_update
    connected_devices[sid] = {
        "socketId": sid,
        "displayName": "Dispositivo",
        "kind": "unknown",
        "userAgent": environ.get("HTTP_USER_AGENT", "N/A"),
        "ip": environ.get("REMOTE_ADDR", "N/A"),
        "connectedAt": now_iso(),
    }
    await emit_devices_update()

    if latest_fence_update:
        expires_at = _safe_to_dt(latest_fence_update.get("expiresAt"))
        if expires_at and expires_at <= datetime.now(timezone.utc):
            latest_fence_update = None
        else:
            await sio.emit("fence_update", latest_fence_update, to=sid)


@sio.event
async def disconnect(sid):
    connected_devices.pop(sid, None)
    await emit_devices_update()


@sio.on("state_update")
async def state_update(sid, payload):
    envelope = {"source": sid, "timestamp": now_iso(), **(payload or {})}
    await sio.emit("state_update", envelope)


@sio.on("objects_update")
async def objects_update(sid, payload):
    envelope = {"source": sid, "timestamp": now_iso(), **(payload or {})}
    await sio.emit("objects_update", envelope)


@sio.on("device_hello")
async def device_hello(sid, payload):
    current = connected_devices.get(sid)
    if not current:
        return

    payload = payload or {}
    display_name = str(payload.get("displayName", current["displayName"])).strip()[:60] or current["displayName"]
    kind = payload.get("kind") if payload.get("kind") in {"dashboard", "viewer"} else "unknown"

    connected_devices[sid] = {**current, "displayName": display_name, "kind": kind}
    await emit_devices_update()


@sio.on("location_update")
async def location_update(sid, payload):
    current = connected_devices.get(sid)
    if not current:
        return
    gps = (payload or {}).get("gps") or {}
    lat = gps.get("lat")
    lng = gps.get("lng")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        connected_devices[sid] = {**current, "gps": {"lat": lat, "lng": lng}}
        await emit_devices_update()


@sio.on("fence_update")
async def fence_update(sid, payload):
    global latest_fence_update
    payload = payload or {}
    active = payload.get("active", True) is not False

    if not active:
        if latest_fence_update and latest_fence_update.get("triggeredBy") != sid:
            return
        latest_fence_update = {
            "active": False,
            "cameraId": payload.get("cameraId", "cam"),
            "source": "qr",
            "triggeredBy": sid,
            "triggeredAt": now_iso(),
            "expiresAt": None,
        }
        await sio.emit("fence_update", latest_fence_update)
        return

    gps = payload.get("gps") or {}
    lat = gps.get("lat")
    lng = gps.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return

    expires = payload.get("expiresAt")
    expires_dt = _safe_to_dt(expires)
    expires_iso = expires_dt.isoformat().replace("+00:00", "Z") if expires_dt else None

    latest_fence_update = {
        "active": True,
        "cameraId": payload.get("cameraId", "cam"),
        "gps": {"lat": lat, "lng": lng},
        "radiusMeters": 50,
        "triggeredAt": now_iso(),
        "expiresAt": expires_iso,
        "source": payload.get("source", "qr"),
        "triggeredBy": sid,
    }
    await sio.emit("fence_update", latest_fence_update)


def _mqtt_handler(raw_payload: dict, source: str) -> None:
    try:
        payload = FramePayload.model_validate(raw_payload)
    except Exception:
        return

    async def _run():
        await process_frame_payload(payload, source, emit_snapshot=True)

    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(_run(), loop)
    except Exception:
        return


mqtt_bridge = MqttBridge(MQTT_BROKER_URL, MQTT_TOPIC, USE_MQTT, _mqtt_handler)


@app.on_event("startup")
async def startup_event():
    mqtt_bridge.start()


def get_asgi_app():
    return socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="socket.io")
