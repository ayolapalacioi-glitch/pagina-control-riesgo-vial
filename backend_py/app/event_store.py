from __future__ import annotations

import json
import logging
import os
import queue
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
import requests

logger = logging.getLogger("event_store")

# Rutas de base de datos local (compatible Docker y host Windows)
REPO_ROOT = Path(__file__).resolve().parents[2]
DOCKER_DB_DIR = Path("/app/data")
if DOCKER_DB_DIR.exists():
    DB_PATH = DOCKER_DB_DIR / "mock-near-miss-events.json"
else:
    DB_PATH = REPO_ROOT / "data" / "mock-near-miss-events.json"

DB_LOCK = threading.Lock()
MAX_EVENTS = 5000

# Cargar variables de entorno desde .env si existe
ENV_FILE = REPO_ROOT / ".env"
if ENV_FILE.exists():
    try:
        with ENV_FILE.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
    except Exception:
        pass

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or ""

# ─────────────────────────────────────────────────────────────────────────────
# Cola de Reintentos Resiliente (Offline Queue + Exponential Backoff)
# ─────────────────────────────────────────────────────────────────────────────
_sync_queue: queue.Queue[dict] = queue.Queue(maxsize=3000)
_worker_started = False
_worker_lock = threading.Lock()


def _ensure_db_file() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not DB_PATH.exists():
        DB_PATH.write_text(json.dumps({"nearMissEvents": []}, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_db() -> dict:
    _ensure_db_file()
    raw = DB_PATH.read_text(encoding="utf-8")
    if not raw.strip():
        return {"nearMissEvents": []}
    try:
        data = json.loads(raw)
        if "nearMissEvents" not in data or not isinstance(data["nearMissEvents"], list):
            data["nearMissEvents"] = []
        return data
    except Exception:
        return {"nearMissEvents": []}


def _write_db(data: dict) -> None:
    DB_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _post_to_supabase(event: dict) -> bool:
    if not (SUPABASE_URL and SUPABASE_KEY):
        return True

    url = f"{SUPABASE_URL}/rest/v1/near_miss_events"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    payload = {
        "event_id": str(event.get("event_id") or f"evt-{int(datetime.now(timezone.utc).timestamp() * 1000)}"),
        "camera_id": str(event.get("camera_id") or "cam-vta-rtsp"),
        "timestamp": str(event.get("timestamp") or datetime.now(timezone.utc).isoformat()),
        "risk_level": str(event.get("risk_level") or "MEDIO"),
        "ttc_seconds": event.get("ttc_seconds"),
        "pet_seconds": event.get("pet_seconds"),
        "gps": event.get("gps"),
        "vehicle": event.get("vehicle"),
        "pedestrian": event.get("pedestrian"),
    }
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=4.0)
        if res.status_code in (200, 201):
            return True
        logger.warning("Supabase retorno status %s: %s", res.status_code, res.text)
        return False
    except Exception as e:
        logger.warning("Error de red conectando con Supabase: %s", e)
        return False


def _retry_worker_loop() -> None:
    backoff = 1.0
    while True:
        try:
            event = _sync_queue.get()
            success = _post_to_supabase(event)
            if success:
                backoff = 1.0
                _sync_queue.task_done()
            else:
                # Si falló por red/servidor, esperar con backoff y reintentar
                time.sleep(backoff)
                backoff = min(backoff * 2.0, 30.0)
                try:
                    _sync_queue.put_nowait(event)
                except queue.Full:
                    pass
                _sync_queue.task_done()
        except Exception:
            time.sleep(1.0)


def _ensure_worker() -> None:
    global _worker_started
    if not _worker_started:
        with _worker_lock:
            if not _worker_started:
                t = threading.Thread(target=_retry_worker_loop, daemon=True, name="supabase-sync-worker")
                t.start()
                _worker_started = True


def save_event(event: dict) -> None:
    # 1. Escritura síncrona en disco local (garantía de persistencia offline inmediata)
    with DB_LOCK:
        db = _read_db()
        db["nearMissEvents"].append(event)
        if len(db["nearMissEvents"]) > MAX_EVENTS:
            db["nearMissEvents"] = db["nearMissEvents"][-MAX_EVENTS:]
        _write_db(db)

    # 2. Encolar para sincronización en segundo plano con reintentos
    if SUPABASE_URL and SUPABASE_KEY:
        _ensure_worker()
        try:
            _sync_queue.put_nowait(event)
        except queue.Full:
            logger.warning("Cola de sincronizacion con Supabase llena; evento respaldado unicamente en local.")


def get_all_events() -> list[dict]:
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            url = f"{SUPABASE_URL}/rest/v1/near_miss_events?select=*&order=timestamp.desc&limit=1000"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            }
            res = requests.get(url, headers=headers, timeout=3.0)
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception as e:
            logger.warning("Supabase no disponible, usando copia local: %s", e)

    # Fallback local
    with DB_LOCK:
        db = _read_db()
        return list(db["nearMissEvents"])


def get_events_since(hours_back: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    min_dt = now - timedelta(hours=hours_back)
    min_iso = min_dt.isoformat()

    if SUPABASE_URL and SUPABASE_KEY:
        try:
            url = f"{SUPABASE_URL}/rest/v1/near_miss_events?timestamp=gte.{min_iso}&select=*&order=timestamp.desc&limit=1000"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            }
            res = requests.get(url, headers=headers, timeout=3.0)
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception as e:
            logger.warning("Supabase no disponible para rango, usando fallback: %s", e)

    # Fallback local
    out: list[dict] = []
    for event in get_all_events():
        ts = event.get("timestamp")
        try:
            event_dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            if event_dt >= min_dt:
                out.append(event)
        except Exception:
            continue
    return out
