from __future__ import annotations


def distance(a: dict[str, float], b: dict[str, float]) -> float:
    dx = a["x"] - b["x"]
    dy = a["y"] - b["y"]
    return (dx * dx + dy * dy) ** 0.5


def polygon_centroid(points: list[dict[str, float]]) -> dict[str, float]:
    if not points:
        return {"x": 0.0, "y": 0.0}
    sx = sum(p["x"] for p in points)
    sy = sum(p["y"] for p in points)
    return {"x": sx / len(points), "y": sy / len(points)}


def point_in_polygon(point: dict[str, float], polygon: list[dict[str, float]]) -> bool:
    x, y = point["x"], point["y"]
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]["x"], polygon[i]["y"]
        xj, yj = polygon[j]["x"], polygon[j]["y"]
        intersect = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-6) + xi
        )
        if intersect:
            inside = not inside
        j = i
    return inside
