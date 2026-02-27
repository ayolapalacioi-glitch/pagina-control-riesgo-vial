"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeTTC = computeTTC;
exports.computePET = computePET;
exports.predictedConflictWithinSeconds = predictedConflictWithinSeconds;
const geometry_1 = require("../utils/geometry");
function computeTTC(vehicle, pedestrian) {
    const relativeVx = vehicle.velocityPxPerSec.x - pedestrian.velocityPxPerSec.x;
    const relativeVy = vehicle.velocityPxPerSec.y - pedestrian.velocityPxPerSec.y;
    const relativeSpeed = Math.hypot(relativeVx, relativeVy);
    if (relativeSpeed < 1)
        return null;
    const relativeDistance = (0, geometry_1.distance)(vehicle.center, pedestrian.center);
    return relativeDistance / relativeSpeed;
}
function computePET(vehicle, pedestrian) {
    const crossingDistance = (0, geometry_1.distance)(vehicle.center, pedestrian.center);
    const vehicleSpeed = Math.max(Math.hypot(vehicle.velocityPxPerSec.x, vehicle.velocityPxPerSec.y), 1);
    const pedestrianSpeed = Math.max(Math.hypot(pedestrian.velocityPxPerSec.x, pedestrian.velocityPxPerSec.y), 1);
    const vehicleTime = crossingDistance / vehicleSpeed;
    const pedestrianTime = crossingDistance / pedestrianSpeed;
    return Math.abs(vehicleTime - pedestrianTime);
}
function predictedConflictWithinSeconds(vehicle, pedestrian, thresholdPx = 28) {
    for (const v of vehicle.predictedPath) {
        const p = pedestrian.predictedPath.find((x) => x.t === v.t);
        if (!p)
            continue;
        if ((0, geometry_1.distance)(v, p) <= thresholdPx)
            return true;
    }
    return false;
}
