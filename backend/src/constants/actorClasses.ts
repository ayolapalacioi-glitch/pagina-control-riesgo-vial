export const ALL_ACTOR_CLASSES = [
  'peaton',
  'peaton_aereo',
  'movimiento_peaton',
  'motocicleta',
  'automovil',
  'bus_transcaribe',
  'bicicleta',
  'ciclista',
  'ambulancia',
  'aparcamiento',
  'senal_paso'
] as const;

export type ActorClass = (typeof ALL_ACTOR_CLASSES)[number];

export const VEHICLE_CLASSES: ReadonlySet<ActorClass> = new Set([
  'motocicleta',
  'automovil',
  'bus_transcaribe',
  'ambulancia'
]);

export const PEDESTRIAN_CLASSES: ReadonlySet<ActorClass> = new Set([
  'peaton',
  'peaton_aereo',
  'movimiento_peaton',
  'ciclista',
  'bicicleta'
]);