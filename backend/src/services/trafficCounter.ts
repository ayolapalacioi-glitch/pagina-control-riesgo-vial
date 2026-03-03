import { ActorClass, TrackedActor } from '../types';
import { ALL_ACTOR_CLASSES } from '../constants/actorClasses';

type Totals = Record<ActorClass, number>;

type CameraReport = {
  camera_id: string;
  totals: Totals;
  active_tracks: number;
};

type TrackSeenState = {
  className: ActorClass;
  lastSeenAt: number;
};

const TRACK_TTL_MS = 20_000;
const sessionStartedAt = new Date().toISOString();

const zeroTotals = (): Totals => ({
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

const globalTotals: Totals = zeroTotals();
const totalsByCamera = new Map<string, Totals>();
const trackSeen = new Map<string, TrackSeenState>();

function getCameraTotals(cameraId: string): Totals {
  if (!totalsByCamera.has(cameraId)) {
    totalsByCamera.set(cameraId, zeroTotals());
  }
  return totalsByCamera.get(cameraId)!;
}

function cleanupOldTracks(nowTs: number): void {
  for (const [key, value] of trackSeen.entries()) {
    if (nowTs - value.lastSeenAt > TRACK_TTL_MS) {
      trackSeen.delete(key);
    }
  }
}

export function registerTracksForReport(cameraId: string, tracks: TrackedActor[], timestamp: string): void {
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

export function getTrafficReport(): {
  generated_at: string;
  session_started_at: string;
  totals: Totals;
  by_camera: CameraReport[];
} {
  const byCamera: CameraReport[] = Array.from(totalsByCamera.entries()).map(([camera_id, totals]) => {
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
    totals: Object.fromEntries(ALL_ACTOR_CLASSES.map((className) => [className, globalTotals[className]])) as Totals,
    by_camera: byCamera
  };
}
