"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePayload = validatePayload;
const zod_1 = require("zod");
const actorClasses_1 = require("../constants/actorClasses");
const detectionSchema = zod_1.z.object({
    track_id: zod_1.z.string().optional(),
    class_name: zod_1.z.enum(actorClasses_1.ALL_ACTOR_CLASSES),
    confidence: zod_1.z.number(),
    bbox: zod_1.z.object({
        x: zod_1.z.number(),
        y: zod_1.z.number(),
        width: zod_1.z.number(),
        height: zod_1.z.number()
    })
});
const frameSchema = zod_1.z.object({
    camera_id: zod_1.z.string(),
    timestamp: zod_1.z.string(),
    gps: zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }),
    frame_size: zod_1.z.object({ width: zod_1.z.number(), height: zod_1.z.number() }),
    crosswalk_polygon: zod_1.z.array(zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number() })).min(3),
    detections: zod_1.z.array(detectionSchema)
});
function validatePayload(payload) {
    return frameSchema.parse(payload);
}
