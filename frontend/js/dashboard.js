const API_BASE = 'http://localhost:4000/api';
const socket = io('http://localhost:4000');
const DEFAULT_GPS = { lat: 10.4236, lng: -75.5457 };
const CAMERA_ID = 'cam-pc-live-001';
const DETECTION_ENGINE = 'sensecraft';
const MODEL_TIMEOUT_MS = 15000;

const messages = [
  'La vida del peatón es sagrada.',
  'Respeta la cebra, salva vidas.',
  'Baja la velocidad: una decisión puede salvar una familia.',
  'Sistema Seguro: el error humano no debe costar vidas.'
];

const CLASS_MAP = {
  person: 'peaton',
  car: 'automovil',
  truck: 'automovil',
  bus: 'bus_transcaribe',
  motorcycle: 'motocicleta',
  bicycle: 'bicicleta',
  stop_sign: 'senal_paso',
  'stop sign': 'senal_paso'
};

const ANIMAL_CLASSES = new Set(['cat', 'dog', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe']);
const SPECIAL_EVENTS = new Set(['bus_transcaribe', 'bicicleta', 'senal_paso', 'ambulancia', 'animal']);

const CLASS_COLORS = {
  peaton: '#22c55e',
  automovil: '#38bdf8',
  bus_transcaribe: '#f97316',
  motocicleta: '#eab308',
  bicicleta: '#60a5fa',
  senal_paso: '#e2e8f0',
  animal: '#c084fc',
  ambulancia: '#67e8f9'
};

let hourlyChart;
let vehicleChart;
let cameraStream;
let currentGps = { ...DEFAULT_GPS };
const realtimeSeries = [];
const REALTIME_WINDOW = 60;

let detector = null;
let isRunning = false;
let frameClock = 0;
let nextTrackId = 1;
let tracks = [];
let lastEmittedEvents = [];
let lastIngestMs = 0;
const eventCooldown = new Map();

const riskPill = document.getElementById('riskPill');
const riskDetails = document.getElementById('riskDetails');
const eventList = document.getElementById('eventList');
const modelCounts = document.getElementById('modelCounts');
const cameraVideo = document.getElementById('cameraVideo');
const cameraCanvas = document.getElementById('cameraCanvas');
const cameraStatus = document.getElementById('cameraStatus');
const visionRtStatus = document.getElementById('visionRtStatus');
const objectsLiveList = document.getElementById('objectsLiveList');
const liveBadges = document.getElementById('liveBadges');
const liveEngine = document.getElementById('liveEngine');
const liveRisk = document.getElementById('liveRisk');
const liveObjCount = document.getElementById('liveObjCount');
const liveTTC = document.getElementById('liveTTC');
const livePET = document.getElementById('livePET');
const liveVRel = document.getElementById('liveVRel');
const vehicleTableBody = document.getElementById('vehicleTableBody');
const cameraCtx = cameraCanvas.getContext('2d');
const cropCanvas = document.createElement('canvas');
const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });

const mapAdapter = new window.MapAdapter({
  north: 10.4265,
  south: 10.4203,
  east: -75.5402,
  west: -75.5498
});

function withTimeout(promise, timeoutMs, msg) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function showStartupError(error) {
  let message = 'Error desconocido durante el arranque de visión.';
  if (error?.name === 'NotAllowedError') {
    message = 'Permiso de cámara denegado (NotAllowedError).';
  } else if (error?.name === 'NotFoundError') {
    message = 'No se encontró cámara disponible (NotFoundError).';
  } else if ((error?.message || '').includes('timeout')) {
    message = error.message;
  } else if ((error?.message || '').toLowerCase().includes('brave')) {
    message = 'Brave Shields bloqueó scripts del modelo. Desactiva Shields para localhost.';
  } else if (error?.message) {
    message = error.message;
  }

  visionRtStatus.textContent = message;
  cameraStatus.textContent = message;
  alert(message);
}

function ensureSecureContext() {
  const host = location.hostname;
  if (window.isSecureContext || host === 'localhost' || host === '127.0.0.1') {
    return;
  }
  throw new Error('Contexto no seguro. Usa http://localhost:4000');
}

async function detectLocation() {
  if (!navigator.geolocation) return;
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000
      });
    });
    currentGps = { lat: position.coords.latitude, lng: position.coords.longitude };
    if (window.setMapFocus) {
      window.setMapFocus(currentGps.lat, currentGps.lng, 'Ubicación actual del equipo');
    }
  } catch {
    currentGps = { ...DEFAULT_GPS };
  }
}

function riskView(level) {
  const map = {
    BAJO: { cls: 'risk-bajo', emoji: '🟢' },
    MEDIO: { cls: 'risk-medio', emoji: '🟡' },
    ALTO: { cls: 'risk-alto', emoji: '🟠' },
    CRITICO: { cls: 'risk-critico', emoji: '🔴' }
  };
  return map[level] || map.BAJO;
}

function playBeep() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = 880;
  gain.gain.value = 0.07;
  osc.start();
  osc.stop(audioCtx.currentTime + 0.16);
}

function speakAlert(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-CO';
  speechSynthesis.speak(utterance);
}

function resizeCanvasToDisplay() {
  const rect = cameraCanvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (cameraCanvas.width !== width || cameraCanvas.height !== height) {
    cameraCanvas.width = width;
    cameraCanvas.height = height;
  }
}

function getVideoToCanvasTransform() {
  const videoW = Math.max(1, cameraVideo.videoWidth || 1);
  const videoH = Math.max(1, cameraVideo.videoHeight || 1);
  const canvasW = Math.max(1, cameraCanvas.width || 1);
  const canvasH = Math.max(1, cameraCanvas.height || 1);
  const scale = Math.max(canvasW / videoW, canvasH / videoH);
  const renderW = videoW * scale;
  const renderH = videoH * scale;
  const offsetX = (canvasW - renderW) / 2;
  const offsetY = (canvasH - renderH) / 2;
  return { videoW, videoH, canvasW, canvasH, scale, offsetX, offsetY };
}

function videoBboxToCanvasBbox(bbox, transform) {
  return {
    x: bbox.x * transform.scale + transform.offsetX,
    y: bbox.y * transform.scale + transform.offsetY,
    w: bbox.w * transform.scale,
    h: bbox.h * transform.scale
  };
}

function canvasBboxToVideoBbox(bbox, transform) {
  return {
    x: (bbox.x - transform.offsetX) / transform.scale,
    y: (bbox.y - transform.offsetY) / transform.scale,
    w: bbox.w / transform.scale,
    h: bbox.h / transform.scale
  };
}

function toVideoPixelBbox(bbox, videoW, videoH) {
  const input = Array.isArray(bbox)
    ? { x: bbox[0], y: bbox[1], w: bbox[2], h: bbox[3] }
    : {
      x: bbox?.x ?? bbox?.left ?? 0,
      y: bbox?.y ?? bbox?.top ?? 0,
      w: bbox?.w ?? bbox?.width ?? 0,
      h: bbox?.h ?? bbox?.height ?? 0
    };

  const isNormalized = input.x <= 1.2 && input.y <= 1.2 && input.w <= 1.2 && input.h <= 1.2;
  if (isNormalized) {
    return { x: input.x * videoW, y: input.y * videoH, w: input.w * videoW, h: input.h * videoH };
  }
  return input;
}

function clampBboxToCanvas(bbox) {
  const maxW = cameraCanvas.width;
  const maxH = cameraCanvas.height;
  const x = Math.max(0, Math.min(maxW, bbox.x));
  const y = Math.max(0, Math.min(maxH, bbox.y));
  const w = Math.max(0, Math.min(maxW - x, bbox.w));
  const h = Math.max(0, Math.min(maxH - y, bbox.h));
  return { x, y, w, h };
}

function refineBboxForClass(classType, bbox) {
  const profiles = {
    peaton: { sx: 0.82, sy: 0.9, yBias: 0.05 },
    automovil: { sx: 0.9, sy: 0.8, yBias: 0.04 },
    bus_transcaribe: { sx: 0.94, sy: 0.78, yBias: 0.04 },
    motocicleta: { sx: 0.86, sy: 0.84, yBias: 0.03 },
    bicicleta: { sx: 0.88, sy: 0.86, yBias: 0.03 },
    ambulancia: { sx: 0.92, sy: 0.8, yBias: 0.04 },
    animal: { sx: 0.9, sy: 0.88, yBias: 0.02 }
  };

  const p = profiles[classType] || { sx: 0.9, sy: 0.9, yBias: 0 };
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const w = bbox.w * p.sx;
  const h = bbox.h * p.sy;
  return { x: cx - w / 2, y: cy - h / 2 + bbox.h * p.yBias, w, h };
}

function normalizeClass(rawClass) {
  const key = String(rawClass || '').toLowerCase();
  if (ANIMAL_CLASSES.has(key)) return 'animal';
  return CLASS_MAP[key] || 'automovil';
}

function centerOf(bbox) {
  return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

function speedPxPerSec(v) {
  return Math.sqrt(v.vx * v.vx + v.vy * v.vy);
}

class SenseCraftDetector {
  constructor() {
    this.detector = null;
    this.name = 'compat coco-ssd';
  }

  async init() {
    if (typeof window.tf === 'undefined') {
      throw new Error('TensorFlow.js no cargó. Verifica bloqueos de navegador.');
    }

    try {
      if (DETECTION_ENGINE === 'sensecraft' && window.sensecraft?.createDetector) {
        this.detector = await window.sensecraft.createDetector({ task: 'object-detection' });
        this.name = 'SenseCraft SDK';
        return;
      }

      if (DETECTION_ENGINE === 'sensecraft' && window.SenseCraft?.createDetector) {
        this.detector = await window.SenseCraft.createDetector({ task: 'object-detection' });
        this.name = 'SenseCraft SDK';
        return;
      }
    } catch {
      this.detector = null;
    }

    if (!window.cocoSsd) {
      throw new Error('coco-ssd no cargó. Brave Shields puede estar bloqueando scripts.');
    }

    this.detector = await window.cocoSsd.load({ base: 'mobilenet_v2' });
    this.name = 'coco-ssd mobilenet_v2';
  }

  normalizeDetections(raw) {
    const list = Array.isArray(raw) ? raw : raw?.detections || [];
    return list.map((entry) => {
      const klass = entry.class || entry.class_name || entry.label || entry.category || entry.name;
      const score = entry.score ?? entry.confidence ?? entry.probability ?? 0;
      const bbox = entry.bbox || entry.box || entry.rect;
      const packed = toVideoPixelBbox(bbox, cameraVideo.videoWidth || 1, cameraVideo.videoHeight || 1);
      return {
        class: klass,
        score,
        bbox: [packed.x, packed.y, packed.w, packed.h]
      };
    }).filter(Boolean);
  }

  async detect(videoElement) {
    if (!this.detector) return [];
    if (this.detector.detect) return this.normalizeDetections(await this.detector.detect(videoElement));
    if (this.detector.predict) return this.normalizeDetections(await this.detector.predict(videoElement));
    if (this.detector.infer) return this.normalizeDetections(await this.detector.infer(videoElement));
    return [];
  }
}

function updateTracks(detections, nowMs) {
  const active = tracks.filter((track) => nowMs - track.lastSeenMs < 1200);
  const candidates = [];

  for (let ti = 0; ti < active.length; ti += 1) {
    for (let di = 0; di < detections.length; di += 1) {
      const track = active[ti];
      const det = detections[di];
      const d = distance(centerOf(track.bbox), centerOf(det.bbox));
      const dNorm = d / Math.max(1, Math.hypot(cameraCanvas.width, cameraCanvas.height));
      const overlap = iou(track.bbox, det.bbox);
      const classPenalty = track.classType === det.classType ? 0 : 0.25;
      candidates.push({ ti, di, cost: dNorm + (1 - overlap) + classPenalty });
    }
  }

  candidates.sort((a, b) => a.cost - b.cost);
  const usedT = new Set();
  const usedD = new Set();

  candidates.forEach((c) => {
    if (c.cost > 1.35 || usedT.has(c.ti) || usedD.has(c.di)) return;
    usedT.add(c.ti);
    usedD.add(c.di);

    const t = active[c.ti];
    const d = detections[c.di];
    const dt = Math.max(0.016, (nowMs - t.lastSeenMs) / 1000);
    const prevCenter = centerOf(t.bbox);
    const currCenter = centerOf(d.bbox);
    const velocity = {
      vx: (currCenter.x - prevCenter.x) / dt,
      vy: (currCenter.y - prevCenter.y) / dt
    };

    const alpha = 0.55;
    const smooth = {
      x: t.bbox.x * (1 - alpha) + d.bbox.x * alpha,
      y: t.bbox.y * (1 - alpha) + d.bbox.y * alpha,
      w: t.bbox.w * (1 - alpha) + d.bbox.w * alpha,
      h: t.bbox.h * (1 - alpha) + d.bbox.h * alpha
    };

    t.bbox = smooth;
    t.center = centerOf(smooth);
    t.classType = d.classType;
    t.score = d.score;
    t.velocity = velocity;
    t.predicted = { x: t.center.x + velocity.vx * 0.45, y: t.center.y + velocity.vy * 0.45 };
    t.lastSeenMs = nowMs;
    t.trail.push(t.center);
    if (t.trail.length > 20) t.trail.shift();
  });

  detections.forEach((d, idx) => {
    if (usedD.has(idx)) return;
    const center = centerOf(d.bbox);
    active.push({
      id: `T${String(nextTrackId).padStart(4, '0')}`,
      classType: d.classType,
      score: d.score,
      bbox: d.bbox,
      center,
      velocity: { vx: 0, vy: 0 },
      predicted: { ...center },
      trail: [center],
      lastSeenMs: nowMs
    });
    nextTrackId += 1;
  });

  tracks = active;
}

function classifyRisk(ttc, pet, vRel, hasConflict) {
  let points = 0;
  if (hasConflict) points += 1;
  if (Number.isFinite(vRel) && vRel > 110) points += 1;
  if (Number.isFinite(ttc) && ttc < 2.5) points += 2;
  else if (Number.isFinite(ttc) && ttc < 5) points += 1;
  if (Number.isFinite(pet) && pet < 1.5) points += 2;
  else if (Number.isFinite(pet) && pet < 3) points += 1;

  if (points >= 5) return 'CRITICO';
  if (points >= 3) return 'ALTO';
  if (points >= 2) return 'MEDIO';
  return 'BAJO';
}

function computeRiskMetrics() {
  const pedestrians = tracks.filter((t) => t.classType === 'peaton');
  const threats = tracks.filter((t) => ['automovil', 'bus_transcaribe', 'motocicleta', 'bicicleta', 'ambulancia'].includes(t.classType));

  if (!pedestrians.length || !threats.length) {
    return { risk: 'BAJO', ttc: Infinity, pet: Infinity, vRel: 0 };
  }

  let pair = null;
  pedestrians.forEach((p) => {
    threats.forEach((v) => {
      const d = distance(p.center, v.center);
      if (!pair || d < pair.d) pair = { p, v, d };
    });
  });

  const vPed = speedPxPerSec(pair.p.velocity);
  const vVeh = speedPxPerSec(pair.v.velocity);
  const vRel = Math.abs(vVeh - vPed);
  const ttc = vRel > 0.001 ? pair.d / vRel : Infinity;

  const midpoint = {
    x: (pair.p.center.x + pair.v.center.x) / 2,
    y: (pair.p.center.y + pair.v.center.y) / 2
  };

  const tp = distance(pair.p.center, midpoint) / Math.max(1, vPed);
  const tv = distance(pair.v.center, midpoint) / Math.max(1, vVeh);
  const pet = Math.abs(tp - tv);
  const risk = classifyRisk(ttc, pet, vRel, true);

  return { risk, ttc, pet, vRel };
}

function formatNum(v, d = 2) {
  return Number.isFinite(v) ? Number(v).toFixed(d) : 'N/A';
}

function updateMainRiskUi(metrics) {
  const view = riskView(metrics.risk);
  riskPill.className = `risk-pill ${view.cls}`;
  riskPill.textContent = `${view.emoji} ${metrics.risk}`;
  riskDetails.textContent = `TTC ${formatNum(metrics.ttc)}s | PET ${formatNum(metrics.pet)}s | vRel ${formatNum(metrics.vRel, 1)} px/s`;

  liveRisk.textContent = metrics.risk;
  liveTTC.textContent = `${formatNum(metrics.ttc)}s`;
  livePET.textContent = `${formatNum(metrics.pet)}s`;
  liveVRel.textContent = `${formatNum(metrics.vRel, 1)} px/s`;

  if (metrics.risk === 'CRITICO') {
    playBeep();
    speakAlert('¡Atención! Riesgo crítico detectado, ceda el paso al peatón.');
  }
}

function updateKpisFromTracks() {
  const counters = {
    peaton: 0,
    motocicleta: 0,
    automovil: 0,
    bus_transcaribe: 0,
    bicicleta: 0,
    ciclista: 0,
    ambulancia: 0,
    senal_paso: 0,
    peaton_aereo: 0,
    movimiento_peaton: 0,
    aparcamiento: 0,
    animal: 0
  };

  tracks.forEach((t) => {
    counters[t.classType] = (counters[t.classType] || 0) + 1;
  });

  document.getElementById('kpiPeaton').textContent = counters.peaton || 0;
  document.getElementById('kpiMoto').textContent = counters.motocicleta || 0;
  document.getElementById('kpiAuto').textContent = (counters.automovil || 0) + (counters.ambulancia || 0);
  document.getElementById('kpiBus').textContent = counters.bus_transcaribe || 0;

  modelCounts.innerHTML = Object.keys(counters)
    .map((key) => `<div class="list-item">${key}: <b>${counters[key] || 0}</b></div>`)
    .join('');

  liveObjCount.textContent = String(tracks.length);

  return counters;
}

function renderVehicleTable(counters) {
  if (!vehicleTableBody) return;

  const rows = [
    { label: 'Automóvil', key: 'automovil' },
    { label: 'Bus/Transcaribe', key: 'bus_transcaribe' },
    { label: 'Motocicleta', key: 'motocicleta' },
    { label: 'Bicicleta', key: 'bicicleta' },
    { label: 'Ambulancia', key: 'ambulancia' }
  ];

  const total = rows.reduce((acc, row) => acc + (counters[row.key] || 0), 0);
  vehicleTableBody.innerHTML = rows
    .map((row) => {
      const value = counters[row.key] || 0;
      const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      return `<tr><td>${row.label}</td><td class="num">${value}</td><td class="num">${pct}%</td></tr>`;
    })
    .join('');
}

function riskToScore(risk) {
  if (risk === 'CRITICO') return 4;
  if (risk === 'ALTO') return 3;
  if (risk === 'MEDIO') return 2;
  return 1;
}

function updateRealtimeCharts(counters, metrics) {
  const now = new Date();
  const label = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const sample = {
    t: label,
    total: tracks.length,
    vehiculos: (counters.automovil || 0) + (counters.bus_transcaribe || 0) + (counters.motocicleta || 0) + (counters.ambulancia || 0),
    peatones: counters.peaton || 0,
    riesgo: riskToScore(metrics.risk)
  };

  const last = realtimeSeries[realtimeSeries.length - 1];
  if (!last || last.t !== sample.t) {
    realtimeSeries.push(sample);
    if (realtimeSeries.length > REALTIME_WINDOW) realtimeSeries.shift();
  } else {
    realtimeSeries[realtimeSeries.length - 1] = sample;
  }

  const labels = realtimeSeries.map((s) => s.t);
  const totalData = realtimeSeries.map((s) => s.total);
  const riskData = realtimeSeries.map((s) => s.riesgo);

  if (!hourlyChart) {
    hourlyChart = new Chart(document.getElementById('hourlyChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Objetos detectados (tiempo real)', data: totalData, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,.18)' },
          { label: 'Riesgo (1-4)', data: riskData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.18)' }
        ]
      },
      options: { animation: false, responsive: true }
    });
  } else {
    hourlyChart.data.labels = labels;
    hourlyChart.data.datasets[0].data = totalData;
    hourlyChart.data.datasets[1].data = riskData;
    hourlyChart.update('none');
  }

  const vehEntries = [
    ['automovil', counters.automovil || 0],
    ['bus_transcaribe', counters.bus_transcaribe || 0],
    ['motocicleta', counters.motocicleta || 0],
    ['bicicleta', counters.bicicleta || 0],
    ['ambulancia', counters.ambulancia || 0]
  ];

  if (!vehicleChart) {
    vehicleChart = new Chart(document.getElementById('vehicleChart'), {
      type: 'bar',
      data: {
        labels: vehEntries.map(([k]) => k),
        datasets: [{ label: 'Tipos vehiculares vistos ahora', data: vehEntries.map(([, v]) => v), backgroundColor: ['#38bdf8', '#f97316', '#eab308', '#60a5fa', '#67e8f9'] }]
      },
      options: { animation: false, responsive: true }
    });
  } else {
    vehicleChart.data.labels = vehEntries.map(([k]) => k);
    vehicleChart.data.datasets[0].data = vehEntries.map(([, v]) => v);
    vehicleChart.update('none');
  }
}

function renderObjectList() {
  objectsLiveList.innerHTML = tracks
    .map((t) => `<div class="list-item"><b>${t.id}</b> · ${t.classType} · ${(t.score * 100).toFixed(1)}%<br/><span style="color:var(--muted)">x:${t.bbox.x.toFixed(0)} y:${t.bbox.y.toFixed(0)} w:${t.bbox.w.toFixed(0)} h:${t.bbox.h.toFixed(0)}</span></div>`)
    .join('');
}

function addRealtimeBadge(label) {
  const now = Date.now();
  const key = label.toLowerCase();
  if ((eventCooldown.get(key) || 0) > now - 1800) return;
  eventCooldown.set(key, now);

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = `${new Date().toLocaleTimeString()} · ${label}`;
  liveBadges.prepend(badge);

  while (liveBadges.children.length > 16) {
    liveBadges.removeChild(liveBadges.lastChild);
  }
}

function drawTrack(track) {
  const color = CLASS_COLORS[track.classType] || '#ffffff';
  cameraCtx.strokeStyle = color;
  cameraCtx.lineWidth = 2;
  cameraCtx.strokeRect(track.bbox.x, track.bbox.y, track.bbox.w, track.bbox.h);

  cameraCtx.fillStyle = 'rgba(0,0,0,.6)';
  cameraCtx.fillRect(track.bbox.x, Math.max(0, track.bbox.y - 20), 220, 18);
  cameraCtx.fillStyle = color;
  cameraCtx.font = '12px Segoe UI';
  cameraCtx.fillText(`${track.id} · ${track.classType} · ${(track.score * 100).toFixed(0)}%`, track.bbox.x + 4, Math.max(11, track.bbox.y - 6));

  cameraCtx.strokeStyle = `${color}AA`;
  cameraCtx.beginPath();
  track.trail.forEach((p, idx) => {
    if (idx === 0) cameraCtx.moveTo(p.x, p.y);
    else cameraCtx.lineTo(p.x, p.y);
  });
  cameraCtx.stroke();

  cameraCtx.strokeStyle = `${color}88`;
  cameraCtx.beginPath();
  cameraCtx.moveTo(track.center.x, track.center.y);
  cameraCtx.lineTo(track.predicted.x, track.predicted.y);
  cameraCtx.stroke();
}

async function detectAmbulanceHeuristic(canvasBbox, transform) {
  const vbox = canvasBboxToVideoBbox(canvasBbox, transform);
  const c = {
    x: Math.max(0, Math.min(transform.videoW - 1, vbox.x)),
    y: Math.max(0, Math.min(transform.videoH - 1, vbox.y)),
    w: Math.max(1, Math.min(transform.videoW - vbox.x, vbox.w)),
    h: Math.max(1, Math.min(transform.videoH - vbox.y, vbox.h))
  };

  const sw = Math.max(24, Math.min(96, Math.round(c.w / 2)));
  const sh = Math.max(24, Math.min(96, Math.round(c.h / 2)));
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  cropCtx.drawImage(cameraVideo, c.x, c.y, c.w, c.h, 0, 0, sw, sh);

  const pixels = cropCtx.getImageData(0, 0, sw, sh).data;
  let red = 0;
  let white = 0;
  const total = sw * sh;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    if (r > 140 && r > g * 1.25 && r > b * 1.2) red += 1;
    if (max > 180 && max - min < 28) white += 1;
  }

  return (red / total) > 0.08 && (white / total) > 0.12;
}

function pushEventLine(text) {
  const item = document.createElement('div');
  item.className = 'list-item';
  item.textContent = text;
  eventList.prepend(item);
  while (eventList.children.length > 40) eventList.removeChild(eventList.lastChild);
}

function mapToObjectsEnvelope(metrics) {
  const canvasSize = { width: cameraCanvas.width, height: cameraCanvas.height };
  const objects = tracks.map((t) => mapAdapter.mapTrack(t, canvasSize));

  return window.VisionFrameSchema.buildObjectsEnvelope({
    cameraId: CAMERA_ID,
    timestamp: new Date().toISOString(),
    risk: metrics.risk,
    ttc: Number.isFinite(metrics.ttc) ? metrics.ttc : null,
    pet: Number.isFinite(metrics.pet) ? metrics.pet : null,
    vRel: metrics.vRel,
    objects,
    events: lastEmittedEvents
  });
}

function buildCrosswalkPolygon(videoWidth, videoHeight) {
  return [
    { x: videoWidth * 0.34, y: videoHeight * 0.53 },
    { x: videoWidth * 0.66, y: videoHeight * 0.53 },
    { x: videoWidth * 0.74, y: videoHeight * 0.9 },
    { x: videoWidth * 0.26, y: videoHeight * 0.9 }
  ];
}

function mapTrackClassToBackendClass(classType) {
  if (classType === 'peaton') return 'peaton';
  if (classType === 'motocicleta') return 'motocicleta';
  if (classType === 'automovil') return 'automovil';
  if (classType === 'bus_transcaribe') return 'bus_transcaribe';
  if (classType === 'bicicleta') return 'bicicleta';
  if (classType === 'animal') return 'movimiento_peaton';
  if (classType === 'senal_paso') return 'senal_paso';
  if (classType === 'ambulancia') return 'ambulancia';
  return 'automovil';
}

function toIngestPayload(transform) {
  const detections = tracks.slice(0, 25).map((t) => {
    const vb = canvasBboxToVideoBbox(t.bbox, transform);
    return {
      track_id: t.id,
      class_name: mapTrackClassToBackendClass(t.classType),
      confidence: t.score,
      bbox: {
        x: Math.max(0, vb.x),
        y: Math.max(0, vb.y),
        width: Math.max(1, vb.w),
        height: Math.max(1, vb.h)
      }
    };
  });

  return {
    camera_id: CAMERA_ID,
    timestamp: new Date().toISOString(),
    gps: currentGps,
    frame_size: {
      width: transform.videoW,
      height: transform.videoH
    },
    crosswalk_polygon: buildCrosswalkPolygon(transform.videoW, transform.videoH),
    detections
  };
}

async function emitRealtime(metrics, transform) {
  const statePayload = {
    cameraId: CAMERA_ID,
    timestamp: new Date().toISOString(),
    risk: metrics.risk,
    ttc: Number.isFinite(metrics.ttc) ? metrics.ttc : null,
    pet: Number.isFinite(metrics.pet) ? metrics.pet : null,
    vRel: metrics.vRel,
    objectCount: tracks.length
  };

  socket.emit('state_update', statePayload);
  const envelope = mapToObjectsEnvelope(metrics);
  socket.emit('objects_update', envelope);

  if (window.updateMapFromObjectsEnvelope) {
    window.updateMapFromObjectsEnvelope(envelope);
  }

  if (Date.now() - lastIngestMs > 1100 && tracks.length > 0) {
    lastIngestMs = Date.now();
    const payload = toIngestPayload(transform);
    fetch(`${API_BASE}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => null);
  }
}

async function processFrame(now) {
  if (!isRunning || !detector) return;

  if (now - frameClock < 90) {
    requestAnimationFrame(processFrame);
    return;
  }

  frameClock = now;
  resizeCanvasToDisplay();
  const transform = getVideoToCanvasTransform();

  let baseDetections = [];
  try {
    const rawDetections = await detector.detect(cameraVideo);
    baseDetections = rawDetections.map((entry) => {
      const vbox = toVideoPixelBbox(entry.bbox, transform.videoW, transform.videoH);
      let cbox = videoBboxToCanvasBbox(vbox, transform);
      let classType = normalizeClass(entry.class);
      cbox = refineBboxForClass(classType, cbox);
      cbox = clampBboxToCanvas(cbox);
      return { classType, score: entry.score || 0, bbox: cbox };
    });
  } catch {
    baseDetections = [];
  }

  for (const det of baseDetections) {
    if (det.classType === 'automovil' || det.classType === 'bus_transcaribe') {
      const isAmbulance = await detectAmbulanceHeuristic(det.bbox, transform);
      if (isAmbulance) det.classType = 'ambulancia';
    }
  }

  updateTracks(baseDetections, performance.now());

  lastEmittedEvents = [];
  tracks.forEach((t) => {
    if (SPECIAL_EVENTS.has(t.classType)) {
      const label = `${t.classType} detectado`;
      addRealtimeBadge(label);
      lastEmittedEvents.push({ type: t.classType, label, trackId: t.id });
    }
  });

  const metrics = computeRiskMetrics();
  updateMainRiskUi(metrics);
  const counters = updateKpisFromTracks();
  renderVehicleTable(counters);
  updateRealtimeCharts(counters, metrics);
  renderObjectList();

  cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);
  tracks.forEach(drawTrack);

  emitRealtime(metrics, transform);
  cameraStatus.textContent = `Cámara activa | ${detector.name} | Tracks: ${tracks.length}`;
  requestAnimationFrame(processFrame);
}

async function refreshStats() {}

function reportToCsv(report) {
  const reportClasses = [
    'peaton', 'peaton_aereo', 'movimiento_peaton', 'motocicleta',
    'automovil', 'bus_transcaribe', 'bicicleta', 'ciclista',
    'ambulancia', 'aparcamiento', 'senal_paso'
  ];

  const rows = [
    ['camera_id', ...reportClasses, 'active_tracks'].join(','),
    ...report.by_camera.map((camera) => [
      camera.camera_id,
      ...reportClasses.map((className) => camera.totals[className] || 0),
      camera.active_tracks
    ].join(',')),
    ['TOTAL', ...reportClasses.map((className) => report.totals[className] || 0), ''].join(',')
  ];
  return rows.join('\n');
}

async function downloadCameraReport() {
  const report = await fetch(`${API_BASE}/report/traffic`).then((res) => res.json());
  const csv = reportToCsv(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte-detecciones-camara-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function stopCameraMode() {
  isRunning = false;
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
  tracks = [];
  cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);
  cameraStatus.textContent = 'Cámara apagada.';
}

async function startCameraMode() {
  ensureSecureContext();
  await detectLocation();

  cameraStatus.textContent = 'Solicitando cámara...';
  cameraStream = await withTimeout(
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
      audio: false
    }),
    10000,
    'timeout al abrir cámara'
  );

  cameraVideo.srcObject = cameraStream;
  await cameraVideo.play();

  visionRtStatus.textContent = 'Cargando motor de detección...';
  detector = new SenseCraftDetector();
  await withTimeout(detector.init(), MODEL_TIMEOUT_MS, 'timeout modelo (15s) durante inicialización');

  liveEngine.textContent = detector.name;
  visionRtStatus.textContent = detector.name === 'SenseCraft SDK' ? 'motor SenseCraft listo' : 'motor SenseCraft en modo compat (coco-ssd)';

  isRunning = true;
  requestAnimationFrame(processFrame);
}

function wireUi() {
  document.getElementById('btnSimulate').addEventListener('click', () => window.simulateMultipleCameras());

  document.getElementById('btnOfflineMode').addEventListener('click', async () => {
    await fetch(`${API_BASE}/simulate/offline`, { method: 'POST' });
  });

  document.getElementById('btnStartCamera').addEventListener('click', () => {
    if (isRunning) return;
    startCameraMode().catch(showStartupError);
  });

  document.getElementById('btnStopCamera').addEventListener('click', stopCameraMode);

  document.getElementById('btnCameraReport').addEventListener('click', () => {
    downloadCameraReport().catch(() => null);
  });

  document.getElementById('btnCsv').addEventListener('click', () => {
    window.open(`${API_BASE}/export/csv`, '_blank');
  });

  document.getElementById('btnPdf').addEventListener('click', () => {
    window.open(`${API_BASE}/export/pdf`, '_blank');
  });

  const fireQr = () => {
    const label = 'QR simulado';
    addRealtimeBadge(label);
    lastEmittedEvents.push({ type: 'qr', label, at: new Date().toISOString() });
    pushEventLine(`${new Date().toLocaleTimeString()} | QR simulado | ${CAMERA_ID}`);
  };

  document.getElementById('btnSimQR').addEventListener('click', fireQr);
  window.addEventListener('keydown', (ev) => {
    if (ev.key.toLowerCase() === 'r') fireQr();
  });
}

socket.on('connect', () => {
  visionRtStatus.textContent = 'Socket conectado en localhost:4000 (modo unificado).';
});

socket.on('disconnect', () => {
  visionRtStatus.textContent = 'Socket desconectado. Verifica localhost:4000';
});

socket.on('snapshot', (snapshot) => {
  if (window.updateMapFromSnapshot) {
    window.updateMapFromSnapshot(snapshot);
  }
  if (snapshot?.risk_event) {
    pushEventLine(`${new Date(snapshot.timestamp).toLocaleTimeString()} | ${snapshot.risk_event.risk_level} | ${snapshot.camera_id}`);
  }
  refreshStats().catch(() => null);
});

socket.on('objects_update', (envelope) => {
  if (!envelope || !Array.isArray(envelope.objects)) return;
  if (window.updateMapFromObjectsEnvelope) {
    window.updateMapFromObjectsEnvelope(envelope);
  }

  if (Array.isArray(envelope.events) && envelope.events.length) {
    envelope.events.forEach((evt) => {
      pushEventLine(`${new Date(envelope.timestamp || Date.now()).toLocaleTimeString()} | ${evt.label || evt.type} | ${envelope.cameraId || 'cam'}`);
    });
  }
});

setInterval(() => {
  const msg = messages[Math.floor(Math.random() * messages.length)];
  document.getElementById('ansvMessage').textContent = msg;
}, 8000);

window.initMap();
wireUi();
detectLocation().catch(() => null);
refreshStats().catch(() => null);

startCameraMode().catch(showStartupError);
