from __future__ import annotations

import os
import time
from .actor_classes import PEDESTRIAN_CLASSES, VEHICLE_CLASSES
from .models import FramePayload

DEFAULT_ACTIVE_WINDOW_MS = 5000
active_window_ms = int(os.getenv("PERSON_ACTIVE_WINDOW_MS", str(DEFAULT_ACTIVE_WINDOW_MS)))
if active_window_ms <= 0:
    active_window_ms = DEFAULT_ACTIVE_WINDOW_MS

last_pedestrian_detected_at_ms: float | None = None
last_vehicle_detected_at_ms: float | None = None


def _build_state(now_ms: float | None = None) -> dict:
    now_ms = now_ms or (time.time() * 1000)
    person_detected = (
        last_pedestrian_detected_at_ms is not None
        and (now_ms - last_pedestrian_detected_at_ms) <= active_window_ms
    )
    vehicle_detected = (
        last_vehicle_detected_at_ms is not None
        and (now_ms - last_vehicle_detected_at_ms) <= active_window_ms
    )
    vehicle_only_detected = vehicle_detected and not person_detected

    person_expires_ms = (
        None
        if last_pedestrian_detected_at_ms is None
        else last_pedestrian_detected_at_ms + active_window_ms
    )
    vehicle_expires_ms = (
        None if last_vehicle_detected_at_ms is None else last_vehicle_detected_at_ms + active_window_ms
    )

    state = "GREEN" if person_detected else "RED" if vehicle_only_detected else "GRAY"

    return {
        "personDetected": person_detected,
        "vehicleDetected": vehicle_detected,
        "vehicleOnlyDetected": vehicle_only_detected,
        "state": state,
        "lastPersonDetectedAt": None
        if last_pedestrian_detected_at_ms is None
        else _to_iso(last_pedestrian_detected_at_ms),
        "personExpiresAt": None if person_expires_ms is None else _to_iso(person_expires_ms),
        "lastVehicleDetectedAt": None
        if last_vehicle_detected_at_ms is None
        else _to_iso(last_vehicle_detected_at_ms),
        "vehicleExpiresAt": None if vehicle_expires_ms is None else _to_iso(vehicle_expires_ms),
        "windowMs": active_window_ms,
    }


def _to_iso(ts_ms: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(ts_ms / 1000)) + "Z"


def update_presence_signal(payload: FramePayload) -> dict:
    global last_pedestrian_detected_at_ms, last_vehicle_detected_at_ms

    has_pedestrian = any(d.class_name in PEDESTRIAN_CLASSES for d in payload.detections)
    has_vehicle = any(d.class_name in VEHICLE_CLASSES for d in payload.detections)
    now_ms = time.time() * 1000

    if has_pedestrian:
        last_pedestrian_detected_at_ms = now_ms
    if has_vehicle:
        last_vehicle_detected_at_ms = now_ms

    return _build_state(now_ms)


def get_presence_signal_state() -> dict:
    return _build_state()
