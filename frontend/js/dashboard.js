const API_BASE = `${window.location.origin}/api`;
const socket = io(window.location.origin);

const DEFAULT_GPS = { lat: 10.4236, lng: -75.5457 };
const CAMERA_ID = 'cam-pc-live-001';
const FENCE_RADIUS_METERS = 50;
const FENCE_TTL_MS = 180000;
const INFER_INTERVAL_MS = 230;

const messages = [
  'La vida del peaton es sagrada.',
  'Respeta la cebra, salva vidas.',
  'Baja la velocidad: una decision puede salvar una familia.',
  'Sistema Seguro: el error humano no debe costar vidas.'
];

let hourlyChart = null;
let vehicleChart = null;
let cameraStream = null;
let currentGps = { ...DEFAULT_GPS };
let geolocationWatchId = null;

let isRunning = false;
let inferenceInFlight = false;
let lastInferAt = 0;
let lastFrameSize = { width: 1280, height: 720 };
let fenceOwnedByThisClient = false;
let fenceSyncTimer = null;

const realtimeSeries = [];
const REALTIME_WINDOW = 60;

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
const qrLinkBox = document.getElementById('qrLinkBox');
const devicesCount = document.getElementById('devicesCount');
const devicesList = document.getElementById('devicesList');
const cameraCtx = cameraCanvas.getContext('2d');

const captureCanvas = document.createElement('canvas');
const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });

function riskView(level) {
  const map = {
    BAJO: { cls: 'risk-bajo', emoji: '🟢' },
    MEDIO: { cls: 'risk-medio', emoji: '🟡' },
    ALTO: { cls: 'risk-alto', emoji: '🟠' },
    CRITICO: { cls: 'risk-critico', emoji: '🔴' }
  };
  return map[level] || map.BAJO;
}

function formatNum(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : 'N/A';
}

function pushEventLine(text) {
  const item = document.createElement('div');
  item.className = 'list-item';
  item.textContent = text;
  eventList.prepend(item);
  while (eventList.children.length > 40) {
    eventList.removeChild(eventList.lastChild);
  }
}

function addRealtimeBadge(label) {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = `${new Date().toLocaleTimeString()} · ${label}`;
  liveBadges.prepend(badge);
  while (liveBadges.children.length > 16) {
    liveBadges.removeChild(liveBadges.lastChild);
  }
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
  const offsetX = (canvasW - videoW * scale) / 2;
  const offsetY = (canvasH - videoH * scale) / 2;
  return { videoW, videoH, scale, offsetX, offsetY };
}

function videoBboxToCanvasBbox(bbox, sourceFrameSize, transform) {
  const sx = transform.videoW / Math.max(1, sourceFrameSize.width);
  const sy = transform.videoH / Math.max(1, sourceFrameSize.height);
  const x = bbox.x * sx;
  const y = bbox.y * sy;
  const w = bbox.w * sx;
  const h = bbox.h * sy;

  return {
    x: x * transform.scale + transform.offsetX,
    y: y * transform.scale + transform.offsetY,
    w: w * transform.scale,
    h: h * transform.scale
  };
}

function renderConnectedDevices(payload) {
  const total = Number(payload?.total) || 0;
  const devices = Array.isArray(payload?.devices) ? payload.devices : [];

  devicesCount.textContent = `${total} conectados`;
  devicesList.innerHTML = devices
    .map((item) => {
      const name = item.displayName || 'Dispositivo';
      const kind = item.kind || 'unknown';
      const gps = item.gps && typeof item.gps.lat === 'number' && typeof item.gps.lng === 'number'
        ? `${item.gps.lat.toFixed(5)}, ${item.gps.lng.toFixed(5)}`
        : 'sin ubicacion';
      return `<div class="list-item"><b>${name}</b> · ${kind}<br/><span style="color:var(--muted)">${gps}</span></div>`;
    })
    .join('');
}

function updateVehicleTable(counters) {
  const rows = [
    { label: 'Automovil', key: 'automovil' },
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

function updateCharts(counters, metrics, trackCount) {
  const now = new Date();
  const label = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const sample = {
    t: label,
    total: trackCount,
    riesgo: metrics.risk === 'CRITICO' ? 4 : metrics.risk === 'ALTO' ? 3 : metrics.risk === 'MEDIO' ? 2 : 1
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
          { label: 'Objetos detectados', data: totalData, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,.18)' },
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
        datasets: [{ label: 'Tipos vehiculares', data: vehEntries.map(([, v]) => v), backgroundColor: ['#38bdf8', '#f97316', '#eab308', '#60a5fa', '#67e8f9'] }]
      },
      options: { animation: false, responsive: true }
    });
  } else {
    vehicleChart.data.labels = vehEntries.map(([k]) => k);
    vehicleChart.data.datasets[0].data = vehEntries.map(([, v]) => v);
    vehicleChart.update('none');
  }
}

function updateRiskUi(metrics) {
  const view = riskView(metrics.risk);
  riskPill.className = `risk-pill ${view.cls}`;
  riskPill.textContent = `${view.emoji} ${metrics.risk}`;
  riskDetails.textContent = `TTC ${formatNum(metrics.ttc)}s | PET ${formatNum(metrics.pet)}s | vRel ${formatNum(metrics.vRel, 1)} px/s`;

  liveRisk.textContent = metrics.risk;
  liveTTC.textContent = `${formatNum(metrics.ttc)}s`;
  livePET.textContent = `${formatNum(metrics.pet)}s`;
  liveVRel.textContent = `${formatNum(metrics.vRel, 1)} px/s`;
}

function drawTracks(tracks) {
  resizeCanvasToDisplay();
  cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);

  const transform = getVideoToCanvasTransform();
  tracks.forEach((track) => {
    if (!track?.bbox) return;
    const cb = videoBboxToCanvasBbox(track.bbox, lastFrameSize, transform);
    cameraCtx.strokeStyle = '#22c55e';
    cameraCtx.lineWidth = 2;
    cameraCtx.strokeRect(cb.x, cb.y, cb.w, cb.h);

    cameraCtx.fillStyle = 'rgba(0,0,0,.6)';
    cameraCtx.fillRect(cb.x, Math.max(0, cb.y - 20), 220, 18);
    cameraCtx.fillStyle = '#22c55e';
    cameraCtx.font = '12px Segoe UI';
    cameraCtx.fillText(`${track.id} · ${track.classType} · ${((track.score || 0) * 100).toFixed(0)}%`, cb.x + 4, Math.max(11, cb.y - 6));
  });
}

function renderTracksList(tracks) {
  objectsLiveList.innerHTML = tracks
    .map((t) => `<div class="list-item"><b>${t.id}</b> · ${t.classType} · ${((t.score || 0) * 100).toFixed(1)}%</div>`)
    .join('');
}

function updateCounters(snapshot, tracks) {
  const counts = snapshot?.counts?.full || {};
  document.getElementById('kpiPeaton').textContent = counts.peaton || 0;
  document.getElementById('kpiMoto').textContent = counts.motocicleta || 0;
  document.getElementById('kpiAuto').textContent = (counts.automovil || 0) + (counts.ambulancia || 0);
  document.getElementById('kpiBus').textContent = counts.bus_transcaribe || 0;

  modelCounts.innerHTML = Object.keys(counts)
    .map((key) => `<div class="list-item">${key}: <b>${counts[key] || 0}</b></div>`)
    .join('');

  liveObjCount.textContent = String(tracks.length);
  updateVehicleTable(counts);
  return counts;
}

function ensureSecureContext() {
  const host = location.hostname;
  if (window.isSecureContext || host === 'localhost' || host === '127.0.0.1') {
    return;
  }
  throw new Error(`Contexto no seguro. Abre en HTTPS o en origen local valido: ${window.location.origin}`);
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
    socket.emit('location_update', { gps: currentGps });
    if (window.setMapFocus) {
      window.setMapFocus(currentGps.lat, currentGps.lng, 'Ubicacion actual del equipo');
    }
  } catch {
    currentGps = { ...DEFAULT_GPS };
  }
}

function startLocationWatch() {
  if (!navigator.geolocation || geolocationWatchId !== null) return;
  geolocationWatchId = navigator.geolocation.watchPosition((position) => {
    currentGps = { lat: position.coords.latitude, lng: position.coords.longitude };
    socket.emit('location_update', { gps: currentGps });
    if (window.setMapFocus) {
      window.setMapFocus(currentGps.lat, currentGps.lng, 'Ubicacion actual del equipo');
    }
  }, () => null, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 2000
  });
}

function stopLocationWatch() {
  if (!navigator.geolocation || geolocationWatchId === null) return;
  navigator.geolocation.clearWatch(geolocationWatchId);
  geolocationWatchId = null;
}

function emitFenceUpdate(source = 'qr', active = true) {
  const now = Date.now();
  socket.emit('fence_update', {
    active,
    source,
    cameraId: CAMERA_ID,
    gps: currentGps,
    radiusMeters: FENCE_RADIUS_METERS,
    expiresAt: active ? new Date(now + FENCE_TTL_MS).toISOString() : null
  });
}

function startFenceRealtimeSync(source = 'qr') {
  fenceOwnedByThisClient = true;
  emitFenceUpdate(source, true);

  if (fenceSyncTimer) clearInterval(fenceSyncTimer);
  fenceSyncTimer = setInterval(() => {
    if (!fenceOwnedByThisClient || !socket.connected) return;
    emitFenceUpdate('device_location', true);
  }, 1500);
}

function stopFenceRealtimeSync(source = 'manual') {
  fenceOwnedByThisClient = false;
  if (fenceSyncTimer) {
    clearInterval(fenceSyncTimer);
    fenceSyncTimer = null;
  }
  emitFenceUpdate(source, false);
}

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

function renderQrGraphic(targetId, text) {
  const container = document.getElementById(targetId);
  if (!container) return;
  container.innerHTML = '';

  if (window.QRCode) {
    new window.QRCode(container, {
      text,
      width: 210,
      height: 210,
      colorDark: '#111827',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : undefined
    });
    return;
  }

  const fallbackImg = document.createElement('img');
  fallbackImg.alt = 'QR de enlace';
  fallbackImg.width = 210;
  fallbackImg.height = 210;
  fallbackImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=210x210&data=${encodeURIComponent(text)}`;
  container.appendChild(fallbackImg);
}

async function renderQrLinks() {
  if (!qrLinkBox) return;
  const payload = await fetch(`${API_BASE}/network-qr`).then((res) => res.json());
  const primary = payload?.primary || `${window.location.origin}/viewer.html?qr=1`;

  qrLinkBox.style.display = 'block';
  qrLinkBox.innerHTML = `
    <h4 style="margin:0 0 8px 0;">QR multi-dispositivo</h4>
    <div style="font-size:.9rem; color:var(--muted); margin-bottom:8px;">Escanea este QR desde tu celular para abrir el visor.</div>
    <div id="qrCodeCanvas" style="margin:0 0 10px 0; display:flex; justify-content:center;"></div>
    <div style="word-break:break-all; margin-bottom:8px;"><b id="qrPrimaryText">${primary}</b></div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
      <button id="btnCopyQrLink">Copiar enlace</button>
    </div>
  `;

  renderQrGraphic('qrCodeCanvas', primary);

  const copyBtn = document.getElementById('btnCopyQrLink');
  copyBtn?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(primary);
    addRealtimeBadge('Enlace QR copiado');
  });
}

async function inferFrame() {
  if (!isRunning || inferenceInFlight || !cameraVideo.videoWidth || !cameraVideo.videoHeight) return;
  const now = Date.now();
  if (now - lastInferAt < INFER_INTERVAL_MS) return;

  inferenceInFlight = true;
  lastInferAt = now;

  try {
    const width = cameraVideo.videoWidth;
    const height = cameraVideo.videoHeight;
    lastFrameSize = { width, height };

    captureCanvas.width = width;
    captureCanvas.height = height;
    captureCtx.drawImage(cameraVideo, 0, 0, width, height);

    const imageBase64 = captureCanvas.toDataURL('image/jpeg', 0.65);

    const response = await fetch(`${API_BASE}/vision/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        camera_id: CAMERA_ID,
        timestamp: new Date().toISOString(),
        gps: currentGps,
        frame_size: lastFrameSize,
        image_base64: imageBase64
      })
    });

    if (!response.ok) {
      throw new Error(`Fallo inferencia backend (${response.status})`);
    }

    const result = await response.json();
    const tracks = Array.isArray(result.tracks) ? result.tracks : [];
    const snapshot = result.snapshot || null;
    const metrics = result.metrics || { risk: 'BAJO', ttc: null, pet: null, vRel: 0 };

    updateRiskUi(metrics);
    const counts = updateCounters(snapshot, tracks);
    updateCharts(counts, metrics, tracks.length);
    renderTracksList(tracks);
    drawTracks(tracks);

    if (window.updateMapFromSnapshot && snapshot) {
      window.updateMapFromSnapshot(snapshot);
    }
    if (window.updateMapFromObjectsEnvelope && result.envelope) {
      window.updateMapFromObjectsEnvelope(result.envelope);
    }

    (result.events || []).forEach((evt) => {
      addRealtimeBadge(evt.label || evt.type || 'evento');
      pushEventLine(`${new Date().toLocaleTimeString()} | ${evt.label || evt.type} | ${CAMERA_ID}`);
    });

    cameraStatus.textContent = `Camara activa | YOLO backend | Tracks: ${tracks.length}`;
    liveEngine.textContent = 'YOLO Backend';
    visionRtStatus.textContent = 'Motor de vision en backend Python (YOLO).';
  } catch (error) {
    cameraStatus.textContent = String(error?.message || 'Error inferencia backend');
  } finally {
    inferenceInFlight = false;
  }
}

function processLoop() {
  if (!isRunning) return;
  inferFrame().finally(() => {
    if (isRunning) requestAnimationFrame(processLoop);
  });
}

async function startCameraMode() {
  ensureSecureContext();
  await detectLocation();

  cameraStatus.textContent = 'Solicitando camara...';
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
    audio: false
  });

  cameraVideo.srcObject = cameraStream;
  await cameraVideo.play();

  isRunning = true;
  requestAnimationFrame(processLoop);
}

function stopCameraMode() {
  isRunning = false;
  inferenceInFlight = false;

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  cameraVideo.srcObject = null;
  cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);
  cameraStatus.textContent = 'Camara apagada.';
}

function wireUi() {
  document.getElementById('btnSimulate').addEventListener('click', () => window.simulateMultipleCameras());

  document.getElementById('btnOfflineMode').addEventListener('click', async () => {
    await fetch(`${API_BASE}/simulate/offline`, { method: 'POST' });
  });

  document.getElementById('btnStartCamera').addEventListener('click', () => {
    if (isRunning) return;
    startCameraMode().catch((error) => {
      cameraStatus.textContent = String(error?.message || 'No se pudo iniciar camara');
    });
  });

  document.getElementById('btnStopCamera').addEventListener('click', stopCameraMode);
  document.getElementById('btnCameraReport').addEventListener('click', () => downloadCameraReport().catch(() => null));
  document.getElementById('btnShowQrLink').addEventListener('click', () => renderQrLinks().catch(() => null));
  document.getElementById('btnCsv').addEventListener('click', () => window.open(`${API_BASE}/export/csv`, '_blank'));
  document.getElementById('btnPdf').addEventListener('click', () => window.open(`${API_BASE}/export/pdf`, '_blank'));

  const fireQr = () => {
    addRealtimeBadge('QR simulado');
    startFenceRealtimeSync('qr_button');
    pushEventLine(`${new Date().toLocaleTimeString()} | QR simulado | ${CAMERA_ID}`);
  };

  document.getElementById('btnSimQR').addEventListener('click', fireQr);
  window.addEventListener('keydown', (ev) => {
    if (ev.key.toLowerCase() === 'r') fireQr();
  });
}

socket.on('connect', () => {
  visionRtStatus.textContent = `Socket conectado en ${window.location.host}.`;
  socket.emit('device_hello', { displayName: 'Dashboard Web', kind: 'dashboard' });
});

socket.on('disconnect', () => {
  visionRtStatus.textContent = `Socket desconectado. Verifica ${window.location.host}`;
});

socket.on('snapshot', (snapshot) => {
  if (window.updateMapFromSnapshot) {
    window.updateMapFromSnapshot(snapshot);
  }
  if (snapshot?.risk_event) {
    pushEventLine(`${new Date(snapshot.timestamp).toLocaleTimeString()} | ${snapshot.risk_event.risk_level} | ${snapshot.camera_id}`);
  }
});

socket.on('objects_update', (envelope) => {
  if (!envelope || !Array.isArray(envelope.objects)) return;
  if (window.updateMapFromObjectsEnvelope) {
    window.updateMapFromObjectsEnvelope(envelope);
  }
});

socket.on('state_update', (payload) => {
  if (!payload?.risk) return;
  liveRisk.textContent = payload.risk;
});

socket.on('fence_update', (payload) => {
  if (!payload) return;
  if (window.updateMapFence) {
    window.updateMapFence(payload);
  }

  if (payload.triggeredBy === socket.id) {
    fenceOwnedByThisClient = !!payload.active;
  }

  if (!payload.active && fenceSyncTimer) {
    clearInterval(fenceSyncTimer);
    fenceSyncTimer = null;
    fenceOwnedByThisClient = false;
  }
});

socket.on('devices_update', (payload) => {
  renderConnectedDevices(payload);
});

setInterval(() => {
  const msg = messages[Math.floor(Math.random() * messages.length)];
  document.getElementById('ansvMessage').textContent = msg;
}, 8000);

window.initMap();
wireUi();
detectLocation().catch(() => null);
startLocationWatch();
renderQrLinks().catch(() => null);

cameraStatus.textContent = 'Listo. Presiona "Abrir camara PC (IA)" para iniciar deteccion en backend.';
liveEngine.textContent = 'YOLO Backend';
visionRtStatus.textContent = 'Motor de vision en backend Python (YOLO).';

window.addEventListener('beforeunload', () => {
  stopLocationWatch();
  if (fenceOwnedByThisClient) {
    stopFenceRealtimeSync('disconnect');
  }
  stopCameraMode();
});
