from __future__ import annotations

from datetime import datetime
from .actor_classes import ALL_ACTOR_CLASSES

TRACK_TTL_MS = 20_000
session_started_at = datetime.utcnow().isoformat() + "Z"


def _zero_totals() -> dict[str, int]:
    return {k: 0 for k in ALL_ACTOR_CLASSES}


global_totals = _zero_totals()
totals_by_camera: dict[str, dict[str, int]] = {}
track_seen: dict[str, dict] = {}


def _get_camera_totals(camera_id: str) -> dict[str, int]:
    if camera_id not in totals_by_camera:
        totals_by_camera[camera_id] = _zero_totals()
    return totals_by_camera[camera_id]


def _cleanup_old_tracks(now_ts_ms: float) -> None:
    stale = [k for k, v in track_seen.items() if now_ts_ms - v["lastSeenAt"] > TRACK_TTL_MS]
    for key in stale:
        track_seen.pop(key, None)


def register_tracks_for_report(camera_id: str, tracks: list[dict], timestamp: str) -> None:
    try:
        now_ts_ms = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).timestamp() * 1000
    except Exception:
        now_ts_ms = datetime.utcnow().timestamp() * 1000

    _cleanup_old_tracks(now_ts_ms)
    camera_totals = _get_camera_totals(camera_id)

    for track in tracks:
        key = f"{camera_id}:{track['trackId']}"
        seen = track_seen.get(key)
        if (not seen) or (now_ts_ms - seen["lastSeenAt"] > TRACK_TTL_MS):
            cls = track["className"]
            if cls in camera_totals:
                camera_totals[cls] += 1
                global_totals[cls] += 1

        track_seen[key] = {"className": track["className"], "lastSeenAt": now_ts_ms}


def get_traffic_report() -> dict:
    by_camera = []
    for camera_id, totals in totals_by_camera.items():
        active_tracks = sum(1 for key in track_seen.keys() if key.startswith(f"{camera_id}:"))
        by_camera.append({"camera_id": camera_id, "totals": totals, "active_tracks": active_tracks})

    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "session_started_at": session_started_at,
        "totals": {k: global_totals[k] for k in ALL_ACTOR_CLASSES},
        "by_camera": by_camera,
    }
