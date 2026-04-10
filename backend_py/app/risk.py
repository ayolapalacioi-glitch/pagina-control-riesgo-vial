from __future__ import annotations

import time
from .actor_classes import PEDESTRIAN_CLASSES, VEHICLE_CLASSES
from .prediction import compute_pet, compute_ttc, predicted_conflict_within_seconds
from .models import FramePayload


def classify_risk(score: int) -> str:
    if score >= 90:
        return "CRITICO"
    if score >= 65:
        return "ALTO"
    if score >= 40:
        return "MEDIO"
    return "BAJO"


def calculate_risk(payload: FramePayload, tracks: list[dict], source: str) -> dict | None:
    pedestrians = [x for x in tracks if x["className"] in PEDESTRIAN_CLASSES]
    vehicles = [x for x in tracks if x["className"] in VEHICLE_CLASSES]
    if not pedestrians or not vehicles:
        return None

    best_event = None
    best_score = -1

    for ped in pedestrians:
        for vehicle in vehicles:
            ttc = compute_ttc(vehicle, ped)
            pet = compute_pet(vehicle, ped)
            has_future_conflict = predicted_conflict_within_seconds(vehicle, ped)
            factors: list[str] = []
            score = 10

            if ped["inCrosswalk"]:
                score += 25
                factors.append("Peaton en zona de cebra")
            if vehicle["headingToCrosswalk"]:
                score += 20
                factors.append("Vehiculo con trayectoria hacia cebra")
            if vehicle["speedKmh"] > 30:
                score += 20
                factors.append(f"Velocidad vehicular alta ({vehicle['speedKmh']:.1f} km/h)")
            if vehicle["className"] == "ambulancia":
                score += 15
                factors.append("Vehiculo de emergencia en zona de conflicto")

            if ttc is not None:
                if ttc < 2.5:
                    score += 30
                    factors.append(f"TTC critico ({ttc:.2f} s)")
                elif ttc < 4:
                    score += 15
                    factors.append(f"TTC preventivo ({ttc:.2f} s)")

            if pet is not None:
                if pet < 1.5:
                    score += 20
                    factors.append(f"PET critico ({pet:.2f} s)")
                elif pet < 3:
                    score += 10
                    factors.append(f"PET bajo ({pet:.2f} s)")

            if has_future_conflict:
                score += 25
                factors.append("Prediccion de conflicto entre 1-5 segundos")

            risk_level = classify_risk(score)
            if score > best_score:
                best_score = score
                best_event = {
                    "event_id": f"{payload.camera_id}-{int(time.time()*1000)}-{vehicle['trackId']}-{ped['trackId']}",
                    "camera_id": payload.camera_id,
                    "timestamp": payload.timestamp,
                    "gps": payload.gps.model_dump(),
                    "risk_level": risk_level,
                    "ttc_seconds": ttc,
                    "pet_seconds": pet,
                    "vehicle": vehicle,
                    "pedestrian": ped,
                    "factors": factors,
                    "recommended_action": (
                        "Activar alerta visual/sonora inmediata y priorizar paso peatonal."
                        if risk_level == "CRITICO"
                        else "Advertencia preventiva a conductores y monitoreo en tiempo real."
                        if risk_level == "ALTO"
                        else "Monitoreo continuo y campañas de sensibilizacion."
                    ),
                    "source": source,
                }

    return best_event
