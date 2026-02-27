"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCounts = buildCounts;
const actorClasses_1 = require("../constants/actorClasses");
function buildCounts(tracks) {
    const counts = Object.fromEntries(actorClasses_1.ALL_ACTOR_CLASSES.map((className) => [className, 0]));
    for (const track of tracks) {
        counts[track.className] = (counts[track.className] || 0) + 1;
    }
    return {
        peaton: counts.peaton,
        motocicleta: counts.motocicleta,
        automovil: counts.automovil,
        bus_transcaribe: counts.bus_transcaribe,
        ciclista: counts.ciclista,
        full: counts
    };
}
