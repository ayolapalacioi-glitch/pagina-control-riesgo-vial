import { ActorClass } from './constants/actorClasses';

export type { ActorClass };

export interface SenseCraftDetection {
  track_id?: string;
  class_name: ActorClass;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface SenseCraftFramePayload {
  camera_id: string;
  timestamp: string;
  gps: { lat: number; lng: number };
  frame_size: { width: number; height: number };
  crosswalk_polygon: Array<{ x: number; y: number }>;
  detections: SenseCraftDetection[];
}

export interface TrackedActor {
  trackId: string;
  className: ActorClass;
  center: { x: number; y: number };
  velocityPxPerSec: { x: number; y: number };
  speedKmh: number;
  headingToCrosswalk: boolean;
  inCrosswalk: boolean;
  predictedPath: Array<{ x: number; y: number; t: number }>;
}

export type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

export interface NearMissEvent {
  event_id: string;
  camera_id: string;
  timestamp: string;
  gps: { lat: number; lng: number };
  risk_level: RiskLevel;
  ttc_seconds: number | null;
  pet_seconds: number | null;
  vehicle: TrackedActor | null;
  pedestrian: TrackedActor | null;
  factors: string[];
  recommended_action: string;
  source: 'mqtt' | 'http' | 'mock';
}
