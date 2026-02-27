import { TrackedActor } from '../types';
import { distance } from '../utils/geometry';

export function computeTTC(vehicle: TrackedActor, pedestrian: TrackedActor): number | null {
  const relativeVx = vehicle.velocityPxPerSec.x - pedestrian.velocityPxPerSec.x;
  const relativeVy = vehicle.velocityPxPerSec.y - pedestrian.velocityPxPerSec.y;
  const relativeSpeed = Math.hypot(relativeVx, relativeVy);
  if (relativeSpeed < 1) return null;
  const relativeDistance = distance(vehicle.center, pedestrian.center);
  return relativeDistance / relativeSpeed;
}

export function computePET(vehicle: TrackedActor, pedestrian: TrackedActor): number | null {
  const crossingDistance = distance(vehicle.center, pedestrian.center);
  const vehicleSpeed = Math.max(Math.hypot(vehicle.velocityPxPerSec.x, vehicle.velocityPxPerSec.y), 1);
  const pedestrianSpeed = Math.max(Math.hypot(pedestrian.velocityPxPerSec.x, pedestrian.velocityPxPerSec.y), 1);
  const vehicleTime = crossingDistance / vehicleSpeed;
  const pedestrianTime = crossingDistance / pedestrianSpeed;
  return Math.abs(vehicleTime - pedestrianTime);
}

export function predictedConflictWithinSeconds(vehicle: TrackedActor, pedestrian: TrackedActor, thresholdPx = 28): boolean {
  for (const v of vehicle.predictedPath) {
    const p = pedestrian.predictedPath.find((x) => x.t === v.t);
    if (!p) continue;
    if (distance(v, p) <= thresholdPx) return true;
  }
  return false;
}
