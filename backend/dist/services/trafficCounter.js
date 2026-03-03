"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTracksForReport = registerTracksForReport;
exports.getTrafficReport = getTrafficReport;
const actorClasses_1 = require("../constants/actorClasses");
const TRACK_TTL_MS = 20_000;
const sessionStartedAt = new Date().toISOString();
const zeroTotals = () => ({
    peaton: 0,
    peaton_aereo: 0,
    movimiento_peaton: 0,
    motocicleta: 0,
    automovil: 0,
    bus_transcaribe: 0,
    bicicleta: 0,
    ciclista: 0,
    ambulancia: 0,
    aparcamiento: 0,
    senal_paso: 0
});
const globalTotals = zeroTotals();
const totalsByCamera = new Map();
const trackSeen = new Map();
function getCameraTotals(cameraId) {
    if (!totalsByCamera.has(cameraId)) {
        totalsByCamera.set(cameraId, zeroTotals());
    }
    return totalsByCamera.get(cameraId);
}
function cleanupOldTracks(nowTs) {
    for (const [key, value] of trackSeen.entries()) {
        if (nowTs - value.lastSeenAt > TRACK_TTL_MS) {
            trackSeen.delete(key);
        }
    }
}
function registerTracksForReport(cameraId, tracks, timestamp) {
    const nowTs = new Date(timestamp).getTime() || Date.now();
    cleanupOldTracks(nowTs);
    const cameraTotals = getCameraTotals(cameraId);
    for (const track of tracks) {
        const key = `${cameraId}:${track.trackId}`;
        const seen = trackSeen.get(key);
        if (!seen || nowTs - seen.lastSeenAt > TRACK_TTL_MS) {
            cameraTotals[track.className] += 1;
            globalTotals[track.className] += 1;
        }
        trackSeen.set(key, {
            className: track.className,
            lastSeenAt: nowTs
        });
    }
}
function getTrafficReport() {
    const byCamera = Array.from(totalsByCamera.entries()).map(([camera_id, totals]) => {
        const active_tracks = Array.from(trackSeen.entries()).filter(([k]) => k.startsWith(`${camera_id}:`)).length;
        return {
            camera_id,
            totals,
            active_tracks
        };
    });
    return {
        generated_at: new Date().toISOString(),
        session_started_at: sessionStartedAt,
        totals: Object.fromEntries(actorClasses_1.ALL_ACTOR_CLASSES.map((className) => [className, globalTotals[className]])),
        by_camera: byCamera
    };
}
