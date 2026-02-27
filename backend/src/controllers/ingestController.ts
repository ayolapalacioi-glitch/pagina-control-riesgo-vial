import { z } from 'zod';
import { SenseCraftFramePayload } from '../types';
import { ALL_ACTOR_CLASSES } from '../constants/actorClasses';

const detectionSchema = z.object({
  track_id: z.string().optional(),
  class_name: z.enum(ALL_ACTOR_CLASSES),
  confidence: z.number(),
  bbox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  })
});

const frameSchema = z.object({
  camera_id: z.string(),
  timestamp: z.string(),
  gps: z.object({ lat: z.number(), lng: z.number() }),
  frame_size: z.object({ width: z.number(), height: z.number() }),
  crosswalk_polygon: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
  detections: z.array(detectionSchema)
});

export function validatePayload(payload: unknown): SenseCraftFramePayload {
  return frameSchema.parse(payload);
}
