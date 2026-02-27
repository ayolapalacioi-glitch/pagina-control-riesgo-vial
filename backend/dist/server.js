"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const env_1 = require("./config/env");
const apiRoutes_1 = require("./routes/apiRoutes");
const mqtt_1 = require("./config/mqtt");
const ingestController_1 = require("./controllers/ingestController");
const tracker_1 = require("./services/tracker");
const riskCalculator_1 = require("./services/riskCalculator");
const eventStore_1 = require("./services/eventStore");
const trafficCounter_1 = require("./services/trafficCounter");
const counts_1 = require("./services/counts");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
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
app.use('/api', (0, apiRoutes_1.buildApiRoutes)(io));
app.get('/vision', (_req, res) => {
    res.sendFile(path_1.default.resolve(process.cwd(), '../vision-rt/index.html'));
});
(0, mqtt_1.createMqttClient)(async (_topic, rawMessage) => {
    try {
        const payload = (0, ingestController_1.validatePayload)(JSON.parse(rawMessage));
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
server.listen(env_1.env.port, () => {
    console.log(`Backend activo en http://localhost:${env_1.env.port}`);
});
