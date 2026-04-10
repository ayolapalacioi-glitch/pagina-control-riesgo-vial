from __future__ import annotations

from .actor_classes import ALL_ACTOR_CLASSES


def build_counts(tracks: list[dict]) -> dict:
    counts = {name: 0 for name in ALL_ACTOR_CLASSES}
    for track in tracks:
        key = track.get("className")
        if key in counts:
            counts[key] += 1

    return {
        "peaton": counts["peaton"],
        "motocicleta": counts["motocicleta"],
        "automovil": counts["automovil"],
        "bus_transcaribe": counts["bus_transcaribe"],
        "ciclista": counts["ciclista"],
        "full": counts,
    }
