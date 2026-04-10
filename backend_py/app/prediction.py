from __future__ import annotations

from .geometry import distance


def compute_ttc(vehicle: dict, pedestrian: dict) -> float | None:
    rvx = vehicle["velocityPxPerSec"]["x"] - pedestrian["velocityPxPerSec"]["x"]
    rvy = vehicle["velocityPxPerSec"]["y"] - pedestrian["velocityPxPerSec"]["y"]
    relative_speed = (rvx * rvx + rvy * rvy) ** 0.5
    if relative_speed < 1:
        return None
    relative_distance = distance(vehicle["center"], pedestrian["center"])
    return relative_distance / relative_speed


def compute_pet(vehicle: dict, pedestrian: dict) -> float | None:
    crossing_distance = distance(vehicle["center"], pedestrian["center"])
    vehicle_speed = max(
        (vehicle["velocityPxPerSec"]["x"] ** 2 + vehicle["velocityPxPerSec"]["y"] ** 2) ** 0.5,
        1,
    )
    ped_speed = max(
        (pedestrian["velocityPxPerSec"]["x"] ** 2 + pedestrian["velocityPxPerSec"]["y"] ** 2) ** 0.5,
        1,
    )
    return abs((crossing_distance / vehicle_speed) - (crossing_distance / ped_speed))


def predicted_conflict_within_seconds(vehicle: dict, pedestrian: dict, threshold_px: float = 28) -> bool:
    p_by_t = {int(x["t"]): x for x in pedestrian.get("predictedPath", [])}
    for v in vehicle.get("predictedPath", []):
        key = int(v["t"])
        p = p_by_t.get(key)
        if not p:
            continue
        if distance(v, p) <= threshold_px:
            return True
    return False
