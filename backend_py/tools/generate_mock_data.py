from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import random

ROOT = Path(__file__).resolve().parents[2]
OUT_PATH = ROOT / "data" / "sample-sensecraft-json.json"


def make_frame(ts: datetime, idx: int) -> dict:
    base_x = 520 + (idx % 12) * 10
    return {
        "camera_id": "cam-001-cartagena-centro",
        "timestamp": ts.isoformat().replace("+00:00", "Z"),
        "gps": {"lat": 10.4236, "lng": -75.5457},
        "frame_size": {"width": 1280, "height": 720},
        "crosswalk_polygon": [
            {"x": 520, "y": 380},
            {"x": 880, "y": 380},
            {"x": 980, "y": 580},
            {"x": 470, "y": 580},
        ],
        "detections": [
            {
                "track_id": f"p-{100 + idx}",
                "class_name": "peaton",
                "confidence": 0.88,
                "bbox": {
                    "x": float(base_x),
                    "y": float(430 + random.randint(-8, 8)),
                    "width": 60.0,
                    "height": 150.0,
                },
            },
            {
                "track_id": f"a-{200 + idx}",
                "class_name": "automovil",
                "confidence": 0.9,
                "bbox": {
                    "x": float(560 + idx * 6),
                    "y": float(455 + random.randint(-6, 6)),
                    "width": 120.0,
                    "height": 90.0,
                },
            },
        ],
    }


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    start = datetime.now(timezone.utc)
    frames = [make_frame(start + timedelta(milliseconds=240 * i), i) for i in range(60)]
    OUT_PATH.write_text(json.dumps(frames, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Archivo generado: {OUT_PATH}")


if __name__ == "__main__":
    main()
