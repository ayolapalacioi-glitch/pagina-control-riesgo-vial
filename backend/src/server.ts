import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { env } from './config/env';
import { buildApiRoutes } from './routes/apiRoutes';
import { createMqttClient } from './config/mqtt';
import { validatePayload } from './controllers/ingestController';
import { updateTracks } from './services/tracker';
import { calculateRisk } from './services/riskCalculator';
import { saveEvent } from './services/eventStore';
import { registerTracksForReport } from './services/trafficCounter';
import { buildCounts } from './services/counts';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.frontendOrigin
  }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/data', express.static(path.resolve(process.cwd(), '../data')));
app.use('/', express.static(path.resolve(process.cwd(), '../frontend')));
app.use('/vision', express.static(path.resolve(process.cwd(), '../vision-rt')));
app.use('/api', buildApiRoutes(io));

app.get('/vision', (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), '../vision-rt/index.html'));
});

createMqttClient(async (_topic, rawMessage) => {
  try {
    const payload = validatePayload(JSON.parse(rawMessage));
    const tracks = updateTracks(payload);
    const event = calculateRisk(payload, tracks, 'mqtt');
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
        full: counts.full
      },
      risk_event: event
    };

    if (event && (event.risk_level === 'ALTO' || event.risk_level === 'CRITICO')) {
      await saveEvent(event);
    }

    io.emit('snapshot', snapshot);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[MQTT] Error procesando payload:', message);
  }
});

io.on('connection', (socket) => {
  console.log(`[WS] Cliente conectado: ${socket.id}`);
  socket.emit('message', { text: 'Conectado al sistema de seguridad vial inteligente.' });

  socket.on('state_update', (payload) => {
    const envelope = {
      source: socket.id,
      timestamp: new Date().toISOString(),
      ...payload
    };
    io.emit('state_update', envelope);
  });

  socket.on('objects_update', (payload) => {
    const envelope = {
      source: socket.id,
      timestamp: new Date().toISOString(),
      ...payload
    };
    io.emit('objects_update', envelope);
  });
});

server.listen(env.port, () => {
  console.log(`Backend activo en http://localhost:${env.port}`);
});
