import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import { Server } from 'socket.io';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { env } from './config/env';
import { buildApiRoutes } from './routes/apiRoutes';
import { createMqttClient } from './config/mqtt';
import { validatePayload } from './controllers/ingestController';
import { updateTracks } from './services/tracker';
import { calculateRisk } from './services/riskCalculator';
import { saveEvent } from './services/eventStore';
import { registerTracksForReport } from './services/trafficCounter';
import { buildCounts } from './services/counts';

type FenceUpdate = {
  active: boolean;
  cameraId: string;
  gps: {
    lat: number;
    lng: number;
  };
  radiusMeters: number;
  triggeredAt: string;
  expiresAt: string | null;
  source: string;
  triggeredBy: string;
};

type ConnectedDevice = {
  socketId: string;
  displayName: string;
  kind: 'dashboard' | 'viewer' | 'unknown';
  userAgent: string;
  ip: string;
  connectedAt: string;
  gps?: {
    lat: number;
    lng: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

let latestFenceUpdate: FenceUpdate | null = null;
const connectedDevices = new Map<string, ConnectedDevice>();

function toKind(value: unknown): ConnectedDevice['kind'] {
  if (value === 'dashboard' || value === 'viewer') return value;
  return 'unknown';
}

function emitDevicesUpdate() {
  io.emit('devices_update', {
    total: connectedDevices.size,
    devices: Array.from(connectedDevices.values())
  });
}

const app = express();

const CERT_PATH = path.resolve(process.cwd(), '../certs/server.crt');
const KEY_PATH  = path.resolve(process.cwd(), '../certs/server.key');
const certExists = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

const server = certExists
  ? https.createServer({ cert: fs.readFileSync(CERT_PATH), key: fs.readFileSync(KEY_PATH) }, app)
  : http.createServer(app);

const io = new Server(server as Parameters<typeof Server>[0], {
  cors: {
    origin: env.frontendOrigin
  }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/data', express.static(path.resolve(process.cwd(), '../data')));
app.use('/', express.static(path.resolve(process.cwd(), '../frontend')));
app.use('/vision', express.static(path.resolve(process.cwd(), '../vision-rt')));

function getPublicTunnelUrl(): string | null {
  try {
    const tmpDir = path.resolve(process.cwd(), '../.tmp');

    // 1. Archivo genérico escrito por cualquier script de túnel
    const urlFile = path.join(tmpDir, 'public_url.txt');
    if (fs.existsSync(urlFile)) {
      const url = fs.readFileSync(urlFile, 'utf8').trim();
      if (url.startsWith('https://')) return url;
    }

    // 2. Log de cloudflared (stderr)
    const cfLog = path.join(tmpDir, 'cloudflared.err.log');
    if (fs.existsSync(cfLog)) {
      const content = fs.readFileSync(cfLog, 'utf8');
      const match = content.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/i);
      if (match) return match[0];
    }

    // 3. Log de localtunnel (legado)
    const ltLog = path.join(tmpDir, 'localtunnel.out.log');
    if (fs.existsSync(ltLog)) {
      const content = fs.readFileSync(ltLog, 'utf8');
      const match = content.match(/https:\/\/[^\s]+\.loca\.lt/i);
      if (match) return match[0];
    }
  } catch {
    // ignorar
  }
  return null;
}

app.get('/api/network-qr', (req, res) => {
  const port = env.port;
  const localProtocol = certExists ? 'https' : 'http';

  // Prioridad: LAN_IP env → IPs de red → host del request
  const lanIpEnv = (process.env.LAN_IP || '').trim();
  const localIps: string[] = [];
  if (lanIpEnv) localIps.push(lanIpEnv);
  Object.values(os.networkInterfaces()).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry && entry.family === 'IPv4' && !entry.internal && entry.address !== lanIpEnv) {
        localIps.push(entry.address);
      }
    });
  });

  const primaryIp = localIps[0] || req.headers.host?.split(':')[0] || 'localhost';
  const primaryUrl = `${localProtocol}://${primaryIp}:${port}/viewer.html?qr=1`;

  const allUrls = localIps.map((ip) => `${localProtocol}://${ip}:${port}/viewer.html?qr=1`);
  if (allUrls.length === 0) allUrls.push(primaryUrl);

  res.json({
    primary: primaryUrl,
    urls: allUrls,
    hasSecure: certExists
  });
});

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

  const defaultDevice: ConnectedDevice = {
    socketId: socket.id,
    displayName: 'Dispositivo',
    kind: 'unknown',
    userAgent: socket.handshake.headers['user-agent'] || 'N/A',
    ip: socket.handshake.address || 'N/A',
    connectedAt: new Date().toISOString()
  };
  connectedDevices.set(socket.id, defaultDevice);
  emitDevicesUpdate();

  if (latestFenceUpdate) {
    const isExpired = latestFenceUpdate.expiresAt
      ? new Date(latestFenceUpdate.expiresAt).getTime() <= Date.now()
      : false;

    if (isExpired) {
      latestFenceUpdate = null;
    } else {
      socket.emit('fence_update', latestFenceUpdate);
    }
  }

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

  socket.on('fence_update', (payload: unknown) => {
    if (!isRecord(payload)) return;

    const active = payload.active !== false;
    if (!active) {
      if (latestFenceUpdate?.triggeredBy && latestFenceUpdate.triggeredBy !== socket.id) return;
      latestFenceUpdate = null;
      io.emit('fence_update', {
        active: false,
        cameraId: typeof payload.cameraId === 'string' ? payload.cameraId : 'cam',
        source: 'qr',
        triggeredBy: socket.id,
        triggeredAt: new Date().toISOString(),
        expiresAt: null
      });
      return;
    }

    const gpsPayload = isRecord(payload.gps) ? payload.gps : null;
    const lat = typeof gpsPayload?.lat === 'number' ? gpsPayload.lat : NaN;
    const lng = typeof gpsPayload?.lng === 'number' ? gpsPayload.lng : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const source = typeof payload.source === 'string' ? payload.source : 'qr';

    const radiusMeters = 50;
    const nowIso = new Date().toISOString();

    let expiresAt: string | null = null;
    if (typeof payload.expiresAt === 'string') {
      const ts = new Date(payload.expiresAt).getTime();
      if (Number.isFinite(ts) && ts > Date.now()) {
        expiresAt = new Date(ts).toISOString();
      }
    }

    const envelope: FenceUpdate = {
      active: true,
      cameraId: typeof payload.cameraId === 'string' ? payload.cameraId : 'cam',
      gps: { lat, lng },
      radiusMeters,
      triggeredAt: nowIso,
      expiresAt,
      source,
      triggeredBy: socket.id
    };

    latestFenceUpdate = envelope;
    io.emit('fence_update', envelope);
  });

  socket.on('device_hello', (payload: unknown) => {
    const current = connectedDevices.get(socket.id);
    if (!current || !isRecord(payload)) return;

    const displayName = typeof payload.displayName === 'string' && payload.displayName.trim().length > 0
      ? payload.displayName.trim().slice(0, 60)
      : current.displayName;

    const kind = toKind(payload.kind);
    connectedDevices.set(socket.id, {
      ...current,
      displayName,
      kind
    });
    emitDevicesUpdate();
  });

  socket.on('location_update', (payload: unknown) => {
    const current = connectedDevices.get(socket.id);
    if (!current || !isRecord(payload)) return;
    const gpsPayload = isRecord(payload.gps) ? payload.gps : null;
    const lat = typeof gpsPayload?.lat === 'number' ? gpsPayload.lat : NaN;
    const lng = typeof gpsPayload?.lng === 'number' ? gpsPayload.lng : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    connectedDevices.set(socket.id, {
      ...current,
      gps: { lat, lng }
    });
    emitDevicesUpdate();
  });

  socket.on('disconnect', () => {
    connectedDevices.delete(socket.id);
    emitDevicesUpdate();
  });
});

server.listen(env.port, () => {
  const protocol = certExists ? 'https' : 'http';
  const port = env.port;

  // Recopilar IPs de red (LAN_IP env tiene prioridad)
  const lanIpEnv = (process.env.LAN_IP || '').trim();
  const networkIps: string[] = [];
  if (lanIpEnv) networkIps.push(lanIpEnv);
  Object.values(os.networkInterfaces()).forEach((entries) => {
    (entries || []).forEach((e) => {
      if (e && e.family === 'IPv4' && !e.internal && e.address !== lanIpEnv) {
        networkIps.push(e.address);
      }
    });
  });

  const sep = '─'.repeat(52);
  console.log(`\n${sep}`);
  console.log(`  Sistema de Seguridad Vial - Backend listo`);
  console.log(sep);
  console.log(`  Dashboard : ${protocol}://${networkIps[0] || 'localhost'}:${port}`);
  console.log(`  Viewer QR : ${protocol}://${networkIps[0] || 'localhost'}:${port}/viewer.html?qr=1`);
  if (networkIps.length > 1) {
    networkIps.slice(1).forEach((ip) => {
      console.log(`  Alt       : ${protocol}://${ip}:${port}`);
    });
  }
  if (certExists) {
    console.log(`\n  [HTTPS] Primera vez: abre la URL en el navegador`);
    console.log(`          y acepta el certificado (Avanzado > Continuar).`);
  }
  console.log(`${sep}\n`);
});
