import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify/sync';
import { NearMissEvent } from '../types';
import { aggregateStats } from './statsService';

const reportsDir = path.resolve(process.cwd(), '../data/reports');

function ensureReportsDir() {
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
}

export function exportEventsToCsv(events: NearMissEvent[]): string {
  ensureReportsDir();
  const fileName = `near-miss-${Date.now()}.csv`;
  const filePath = path.join(reportsDir, fileName);
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
  const csv = stringify(rows, { header: true });
  fs.writeFileSync(filePath, csv, 'utf-8');
  return filePath;
}

export function exportDailyPdf(events: NearMissEvent[]): Promise<string> {
  ensureReportsDir();
  const fileName = `reporte-diario-${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  const stats = aggregateStats(events);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filePath);
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
