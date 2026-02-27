"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointInPolygon = pointInPolygon;
exports.distance = distance;
exports.polygonCentroid = polygonCentroid;
function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        const intersect = yi > point.y !== yj > point.y
            && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
        if (intersect)
            inside = !inside;
    }
    return inside;
}
function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function polygonCentroid(polygon) {
    const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
}
