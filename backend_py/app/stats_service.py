from __future__ import annotations


def aggregate_stats(events: list[dict]) -> dict:
    risk_count = {"BAJO": 0, "MEDIO": 0, "ALTO": 0, "CRITICO": 0}
    by_hour = [{"hour": hour, "count": 0} for hour in range(24)]
    vehicle_types: dict[str, int] = {}

    for event in events:
        level = event.get("risk_level", "BAJO")
        if level in risk_count:
            risk_count[level] += 1

        ts = event.get("timestamp", "")
        try:
            hour = int(str(ts)[11:13])
            if 0 <= hour <= 23:
                by_hour[hour]["count"] += 1
        except Exception:
            pass

        v_type = ((event.get("vehicle") or {}).get("className")) or "desconocido"
        vehicle_types[v_type] = vehicle_types.get(v_type, 0) + 1

    return {
        "totalEvents": len(events),
        "riskCount": risk_count,
        "byHour": by_hour,
        "vehicleTypes": vehicle_types,
    }
