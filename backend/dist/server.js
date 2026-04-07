"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const env_1 = require("./config/env");
const apiRoutes_1 = require("./routes/apiRoutes");
const mqtt_1 = require("./config/mqtt");
const ingestController_1 = require("./controllers/ingestController");
const tracker_1 = require("./services/tracker");
const riskCalculator_1 = require("./services/riskCalculator");
const eventStore_1 = require("./services/eventStore");
const trafficCounter_1 = require("./services/trafficCounter");
const counts_1 = require("./services/counts");
const presenceSignal_1 = require("./services/presenceSignal");
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
let latestFenceUpdate = null;
const connectedDevices = new Map();
function toKind(value) {
    if (value === 'dashboard' || value === 'viewer')
        return value;
    return 'unknown';
}
function emitDevicesUpdate() {
    io.emit('devices_update', {
        total: connectedDevices.size,
        devices: Array.from(connectedDevices.values())
    });
}
const app = (0, express_1.default)();
const CERT_PATH = path_1.default.resolve(process.cwd(), '../certs/server.crt');
const KEY_PATH = path_1.default.resolve(process.cwd(), '../certs/server.key');
const certExists = fs_1.default.existsSync(CERT_PATH) && fs_1.default.existsSync(KEY_PATH);
const server = certExists
    ? https_1.default.createServer({ cert: fs_1.default.readFileSync(CERT_PATH), key: fs_1.default.readFileSync(KEY_PATH) }, app)
    : http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: env_1.env.frontendOrigin
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '2mb' }));
app.use('/data', express_1.default.static(path_1.default.resolve(process.cwd(), '../data')));
app.use('/', express_1.default.static(path_1.default.resolve(process.cwd(), '../frontend')));
app.use('/vision', express_1.default.static(path_1.default.resolve(process.cwd(), '../vision-rt')));
function getPublicTunnelUrl() {
    try {
        const tmpDir = path_1.default.resolve(process.cwd(), '../.tmp');
        // 1. Archivo genérico escrito por cualquier script de túnel
        const urlFile = path_1.default.join(tmpDir, 'public_url.txt');
        if (fs_1.default.existsSync(urlFile)) {
            const url = fs_1.default.readFileSync(urlFile, 'utf8').trim();
            if (url.startsWith('https://'))
                return url;
        }
        // 2. Log de cloudflared (stderr)
        const cfLog = path_1.default.join(tmpDir, 'cloudflared.err.log');
        if (fs_1.default.existsSync(cfLog)) {
            const content = fs_1.default.readFileSync(cfLog, 'utf8');
            const match = content.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/i);
            if (match)
                return match[0];
        }
        // 3. Log de localtunnel (legado)
        const ltLog = path_1.default.join(tmpDir, 'localtunnel.out.log');
        if (fs_1.default.existsSync(ltLog)) {
            const content = fs_1.default.readFileSync(ltLog, 'utf8');
            const match = content.match(/https:\/\/[^\s]+\.loca\.lt/i);
            if (match)
                return match[0];
        }
    }
    catch {
        // ignorar
    }
    return null;
}
app.get('/api/network-qr', (req, res) => {
    const port = env_1.env.port;
    const localProtocol = certExists ? 'https' : 'http';
    // Prioridad: LAN_IP env → IPs de red → host del request
    const lanIpEnv = (process.env.LAN_IP || '').trim();
    const localIps = [];
    if (lanIpEnv)
        localIps.push(lanIpEnv);
    Object.values(os_1.default.networkInterfaces()).forEach((entries) => {
        (entries || []).forEach((entry) => {
            if (entry && entry.family === 'IPv4' && !entry.internal && entry.address !== lanIpEnv) {
                localIps.push(entry.address);
            }
        });
    });
    const primaryIp = localIps[0] || req.headers.host?.split(':')[0] || 'localhost';
    const primaryUrl = `${localProtocol}://${primaryIp}:${port}/viewer.html?qr=1`;
    const allUrls = localIps.map((ip) => `${localProtocol}://${ip}:${port}/viewer.html?qr=1`);
    if (allUrls.length === 0)
        allUrls.push(primaryUrl);
    res.json({
        primary: primaryUrl,
        urls: allUrls,
        hasSecure: certExists
    });
});
app.use('/api', (0, apiRoutes_1.buildApiRoutes)(io));
app.get('/vision', (_req, res) => {
    res.sendFile(path_1.default.resolve(process.cwd(), '../vision-rt/index.html'));
});
app.get('/esp32/light', (_req, res) => {
    const status = (0, presenceSignal_1.getPresenceSignalState)();
    const bgColor = status.personDetected ? '#00b050' : '#2f2f2f';
    const label = status.personDetected ? 'PERSONA DETECTADA' : 'SIN DETECCION';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="1" />
  <title>ESP32 Luz de Estado</title>
  <style>
    :root { color-scheme: only light; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      font-family: sans-serif;
      background: ${bgColor};
      color: #ffffff;
    }
    .center {
      height: 100%;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 16px;
      box-sizing: border-box;
    }
    h1 {
      margin: 0;
      font-size: clamp(22px, 7vw, 44px);
      letter-spacing: 0.06em;
    }
    p {
      margin-top: 10px;
      font-size: clamp(12px, 4vw, 18px);
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <main class="center">
    <div>
      <h1>${label}</h1>
      <p>Estado se actualiza cada 1 segundo</p>
    </div>
  </main>
</body>
</html>`);
});
(0, mqtt_1.createMqttClient)(async (_topic, rawMessage) => {
    try {
        const payload = (0, ingestController_1.validatePayload)(JSON.parse(rawMessage));
        (0, presenceSignal_1.updatePresenceSignal)(payload);
        const tracks = (0, tracker_1.updateTracks)(payload);
        const event = (0, riskCalculator_1.calculateRisk)(payload, tracks, 'mqtt');
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
                full: counts.full
            },
            risk_event: event
        };
        if (event && (event.risk_level === 'ALTO' || event.risk_level === 'CRITICO')) {
            await (0, eventStore_1.saveEvent)(event);
        }
        io.emit('snapshot', snapshot);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        console.error('[MQTT] Error procesando payload:', message);
    }
});
io.on('connection', (socket) => {
    console.log(`[WS] Cliente conectado: ${socket.id}`);
    socket.emit('message', { text: 'Conectado al sistema de seguridad vial inteligente.' });
    const defaultDevice = {
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
        }
        else {
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
    socket.on('fence_update', (payload) => {
        if (!isRecord(payload))
            return;
        const active = payload.active !== false;
        if (!active) {
            if (latestFenceUpdate?.triggeredBy && latestFenceUpdate.triggeredBy !== socket.id)
                return;
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
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
            return;
        const source = typeof payload.source === 'string' ? payload.source : 'qr';
        const radiusMeters = 50;
        const nowIso = new Date().toISOString();
        let expiresAt = null;
        if (typeof payload.expiresAt === 'string') {
            const ts = new Date(payload.expiresAt).getTime();
            if (Number.isFinite(ts) && ts > Date.now()) {
                expiresAt = new Date(ts).toISOString();
            }
        }
        const envelope = {
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
    socket.on('device_hello', (payload) => {
        const current = connectedDevices.get(socket.id);
        if (!current || !isRecord(payload))
            return;
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
    socket.on('location_update', (payload) => {
        const current = connectedDevices.get(socket.id);
        if (!current || !isRecord(payload))
            return;
        const gpsPayload = isRecord(payload.gps) ? payload.gps : null;
        const lat = typeof gpsPayload?.lat === 'number' ? gpsPayload.lat : NaN;
        const lng = typeof gpsPayload?.lng === 'number' ? gpsPayload.lng : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
            return;
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
server.listen(env_1.env.port, () => {
    const protocol = certExists ? 'https' : 'http';
    const port = env_1.env.port;
    // Recopilar IPs de red (LAN_IP env tiene prioridad)
    const lanIpEnv = (process.env.LAN_IP || '').trim();
    const networkIps = [];
    if (lanIpEnv)
        networkIps.push(lanIpEnv);
    Object.values(os_1.default.networkInterfaces()).forEach((entries) => {
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
