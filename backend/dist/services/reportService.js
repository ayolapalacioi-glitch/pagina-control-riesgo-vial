"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportEventsToCsv = exportEventsToCsv;
exports.exportDailyPdf = exportDailyPdf;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const sync_1 = require("csv-stringify/sync");
const statsService_1 = require("./statsService");
const reportsDir = path_1.default.resolve(process.cwd(), '../data/reports');
function ensureReportsDir() {
    if (!fs_1.default.existsSync(reportsDir))
        fs_1.default.mkdirSync(reportsDir, { recursive: true });
}
function exportEventsToCsv(events) {
    ensureReportsDir();
    const fileName = `near-miss-${Date.now()}.csv`;
    const filePath = path_1.default.join(reportsDir, fileName);
    const rows = events.map((event) => ({
        event_id: event.event_id,
        timestamp: event.timestamp,
        camera_id: event.camera_id,
        lat: event.gps.lat,
        lng: event.gps.lng,
        risk_level: event.risk_level,
        ttc_seconds: event.ttc_seconds,
        pet_seconds: event.pet_seconds,
        vehicle: event.vehicle?.className,
        vehicle_speed_kmh: event.vehicle?.speedKmh,
        pedestrian: event.pedestrian?.className
    }));
    const csv = (0, sync_1.stringify)(rows, { header: true });
    fs_1.default.writeFileSync(filePath, csv, 'utf-8');
    return filePath;
}
function exportDailyPdf(events) {
    ensureReportsDir();
    const fileName = `reporte-diario-${Date.now()}.pdf`;
    const filePath = path_1.default.join(reportsDir, fileName);
    const stats = (0, statsService_1.aggregateStats)(events);
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ margin: 40 });
        const stream = fs_1.default.createWriteStream(filePath);
        doc.pipe(stream);
        doc.fontSize(18).text('Reporte Diario - Seguridad Vial Inteligente', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text('Tecnología al servicio de la vida - Sistema Seguro / Visión Cero');
        doc.moveDown();
        doc.text(`Total eventos near-miss: ${stats.totalEvents}`);
        doc.text(`Riesgo crítico: ${stats.riskCount.CRITICO}`);
        doc.text(`Riesgo alto: ${stats.riskCount.ALTO}`);
        doc.text(`Riesgo medio: ${stats.riskCount.MEDIO}`);
        doc.text(`Riesgo bajo: ${stats.riskCount.BAJO}`);
        doc.moveDown();
        doc.text('Eventos más recientes:', { underline: true });
        events.slice(-8).reverse().forEach((event) => {
            doc.text(`- ${event.timestamp} | Cam: ${event.camera_id} | Riesgo: ${event.risk_level} | TTC: ${event.ttc_seconds?.toFixed(2) ?? 'N/A'}s`);
        });
        doc.end();
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
}
