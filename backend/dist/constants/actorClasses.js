"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PEDESTRIAN_CLASSES = exports.VEHICLE_CLASSES = exports.ALL_ACTOR_CLASSES = void 0;
exports.ALL_ACTOR_CLASSES = [
    'peaton',
    'peaton_aereo',
    'movimiento_peaton',
    'motocicleta',
    'automovil',
    'bus_transcaribe',
    'bicicleta',
    'ciclista',
    'ambulancia',
    'gesto',
    'aparcamiento',
    'senal_paso'
];
exports.VEHICLE_CLASSES = new Set([
    'motocicleta',
    'automovil',
    'bus_transcaribe',
    'ambulancia'
]);
exports.PEDESTRIAN_CLASSES = new Set([
    'peaton',
    'peaton_aereo',
    'movimiento_peaton',
    'ciclista',
    'bicicleta'
]);
