import fs from 'fs';
import path from 'path';

const classes = ['peaton', 'motocicleta', 'automovil', 'bus_transcaribe', 'ciclista'] as const;

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomDetection(trackId: string) {
  const className = classes[Math.floor(Math.random() * classes.length)];
  return {
    track_id: trackId,
    class_name: className,
    confidence: Number(rand(0.72, 0.98).toFixed(2)),
    bbox: {
      x: Number(rand(100, 1200).toFixed(1)),
      y: Number(rand(120, 620).toFixed(1)),
      width: Number(rand(40, 160).toFixed(1)),
      height: Number(rand(60, 220).toFixed(1))
    }
  };
}

function generateFrames(totalFrames = 80) {
  const now = Date.now();
  const frames = [];
  for (let i = 0; i < totalFrames; i++) {
    const detCount = Math.floor(rand(4, 12));
    const detections = Array.from({ length: detCount }, (_, d) => randomDetection(`${d + 1}`));

    frames.push({
      camera_id: 'cam-001-cartagena-centro',
      timestamp: new Date(now + i * 200).toISOString(),
      gps: { lat: 10.4236, lng: -75.5457 },
      frame_size: { width: 1280, height: 720 },
      crosswalk_polygon: [
        { x: 520, y: 380 },
        { x: 880, y: 380 },
        { x: 980, y: 580 },
        { x: 470, y: 580 }
      ],
      detections
    });
  }
  return frames;
}

const outputPath = path.resolve(process.cwd(), '../data/sample-sensecraft-json.json');
const data = generateFrames();
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Mock generado en ${outputPath} con ${data.length} frames.`);
