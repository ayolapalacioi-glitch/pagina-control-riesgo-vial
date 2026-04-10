from __future__ import annotations

from datetime import datetime
from .geometry import distance, point_in_polygon, polygon_centroid
from .models import FramePayload

track_memory: dict[str, dict] = {}
PX_TO_METER = 0.08


def _to_ts(iso_time: str) -> float:
    try:
        return datetime.fromisoformat(iso_time.replace("Z", "+00:00")).timestamp() * 1000
    except Exception:
        return datetime.utcnow().timestamp() * 1000


def update_tracks(payload: FramePayload) -> list[dict]:
    ts = _to_ts(payload.timestamp)
    crosswalk_center = polygon_centroid([p.model_dump() for p in payload.crosswalk_polygon])

    tracks: list[dict] = []
    for idx, detection in enumerate(payload.detections):
        track_id = detection.track_id or f"{detection.class_name}-{idx}"
        bbox = {
            "x": float(detection.bbox.x),
            "y": float(detection.bbox.y),
            "w": float(detection.bbox.width),
            "h": float(detection.bbox.height),
        }
        center = {"x": bbox["x"] + bbox["w"] / 2, "y": bbox["y"] + bbox["h"] / 2}

        prev = track_memory.get(track_id)
        velocity = {"x": 0.0, "y": 0.0}
        trail = [center]

        if prev:
            delta_t = max((ts - prev["lastTs"]) / 1000, 0.05)
            raw_v = {
                "x": (center["x"] - prev["lastCenter"]["x"]) / delta_t,
                "y": (center["y"] - prev["lastCenter"]["y"]) / delta_t,
            }
            velocity = {
                "x": 0.7 * prev["velocity"]["x"] + 0.3 * raw_v["x"],
                "y": 0.7 * prev["velocity"]["y"] + 0.3 * raw_v["y"],
            }
            trail = (prev.get("trail") or []) + [center]
            trail = trail[-20:]

        track_memory[track_id] = {
            "lastCenter": center,
            "lastTs": ts,
            "velocity": velocity,
            "trail": trail,
        }

        speed_mps = ((velocity["x"] * PX_TO_METER) ** 2 + (velocity["y"] * PX_TO_METER) ** 2) ** 0.5
        speed_kmh = speed_mps * 3.6

        projected = {"x": center["x"] + velocity["x"], "y": center["y"] + velocity["y"]}
        toward_crosswalk = distance(center, crosswalk_center) > distance(projected, crosswalk_center)

        predicted_path = [
            {"x": center["x"] + velocity["x"] * t, "y": center["y"] + velocity["y"] * t, "t": float(t)}
            for t in [1, 2, 3, 4, 5]
        ]

        tracks.append(
            {
                "trackId": track_id,
                "className": detection.class_name,
                "score": float(detection.confidence),
                "bbox": bbox,
                "center": center,
                "velocityPxPerSec": velocity,
                "speedKmh": speed_kmh,
                "headingToCrosswalk": toward_crosswalk,
                "inCrosswalk": point_in_polygon(center, [p.model_dump() for p in payload.crosswalk_polygon]),
                "predictedPath": predicted_path,
                "trail": trail,
            }
        )

    return tracks
