from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .stats_service import aggregate_stats

REPORTS_DIR = Path("/app/data/reports")


def _ensure_reports_dir() -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def export_events_to_csv(events: list[dict]) -> str:
    _ensure_reports_dir()
    file_path = REPORTS_DIR / f"near-miss-{int(datetime.utcnow().timestamp() * 1000)}.csv"
    with file_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "event_id",
                "timestamp",
                "camera_id",
                "lat",
                "lng",
                "risk_level",
                "ttc_seconds",
                "pet_seconds",
                "vehicle",
                "vehicle_speed_kmh",
                "pedestrian",
            ],
        )
        writer.writeheader()
        for event in events:
            gps = event.get("gps") or {}
            vehicle = event.get("vehicle") or {}
            pedestrian = event.get("pedestrian") or {}
            writer.writerow(
                {
                    "event_id": event.get("event_id"),
                    "timestamp": event.get("timestamp"),
                    "camera_id": event.get("camera_id"),
                    "lat": gps.get("lat"),
                    "lng": gps.get("lng"),
                    "risk_level": event.get("risk_level"),
                    "ttc_seconds": event.get("ttc_seconds"),
                    "pet_seconds": event.get("pet_seconds"),
                    "vehicle": vehicle.get("className"),
                    "vehicle_speed_kmh": vehicle.get("speedKmh"),
                    "pedestrian": pedestrian.get("className"),
                }
            )
    return str(file_path)


def export_daily_pdf(events: list[dict]) -> str:
    _ensure_reports_dir()
    file_path = REPORTS_DIR / f"reporte-diario-{int(datetime.utcnow().timestamp() * 1000)}.pdf"
    stats = aggregate_stats(events)

    c = canvas.Canvas(str(file_path), pagesize=A4)
    width, height = A4
    y = height - 50

    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, y, "Reporte Diario - Seguridad Vial Inteligente")
    y -= 24
    c.setFont("Helvetica", 11)
    c.drawString(40, y, "Tecnologia al servicio de la vida - Sistema Seguro / Vision Cero")
    y -= 24

    c.drawString(40, y, f"Total eventos near-miss: {stats['totalEvents']}")
    y -= 18
    c.drawString(40, y, f"Riesgo critico: {stats['riskCount']['CRITICO']}")
    y -= 18
    c.drawString(40, y, f"Riesgo alto: {stats['riskCount']['ALTO']}")
    y -= 18
    c.drawString(40, y, f"Riesgo medio: {stats['riskCount']['MEDIO']}")
    y -= 18
    c.drawString(40, y, f"Riesgo bajo: {stats['riskCount']['BAJO']}")
    y -= 26

    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Eventos mas recientes:")
    y -= 16
    c.setFont("Helvetica", 10)
    for event in list(reversed(events[-8:])):
        text = (
            f"- {event.get('timestamp')} | Cam: {event.get('camera_id')} | "
            f"Riesgo: {event.get('risk_level')} | TTC: {event.get('ttc_seconds', 'N/A')}s"
        )
        c.drawString(40, y, text[:130])
        y -= 14
        if y < 50:
            c.showPage()
            y = height - 50
            c.setFont("Helvetica", 10)

    c.save()
    return str(file_path)
