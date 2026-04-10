from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path("/app/data/mock-near-miss-events.json")
DB_LOCK = threading.Lock()
MAX_EVENTS = 5000


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


def save_event(event: dict) -> None:
    with DB_LOCK:
        db = _read_db()
        db["nearMissEvents"].append(event)
        if len(db["nearMissEvents"]) > MAX_EVENTS:
            db["nearMissEvents"] = db["nearMissEvents"][-MAX_EVENTS:]
        _write_db(db)


def get_all_events() -> list[dict]:
    with DB_LOCK:
        db = _read_db()
        return list(db["nearMissEvents"])


def get_events_since(hours_back: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    min_dt = now - timedelta(hours=hours_back)
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
