import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { validatePayload } from '../controllers/ingestController';
import { updateTracks } from '../services/tracker';
import { calculateRisk } from '../services/riskCalculator';
import { getAllEvents, getEventsSince, saveEvent } from '../services/eventStore';
import { aggregateStats } from '../services/statsService';
import { exportDailyPdf, exportEventsToCsv } from '../services/reportService';
import { getTrafficReport, registerTracksForReport } from '../services/trafficCounter';
import { buildCounts } from '../services/counts';
import { Server } from 'socket.io';

export function buildApiRoutes(io: Server) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'seguridad-vial-backend' });
  });

  router.post('/ingest', async (req, res) => {
    try {
      const payload = validatePayload(req.body);
      const tracks = updateTracks(payload);
      const event = calculateRisk(payload, tracks, 'http');
      registerTracksForReport(payload.camera_id, tracks, payload.timestamp);
      const counts = buildCounts(tracks);
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
        await saveEvent(event);
      }

      io.emit('snapshot', snapshot);
      res.json({ ok: true, snapshot });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Payload inválido';
      res.status(400).json({ ok: false, error: message });
    }
  });

  router.post('/simulate/offline', async (_req, res) => {
    const samplePath = path.resolve(process.cwd(), '../data/sample-sensecraft-json.json');
    const raw = fs.readFileSync(samplePath, 'utf-8');
    const frames = JSON.parse(raw) as unknown[];

    for (const frame of frames) {
      const payload = validatePayload(frame);
      const tracks = updateTracks(payload);
      const event = calculateRisk(payload, tracks, 'mock');
      registerTracksForReport(payload.camera_id, tracks, payload.timestamp);
      const counts = buildCounts(tracks);
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
        await saveEvent(event);
      }
      io.emit('snapshot', snapshot);
    }

    res.json({ ok: true, message: 'Simulación offline ejecutada.' });
  });

  router.get('/events', async (_req, res) => {
    const events = await getAllEvents();
    res.json(events);
  });

  router.get('/stats', async (req, res) => {
    const period = (req.query.period as string) || 'day';
    const hours = period === 'hour' ? 1 : period === 'week' ? 24 * 7 : 24;
    const events = await getEventsSince(hours);
    res.json({ period, ...aggregateStats(events) });
  });

  router.get('/report/traffic', (_req, res) => {
    res.json(getTrafficReport());
  });

  router.get('/export/csv', async (_req, res) => {
    const events = await getAllEvents();
    const filePath = exportEventsToCsv(events);
    res.download(filePath);
  });

  router.get('/export/pdf', async (_req, res) => {
    const events = await getEventsSince(24);
    const filePath = await exportDailyPdf(events);
    res.download(filePath);
  });

  return router;
}
