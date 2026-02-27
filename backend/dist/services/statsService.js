"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateStats = aggregateStats;
function aggregateStats(events) {
    const riskCount = { BAJO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0 };
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    const vehicleTypes = {};
    for (const event of events) {
        riskCount[event.risk_level] += 1;
        const hour = new Date(event.timestamp).getHours();
        byHour[hour].count += 1;
        const vType = event.vehicle?.className || 'desconocido';
        vehicleTypes[vType] = (vehicleTypes[vType] || 0) + 1;
    }
    return {
        totalEvents: events.length,
        riskCount,
        byHour,
        vehicleTypes
    };
}
