(() => {
  const DETECTION_ENGINE = 'sensecraft';
  const CAMERA_ID = 'cam-001';
  const MODEL_TIMEOUT_MS = 20000;
  const MIN_DETECTION_CONFIDENCE = 0.42;
  const MIN_BBOX_AREA_PX = 900; // 30x30 minimum — ignore dust detections

  const CLASS_COLORS = {
    peatón: '#40d98c',
    vehículo: '#ffcc4d',
    autobús: '#ff8a5b',
    motocicleta: '#ff5f5f',
    bicicleta: '#4fb5ff',
    'señal de paso': '#e6e6e6',
    animal: '#bf8bff',
    ambulancia: '#7de3ff'
  };

  const ANIMAL_CLASSES = new Set(['cat', 'dog', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe']);
  const CLASS_MAP = {
    person: 'peatón',
    car: 'vehículo',
    truck: 'vehículo',
    bus: 'autobús',
    motorcycle: 'motocicleta',
    bicycle: 'bicicleta',
    stop_sign: 'señal de paso'
  };

  const SPECIAL_EVENTS = new Set(['autobús', 'bicicleta', 'señal de paso', 'animal', 'ambulancia']);

  const ui = {
    banner: document.getElementById('banner'),
    video: document.getElementById('video'),
    overlay: document.getElementById('overlay'),
    btnStart: document.getElementById('btnStart'),
    btnSimQR: document.getElementById('btnSimQR'),
    btnScanQR: document.getElementById('btnScanQR'),
    btnDrawZone: document.getElementById('btnDrawZone'),
    btnClearZones: document.getElementById('btnClearZones'),
    geofenceStatus: document.getElementById('geofenceStatus'),
    zoneList: document.getElementById('zoneList'),
    badges: document.getElementById('badges'),
    objectsList: document.getElementById('objectsList'),
    mRisk: document.getElementById('mRisk'),
    mTtc: document.getElementById('mTtc'),
    mPet: document.getElementById('mPet'),
    mVrel: document.getElementById('mVrel')
  };

  const ctx = ui.overlay.getContext('2d');
  const cropCanvas = document.createElement('canvas');
  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });

  const socket = io();
  const mapAdapter = new window.MapAdapter({
    north: 10.4265,
    south: 10.4203,
    east: -75.5402,
    west: -75.5498
  });

  let detector = null;
  let geofence = null;
  let isRunning = false;
  let qrScanActive = false;
  let tracks = [];
  let nextTrackId = 1;
  let frameClock = 0;
  let lastEvents = [];
  const eventCooldown = new Map();

  function setBanner(message, isError = false) {
    ui.banner.textContent = message;
    ui.banner.style.color = isError ? '#ff8d8d' : '#b7dbff';
  }

  function withTimeout(promise, timeoutMs, msg) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(msg)), timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  function showStartupError(error) {
    let details = 'Error desconocido durante el arranque.';
    if (error?.name === 'NotAllowedError') {
      details = 'Permiso de cámara denegado (NotAllowedError). Habilita cámara para este sitio.';
    } else if (error?.name === 'NotFoundError') {
      details = 'No se encontró cámara disponible (NotFoundError).';
    } else if ((error?.message || '').includes('Brave')) {
      details = 'Brave Shields bloqueó scripts del modelo. Desactiva Shields para localhost.';
    } else if ((error?.message || '').includes('timeout')) {
      details = error.message;
    } else if (error?.message) {
      details = error.message;
    }
    setBanner(details, true);
    alert(details);
  }

  function isLocalhost() {
    return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  function ensureSecureContext() {
    if (window.isSecureContext || isLocalhost()) {
      return;
    }
    throw new Error('Contexto no seguro. Usa https o abre en http://localhost:3000');
  }

  function resizeCanvasToDisplay() {
    const rect = ui.overlay.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (ui.overlay.width !== width || ui.overlay.height !== height) {
      ui.overlay.width = width;
      ui.overlay.height = height;
    }
  }

  function getVideoToCanvasTransform() {
    const videoW = Math.max(1, ui.video.videoWidth || 1);
    const videoH = Math.max(1, ui.video.videoHeight || 1);
    const canvasW = Math.max(1, ui.overlay.width || 1);
    const canvasH = Math.max(1, ui.overlay.height || 1);
    const scale = Math.max(canvasW / videoW, canvasH / videoH);
    const renderW = videoW * scale;
    const renderH = videoH * scale;
    const offsetX = (canvasW - renderW) / 2;
    const offsetY = (canvasH - renderH) / 2;
    return { videoW, videoH, canvasW, canvasH, scale, renderW, renderH, offsetX, offsetY };
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
    if (!bbox) {
      return { x: 0, y: 0, w: 0, h: 0 };
    }

    const input = Array.isArray(bbox)
      ? { x: bbox[0], y: bbox[1], w: bbox[2], h: bbox[3] }
      : {
          x: bbox.x ?? bbox.left ?? 0,
          y: bbox.y ?? bbox.top ?? 0,
          w: bbox.w ?? bbox.width ?? 0,
          h: bbox.h ?? bbox.height ?? 0
        };

    const isNormalized = input.w <= 1.2 && input.h <= 1.2 && input.x <= 1.2 && input.y <= 1.2;
    if (isNormalized) {
      return {
        x: input.x * videoW,
        y: input.y * videoH,
        w: input.w * videoW,
        h: input.h * videoH
      };
    }

    return input;
  }

  function clampBboxToCanvas(bbox) {
    const maxW = ui.overlay.width;
    const maxH = ui.overlay.height;
    const x = Math.max(0, Math.min(maxW, bbox.x));
    const y = Math.max(0, Math.min(maxH, bbox.y));
    const w = Math.max(0, Math.min(maxW - x, bbox.w));
    const h = Math.max(0, Math.min(maxH - y, bbox.h));
    return { x, y, w, h };
  }

  function refineBboxForClass(classType, bbox) {
    const profiles = {
      peatón: { sx: 0.82, sy: 0.9, yBias: 0.05 },
      vehículo: { sx: 0.9, sy: 0.8, yBias: 0.04 },
      autobús: { sx: 0.94, sy: 0.78, yBias: 0.04 },
      motocicleta: { sx: 0.86, sy: 0.84, yBias: 0.03 },
      bicicleta: { sx: 0.88, sy: 0.86, yBias: 0.03 },
      animal: { sx: 0.9, sy: 0.88, yBias: 0.02 },
      ambulancia: { sx: 0.92, sy: 0.8, yBias: 0.04 }
    };

    const p = profiles[classType] || { sx: 0.9, sy: 0.9, yBias: 0 };
    const cx = bbox.x + bbox.w / 2;
    const cy = bbox.y + bbox.h / 2;
    const w = bbox.w * p.sx;
    const h = bbox.h * p.sy;
    return {
      x: cx - w / 2,
      y: cy - h / 2 + bbox.h * p.yBias,
      w,
      h
    };
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

  function centerOf(bbox) {
    return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function speedPxPerSec(velocity) {
    return Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
  }

  function normalizeClassName(rawClass) {
    if (!rawClass) {
      return 'vehículo';
    }
    const key = String(rawClass).toLowerCase();
    if (ANIMAL_CLASSES.has(key)) {
      return 'animal';
    }
    return CLASS_MAP[key] || key;
  }

  class SenseCraftDetector {
    constructor() {
      this.engine = DETECTION_ENGINE;
      this.detector = null;
    }

    async init() {
      if (typeof window.tf === 'undefined') {
        throw new Error('TensorFlow.js no disponible. Verifica conexión a internet o extensiones del navegador.');
      }

      if (this.engine === 'sensecraft') {
        try {
          if (window.sensecraft?.createDetector) {
            this.detector = await window.sensecraft.createDetector({ task: 'object-detection' });
            setBanner('motor SenseCraft listo');
            return;
          }
          if (window.SenseCraft?.createDetector) {
            this.detector = await window.SenseCraft.createDetector({ task: 'object-detection' });
            setBanner('motor SenseCraft listo');
            return;
          }
        } catch (error) {
          console.warn('SenseCraft SDK no disponible, activando compat coco-ssd', error);
        }
      }

      if (typeof window.cocoSsd === 'undefined') {
        throw new Error('Modelo coco-ssd no disponible. Desactiva bloqueadores de scripts para localhost.');
      }

      // Use mobilenet_v2 (full model) for significantly better person & vehicle detection accuracy
      this.detector = await window.cocoSsd.load({ base: 'mobilenet_v2' });
      setBanner('Motor de detección listo (mobilenet_v2)');
    }

    async detect(videoElement) {
      if (!this.detector) {
        return [];
      }

      if (this.detector.detect) {
        const detections = await this.detector.detect(videoElement);
        return this.normalizeDetections(detections);
      }
      if (this.detector.predict) {
        const detections = await this.detector.predict(videoElement);
        return this.normalizeDetections(detections);
      }
      if (this.detector.infer) {
        const detections = await this.detector.infer(videoElement);
        return this.normalizeDetections(detections);
      }
      return [];
    }

    normalizeDetections(rawDetections) {
      const list = Array.isArray(rawDetections) ? rawDetections : rawDetections?.detections || [];
      return list
        .map((entry) => {
          const className = entry.class || entry.class_name || entry.label || entry.category || entry.name;
          const score = entry.score ?? entry.confidence ?? entry.probability ?? 0;
          if (score < MIN_DETECTION_CONFIDENCE) return null;
          const bbox = entry.bbox || entry.box || entry.rect;
          if (!bbox) {
            return null;
          }
          const packed = toVideoPixelBbox(bbox, ui.video.videoWidth || 1, ui.video.videoHeight || 1);
          if (packed.w * packed.h < MIN_BBOX_AREA_PX) return null;
          return {
            class: className,
            score,
            bbox: [packed.x, packed.y, packed.w, packed.h]
          };
        })
        .filter(Boolean);
    }
  }

  function updateTracks(detections, nowMs) {
    const activeTracks = tracks.filter((track) => nowMs - track.lastSeenMs < 1200);
    const matches = [];

    for (let ti = 0; ti < activeTracks.length; ti += 1) {
      for (let di = 0; di < detections.length; di += 1) {
        const track = activeTracks[ti];
        const det = detections[di];
        const trackCenter = centerOf(track.bbox);
        const detCenter = centerOf(det.bbox);
        const dist = distance(trackCenter, detCenter);
        const distNorm = dist / Math.max(1, Math.hypot(ui.overlay.width, ui.overlay.height));
        const overlap = iou(track.bbox, det.bbox);
        const classPenalty = track.classType === det.classType ? 0 : 0.25;
        const cost = distNorm + (1 - overlap) + classPenalty;
        matches.push({ ti, di, cost });
      }
    }

    matches.sort((a, b) => a.cost - b.cost);

    const usedTrack = new Set();
    const usedDetection = new Set();

    for (const m of matches) {
      if (m.cost > 1.35 || usedTrack.has(m.ti) || usedDetection.has(m.di)) {
        continue;
      }
      usedTrack.add(m.ti);
      usedDetection.add(m.di);
      const track = activeTracks[m.ti];
      const det = detections[m.di];
      const dt = Math.max(0.016, (nowMs - track.lastSeenMs) / 1000);
      const previousCenter = centerOf(track.bbox);
      const currentCenter = centerOf(det.bbox);
      const velocity = {
        vx: (currentCenter.x - previousCenter.x) / dt,
        vy: (currentCenter.y - previousCenter.y) / dt
      };

      const alpha = 0.55;
      const smooth = {
        x: track.bbox.x * (1 - alpha) + det.bbox.x * alpha,
        y: track.bbox.y * (1 - alpha) + det.bbox.y * alpha,
        w: track.bbox.w * (1 - alpha) + det.bbox.w * alpha,
        h: track.bbox.h * (1 - alpha) + det.bbox.h * alpha
      };

      track.bbox = smooth;
      track.center = centerOf(smooth);
      track.classType = det.classType;
      track.score = det.score;
      track.velocity = velocity;
      track.lastSeenMs = nowMs;
      track.predicted = {
        x: track.center.x + velocity.vx * 0.45,
        y: track.center.y + velocity.vy * 0.45
      };
      track.trail.push(track.center);
      if (track.trail.length > 20) {
        track.trail.shift();
      }
    }

    detections.forEach((det, di) => {
      if (usedDetection.has(di)) {
        return;
      }
      const center = centerOf(det.bbox);
      activeTracks.push({
        id: `T${String(nextTrackId).padStart(4, '0')}`,
        classType: det.classType,
        score: det.score,
        bbox: det.bbox,
        center,
        velocity: { vx: 0, vy: 0 },
        predicted: { ...center },
        trail: [center],
        lastSeenMs: nowMs
      });
      nextTrackId += 1;
    });

    tracks = activeTracks;
  }

  function classifyRisk(ttc, pet, vRel, hasPedestrianConflict) {
    let score = 0;
    if (hasPedestrianConflict) {
      score += 1;
    }
    if (Number.isFinite(vRel) && vRel > 110) {
      score += 1;
    }
    if (Number.isFinite(ttc) && ttc < 2.5) {
      score += 2;
    } else if (Number.isFinite(ttc) && ttc < 5) {
      score += 1;
    }
    if (Number.isFinite(pet) && pet < 1.5) {
      score += 2;
    } else if (Number.isFinite(pet) && pet < 3) {
      score += 1;
    }

    if (score >= 5) {
      return 'Crítico';
    }
    if (score >= 3) {
      return 'Alto';
    }
    if (score >= 2) {
      return 'Medio';
    }
    return 'Bajo';
  }

  function computeRiskMetrics() {
    const pedestrians = tracks.filter((track) => track.classType === 'peatón');
    const threats = tracks.filter((track) => ['vehículo', 'autobús', 'motocicleta', 'bicicleta', 'ambulancia'].includes(track.classType));

    if (!pedestrians.length || !threats.length) {
      return { risk: 'Bajo', ttc: Infinity, pet: Infinity, vRel: 0 };
    }

    let bestPair = null;
    for (const p of pedestrians) {
      for (const v of threats) {
        const d = distance(p.center, v.center);
        if (!bestPair || d < bestPair.d) {
          bestPair = { p, v, d };
        }
      }
    }

    const vPed = speedPxPerSec(bestPair.p.velocity);
    const vVeh = speedPxPerSec(bestPair.v.velocity);
    const vRel = Math.abs(vVeh - vPed);
    const ttc = vRel > 0.001 ? bestPair.d / vRel : Infinity;

    const midPoint = {
      x: (bestPair.p.center.x + bestPair.v.center.x) / 2,
      y: (bestPair.p.center.y + bestPair.v.center.y) / 2
    };

    const tp = distance(bestPair.p.center, midPoint) / Math.max(1, vPed);
    const tv = distance(bestPair.v.center, midPoint) / Math.max(1, vVeh);
    const pet = Math.abs(tp - tv);
    const risk = classifyRisk(ttc, pet, vRel, true);

    return { risk, ttc, pet, vRel };
  }

  function riskClass(risk) {
    const normalized = risk?.toLowerCase() || '';
    if (normalized === 'crítico') return 'risk-crítico';
    if (normalized === 'alto') return 'risk-alto';
    if (normalized === 'medio') return 'risk-medio';
    return 'risk-bajo';
  }

  function formatMetric(value, digits = 2) {
    if (!Number.isFinite(value)) {
      return '-';
    }
    return Number(value).toFixed(digits);
  }

  function updateStatePanel(metrics) {
    ui.mRisk.textContent = metrics.risk;
    ui.mRisk.className = `v ${riskClass(metrics.risk)}`;
    ui.mTtc.textContent = `${formatMetric(metrics.ttc)} s`;
    ui.mPet.textContent = `${formatMetric(metrics.pet)} s`;
    ui.mVrel.textContent = `${formatMetric(metrics.vRel, 1)} px/s`;
  }

  function renderObjectsList() {
    ui.objectsList.innerHTML = '';
    tracks.forEach((track) => {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `<strong>${track.id}</strong> · ${track.classType} · ${(track.score * 100).toFixed(1)}%<br/><small>x:${track.bbox.x.toFixed(0)} y:${track.bbox.y.toFixed(0)} w:${track.bbox.w.toFixed(0)} h:${track.bbox.h.toFixed(0)}</small>`;
      ui.objectsList.appendChild(row);
    });
  }

  function addBadge(label) {
    const now = Date.now();
    const key = label.toLowerCase();
    if ((eventCooldown.get(key) || 0) > now - 2000) {
      return;
    }
    eventCooldown.set(key, now);

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `${new Date().toLocaleTimeString()} · ${label}`;
    ui.badges.prepend(badge);

    while (ui.badges.children.length > 12) {
      ui.badges.removeChild(ui.badges.lastChild);
    }
  }

  function drawTrack(track) {
    const color = CLASS_COLORS[track.classType] || '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(track.bbox.x, track.bbox.y, track.bbox.w, track.bbox.h);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(track.bbox.x, Math.max(0, track.bbox.y - 20), 240, 20);
    ctx.fillStyle = color;
    ctx.font = '12px Segoe UI';
    ctx.fillText(`${track.id} · ${track.classType} · ${(track.score * 100).toFixed(1)}%`, track.bbox.x + 4, Math.max(12, track.bbox.y - 6));

    ctx.strokeStyle = `${color}AA`;
    ctx.beginPath();
    track.trail.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    ctx.strokeStyle = `${color}99`;
    ctx.beginPath();
    ctx.moveTo(track.center.x, track.center.y);
    ctx.lineTo(track.predicted.x, track.predicted.y);
    ctx.stroke();
  }

  async function detectAmbulanceHeuristic(canvasBbox, transform) {
    const videoBbox = canvasBboxToVideoBbox(canvasBbox, transform);
    const clamped = {
      x: Math.max(0, Math.min(transform.videoW - 1, videoBbox.x)),
      y: Math.max(0, Math.min(transform.videoH - 1, videoBbox.y)),
      w: Math.max(1, Math.min(transform.videoW - videoBbox.x, videoBbox.w)),
      h: Math.max(1, Math.min(transform.videoH - videoBbox.y, videoBbox.h))
    };

    const sampleW = Math.max(24, Math.min(96, Math.round(clamped.w / 2)));
    const sampleH = Math.max(24, Math.min(96, Math.round(clamped.h / 2)));

    cropCanvas.width = sampleW;
    cropCanvas.height = sampleH;
    cropCtx.drawImage(ui.video, clamped.x, clamped.y, clamped.w, clamped.h, 0, 0, sampleW, sampleH);

    const pixels = cropCtx.getImageData(0, 0, sampleW, sampleH).data;
    let redCount = 0;
    let whiteCount = 0;
    const total = sampleW * sampleH;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      if (r > 140 && r > g * 1.25 && r > b * 1.2) {
        redCount += 1;
      }
      if (max > 180 && max - min < 28) {
        whiteCount += 1;
      }
    }

    const redRatio = redCount / total;
    const whiteRatio = whiteCount / total;
    return redRatio > 0.08 && whiteRatio > 0.12;
  }

  function emitSocketPayload(metrics) {
    const timestamp = new Date().toISOString();
    const canvasSize = { width: ui.overlay.width, height: ui.overlay.height };
    const mappedObjects = tracks.map((track) => mapAdapter.mapTrack(track, canvasSize));

    socket.emit('state_update', {
      cameraId: CAMERA_ID,
      timestamp,
      risk: metrics.risk,
      ttc: Number.isFinite(metrics.ttc) ? metrics.ttc : null,
      pet: Number.isFinite(metrics.pet) ? metrics.pet : null,
      vRel: metrics.vRel,
      objectCount: tracks.length
    });

    const objectsEnvelope = window.VisionFrameSchema.buildObjectsEnvelope({
      cameraId: CAMERA_ID,
      timestamp,
      risk: metrics.risk,
      ttc: Number.isFinite(metrics.ttc) ? metrics.ttc : null,
      pet: Number.isFinite(metrics.pet) ? metrics.pet : null,
      vRel: metrics.vRel,
      objects: mappedObjects,
      events: lastEvents
    });

    socket.emit('objects_update', objectsEnvelope);
  }

  function scanQrFrame() {
    if (!qrScanActive || !ui.video.videoWidth) return;
    const sw = Math.min(ui.video.videoWidth, 640);
    const sh = Math.round(sw * (ui.video.videoHeight / ui.video.videoWidth));
    cropCanvas.width = sw;
    cropCanvas.height = sh;
    cropCtx.drawImage(ui.video, 0, 0, sw, sh);
    const imageData = cropCtx.getImageData(0, 0, sw, sh);
    if (typeof window.jsQR === 'function') {
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code) {
        qrScanActive = false;
        ui.btnScanQR.textContent = 'Escanear QR';
        ui.btnScanQR.classList.remove('btn-active');
        const label = `QR: ${code.data.slice(0, 40)}`;
        addBadge(label);
        lastEvents.push({ type: 'qr', label, data: code.data, at: new Date().toISOString() });
        setBanner(`QR detectado: ${code.data.slice(0, 60)}`);
        return;
      }
    }
    setTimeout(scanQrFrame, 200);
  }

  function updateZoneList() {
    if (!ui.zoneList || !geofence) return;
    ui.zoneList.innerHTML = '';
    const summary = geofence.getZoneSummary();
    if (!summary.length) {
      ui.zoneList.innerHTML = '<div class="item" style="color:var(--muted)">Sin zonas definidas</div>';
      return;
    }
    summary.forEach((z) => {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `<strong>${z.id}</strong> · ${z.name} · <small>${z.points} puntos</small>`;
      ui.zoneList.appendChild(row);
    });
  }

  async function processFrame(now) {
    if (!isRunning) {
      return;
    }

    if (now - frameClock < 90) {
      requestAnimationFrame(processFrame);
      return;
    }

    frameClock = now;
    resizeCanvasToDisplay();
    const transform = getVideoToCanvasTransform();

    let baseDetections = [];
    try {
      const raw = await detector.detect(ui.video);
      baseDetections = raw.map((entry) => {
        const videoBbox = toVideoPixelBbox(entry.bbox, transform.videoW, transform.videoH);
        let canvasBbox = videoBboxToCanvasBbox(videoBbox, transform);
        const classType = normalizeClassName(entry.class);
        canvasBbox = refineBboxForClass(classType, canvasBbox);
        canvasBbox = clampBboxToCanvas(canvasBbox);
        return {
          classType,
          score: entry.score || 0,
          bbox: canvasBbox
        };
      });
    } catch (error) {
      console.warn('Error de detección', error);
    }

    for (const det of baseDetections) {
      if (det.classType === 'vehículo' || det.classType === 'autobús') {
        const isAmbulance = await detectAmbulanceHeuristic(det.bbox, transform);
        if (isAmbulance) {
          det.classType = 'ambulancia';
        }
      }
    }

    updateTracks(baseDetections, performance.now());

    lastEvents = [];
    tracks.forEach((track) => {
      if (SPECIAL_EVENTS.has(track.classType)) {
        const eventName = `${track.classType} detectado`;
        addBadge(eventName);
        lastEvents.push({ type: track.classType, label: eventName, trackId: track.id });
      }
    });

    if (geofence) {
      const geoAlerts = geofence.checkTracks(tracks);
      geoAlerts.forEach((alert) => {
        const label = `🔴 ${alert.classType} entró a ${alert.zone}`;
        addBadge(label);
        lastEvents.push({ type: 'geofence', label, zone: alert.zone, trackId: alert.trackId });
      });
    }

    const metrics = computeRiskMetrics();
    updateStatePanel(metrics);
    renderObjectsList();

    ctx.clearRect(0, 0, ui.overlay.width, ui.overlay.height);
    if (geofence) geofence.render();
    tracks.forEach(drawTrack);

    emitSocketPayload(metrics);
    requestAnimationFrame(processFrame);
  }

  async function startCamera() {
    ensureSecureContext();
    const mediaPromise = navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment'
      },
      audio: false
    });

    const stream = await withTimeout(mediaPromise, 10000, 'Timeout al abrir cámara.');
    ui.video.srcObject = stream;
    await ui.video.play();
  }

  function registerSimulateQr() {
    const fireQr = () => {
      const eventLabel = 'QR simulado';
      addBadge(eventLabel);
      lastEvents.push({ type: 'qr', label: eventLabel, at: new Date().toISOString() });
    };

    ui.btnSimQR.addEventListener('click', fireQr);
    window.addEventListener('keydown', (ev) => {
      if (ev.key.toLowerCase() === 'r') {
        fireQr();
      }
    });
  }

  function registerQrScanner() {
    ui.btnScanQR.addEventListener('click', () => {
      if (!isRunning) {
        setBanner('Inicia la cámara primero', true);
        return;
      }
      if (qrScanActive) {
        qrScanActive = false;
        ui.btnScanQR.textContent = 'Escanear QR';
        ui.btnScanQR.classList.remove('btn-active');
      } else {
        qrScanActive = true;
        ui.btnScanQR.textContent = 'Cancelar QR';
        ui.btnScanQR.classList.add('btn-active');
        setBanner('Apunta la cámara al código QR...');
        scanQrFrame();
      }
    });
  }

  function registerGeofenceControls() {
    geofence = new window.Geofence(ui.overlay, ctx);

    geofence.onAlert = (alert) => {
      if (ui.geofenceStatus) {
        ui.geofenceStatus.textContent = `⚠️ ${alert.classType} entró a ${alert.zone} (${alert.trackId})`;
        ui.geofenceStatus.className = 'geofence-status geofence-alert';
        setTimeout(() => {
          ui.geofenceStatus.className = 'geofence-status';
        }, 4000);
      }
    };

    ui.btnDrawZone.addEventListener('click', () => {
      if (geofence.drawing) {
        geofence.stopDrawing();
        ui.btnDrawZone.textContent = 'Dibujar zona';
        ui.btnDrawZone.classList.remove('btn-active');
        updateZoneList();
      } else {
        geofence.startDrawing();
        ui.btnDrawZone.textContent = 'Finalizar zona (Enter)';
        ui.btnDrawZone.classList.add('btn-active');
        setBanner('Haz clic en el video para añadir puntos. Enter o doble clic para cerrar la zona.');
      }
    });

    ui.btnClearZones.addEventListener('click', () => {
      geofence.clearZones();
      updateZoneList();
    });
  }

  async function boot() {
    try {
      setBanner('Solicitando cámara...');
      await startCamera();

      setBanner('Cargando modelo de detección (mobilenet_v2)...');
      detector = new SenseCraftDetector();
      await withTimeout(detector.init(), MODEL_TIMEOUT_MS, 'timeout modelo (20s) durante inicialización');

      setBanner('Sistema listo');
      isRunning = true;
      requestAnimationFrame(processFrame);
    } catch (error) {
      showStartupError(error);
      throw error;
    }
  }

  ui.btnStart.addEventListener('click', () => {
    if (!isRunning) {
      boot().catch(() => {});
    }
  });

  registerSimulateQr();
  registerQrScanner();
  registerGeofenceControls();
  boot().catch(() => {});
})();