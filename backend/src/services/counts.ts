import { TrackedActor } from '../types';
import { ALL_ACTOR_CLASSES } from '../constants/actorClasses';

export function buildCounts(tracks: TrackedActor[]) {
  const counts = Object.fromEntries(ALL_ACTOR_CLASSES.map((className) => [className, 0])) as Record<string, number>;

  for (const track of tracks) {
    counts[track.className] = (counts[track.className] || 0) + 1;
  }

  return {
    peaton: counts.peaton,
    motocicleta: counts.motocicleta,
    automovil: counts.automovil,
    bus_transcaribe: counts.bus_transcaribe,
    ciclista: counts.ciclista,
    cebra: counts.cebra,
    full: counts
  };
}