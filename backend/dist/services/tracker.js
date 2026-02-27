"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTracks = updateTracks;
const geometry_1 = require("../utils/geometry");
const trackMemory = new Map();
const pxToMeter = 0.08;
function updateTracks(payload) {
    const ts = new Date(payload.timestamp).getTime();
    const crosswalkCenter = (0, geometry_1.polygonCentroid)(payload.crosswalk_polygon);
    return payload.detections.map((detection, idx) => {
        const trackId = detection.track_id || `${detection.class_name}-${idx}`;
        const center = {
            x: detection.bbox.x + detection.bbox.width / 2,
            y: detection.bbox.y + detection.bbox.height / 2
        };
        const prev = trackMemory.get(trackId);
        let velocity = { x: 0, y: 0 };
        if (prev) {
            const deltaT = Math.max((ts - prev.lastTs) / 1000, 0.05);
            const rawVelocity = {
                x: (center.x - prev.lastCenter.x) / deltaT,
                y: (center.y - prev.lastCenter.y) / deltaT
            };
            velocity = {
                x: 0.7 * prev.velocity.x + 0.3 * rawVelocity.x,
                y: 0.7 * prev.velocity.y + 0.3 * rawVelocity.y
            };
        }
        trackMemory.set(trackId, {
            lastCenter: center,
            lastTs: ts,
            velocity
        });
        const speedMps = Math.hypot(velocity.x * pxToMeter, velocity.y * pxToMeter);
        const speedKmh = speedMps * 3.6;
        const towardCrosswalk = (0, geometry_1.distance)(center, crosswalkCenter) > (0, geometry_1.distance)({ x: center.x + velocity.x, y: center.y + velocity.y }, crosswalkCenter);
        const predictedPath = [1, 2, 3, 4, 5].map((t) => ({
            x: center.x + velocity.x * t,
            y: center.y + velocity.y * t,
            t
        }));
        return {
            trackId,
            className: detection.class_name,
            center,
            velocityPxPerSec: velocity,
            speedKmh,
            headingToCrosswalk: towardCrosswalk,
            inCrosswalk: (0, geometry_1.pointInPolygon)(center, payload.crosswalk_polygon),
            predictedPath
        };
    });
}
