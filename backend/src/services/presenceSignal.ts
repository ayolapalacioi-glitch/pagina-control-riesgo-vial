import { PEDESTRIAN_CLASSES, VEHICLE_CLASSES } from '../constants/actorClasses';
import { SenseCraftFramePayload } from '../types';

const DEFAULT_ACTIVE_WINDOW_MS = 5000;

function resolveWindowMs() {
  const fromEnv = Number(process.env.PERSON_ACTIVE_WINDOW_MS || DEFAULT_ACTIVE_WINDOW_MS);
  if (!Number.isFinite(fromEnv) || fromEnv <= 0) return DEFAULT_ACTIVE_WINDOW_MS;
  return Math.floor(fromEnv);
}

const activeWindowMs = resolveWindowMs();
let lastPedestrianDetectedAtMs: number | null = null;
let lastVehicleDetectedAtMs: number | null = null;

export type PresenceSignalState = {
  personDetected: boolean;
  vehicleDetected: boolean;
  vehicleOnlyDetected: boolean;
  state: 'GREEN' | 'RED' | 'GRAY';
  lastPersonDetectedAt: string | null;
  personExpiresAt: string | null;
  lastVehicleDetectedAt: string | null;
  vehicleExpiresAt: string | null;
  windowMs: number;
};

function buildState(nowMs = Date.now()): PresenceSignalState {
  const personDetected =
    lastPedestrianDetectedAtMs !== null && nowMs - lastPedestrianDetectedAtMs <= activeWindowMs;
  const vehicleDetected =
    lastVehicleDetectedAtMs !== null && nowMs - lastVehicleDetectedAtMs <= activeWindowMs;
  const vehicleOnlyDetected = vehicleDetected && !personDetected;

  const personExpiresAtMs =
    lastPedestrianDetectedAtMs === null ? null : lastPedestrianDetectedAtMs + activeWindowMs;
  const vehicleExpiresAtMs =
    lastVehicleDetectedAtMs === null ? null : lastVehicleDetectedAtMs + activeWindowMs;

  const state: PresenceSignalState['state'] = personDetected
    ? 'GREEN'
    : vehicleOnlyDetected
      ? 'RED'
      : 'GRAY';

  return {
    personDetected,
    vehicleDetected,
    vehicleOnlyDetected,
    state,
    lastPersonDetectedAt:
      lastPedestrianDetectedAtMs === null ? null : new Date(lastPedestrianDetectedAtMs).toISOString(),
    personExpiresAt: personExpiresAtMs === null ? null : new Date(personExpiresAtMs).toISOString(),
    lastVehicleDetectedAt:
      lastVehicleDetectedAtMs === null ? null : new Date(lastVehicleDetectedAtMs).toISOString(),
    vehicleExpiresAt: vehicleExpiresAtMs === null ? null : new Date(vehicleExpiresAtMs).toISOString(),
    windowMs: activeWindowMs
  };
}

export function updatePresenceSignal(payload: SenseCraftFramePayload): PresenceSignalState {
  const hasPedestrian = payload.detections.some((detection) => PEDESTRIAN_CLASSES.has(detection.class_name));
  const hasVehicle = payload.detections.some((detection) => VEHICLE_CLASSES.has(detection.class_name));
  if (hasPedestrian) {
    lastPedestrianDetectedAtMs = Date.now();
  }
  if (hasVehicle) {
    lastVehicleDetectedAtMs = Date.now();
  }
  return buildState();
}

export function getPresenceSignalState(): PresenceSignalState {
  return buildState();
}
