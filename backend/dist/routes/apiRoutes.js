"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApiRoutes = buildApiRoutes;
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ingestController_1 = require("../controllers/ingestController");
const tracker_1 = require("../services/tracker");
const riskCalculator_1 = require("../services/riskCalculator");
const eventStore_1 = require("../services/eventStore");
const statsService_1 = require("../services/statsService");
const reportService_1 = require("../services/reportService");
const trafficCounter_1 = require("../services/trafficCounter");
const counts_1 = require("../services/counts");
function buildApiRoutes(io) {
    const router = (0, express_1.Router)();
    router.get('/health', (_req, res) => {
        res.json({ status: 'ok', service: 'seguridad-vial-backend' });
    });
    router.post('/ingest', async (req, res) => {
        try {
            const payload = (0, ingestController_1.validatePayload)(req.body);
            const tracks = (0, tracker_1.updateTracks)(payload);
            const event = (0, riskCalculator_1.calculateRisk)(payload, tracks, 'http');
            (0, trafficCounter_1.registerTracksForReport)(payload.camera_id, tracks, payload.timestamp);
            const counts = (0, counts_1.buildCounts)(tracks);
            const snapshot = {
                type: 'realtime_snapshot',
                camera_id: payload.camera_id,
                timestamp: payload.timestamp,
                gps: payload.gps,
                counts: {
                    peaton: counts.peaton,
                    motocicleta: counts.motocicleta,
                    automovil: counts.automovil,
                    bus_transcaribe: counts.bus_transcaribe,
                    ciclista: counts.ciclista,
                    cebra: counts.cebra,
                    full: counts.full
                },
                risk_event: event
            };
            if (event && (event.risk_level === 'ALTO' || event.risk_level === 'CRITICO')) {
                await (0, eventStore_1.saveEvent)(event);
            }
            io.emit('snapshot', snapshot);
            res.json({ ok: true, snapshot });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Payload inválido';
            res.status(400).json({ ok: false, error: message });
        }
    });
    router.post('/simulate/offline', async (_req, res) => {
        const samplePath = path_1.default.resolve(process.cwd(), '../data/sample-sensecraft-json.json');
        const raw = fs_1.default.readFileSync(samplePath, 'utf-8');
        const frames = JSON.parse(raw);
        for (const frame of frames) {
            const payload = (0, ingestController_1.validatePayload)(frame);
            const tracks = (0, tracker_1.updateTracks)(payload);
            const event = (0, riskCalculator_1.calculateRisk)(payload, tracks, 'mock');
            (0, trafficCounter_1.registerTracksForReport)(payload.camera_id, tracks, payload.timestamp);
            const counts = (0, counts_1.buildCounts)(tracks);
            const snapshot = {
                type: 'realtime_snapshot',
                camera_id: payload.camera_id,
                timestamp: payload.timestamp,
                gps: payload.gps,
                counts: {
                    peaton: counts.peaton,
                    motocicleta: counts.motocicleta,
                    automovil: counts.automovil,
                    bus_transcaribe: counts.bus_transcaribe,
                    ciclista: counts.ciclista,
                    cebra: counts.cebra,
                    full: counts.full
                },
                risk_event: event
            };
            if (event && (event.risk_level === 'ALTO' || event.risk_level === 'CRITICO')) {
                await (0, eventStore_1.saveEvent)(event);
            }
            io.emit('snapshot', snapshot);
        }
        res.json({ ok: true, message: 'Simulación offline ejecutada.' });
    });
    router.get('/events', async (_req, res) => {
        const events = await (0, eventStore_1.getAllEvents)();
        res.json(events);
    });
    router.get('/stats', async (req, res) => {
        const period = req.query.period || 'day';
        const hours = period === 'hour' ? 1 : period === 'week' ? 24 * 7 : 24;
        const events = await (0, eventStore_1.getEventsSince)(hours);
        res.json({ period, ...(0, statsService_1.aggregateStats)(events) });
    });
    router.get('/report/traffic', (_req, res) => {
        res.json((0, trafficCounter_1.getTrafficReport)());
    });
    router.get('/export/csv', async (_req, res) => {
        const events = await (0, eventStore_1.getAllEvents)();
        const filePath = (0, reportService_1.exportEventsToCsv)(events);
        res.download(filePath);
    });
    router.get('/export/pdf', async (_req, res) => {
        const events = await (0, eventStore_1.getEventsSince)(24);
        const filePath = await (0, reportService_1.exportDailyPdf)(events);
        res.download(filePath);
    });
    return router;
}
