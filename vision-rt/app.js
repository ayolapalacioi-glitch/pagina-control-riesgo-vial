(() => {
  const DETECTION_ENGINE = 'sensecraft';
  const CAMERA_ID = 'cam-001';
  const MODEL_TIMEOUT_MS = 15000;

  const CLASS_COLORS = {
    peatón: '#40d98c',
    vehículo: '#ffcc4d',
    autobús: '#ff8a5b',
    motocicleta: '#ff5f5f',
    bicicleta: '#4fb5ff',
    cebra: '#f8fafc',
    'señal de paso': '#e6e6e6',
    animal: '#bf8bff',
    ambulancia: '#7de3ff',
    gesto: '#ff6bd5'
  };

  const ANIMAL_CLASSES = new Set(['cat', 'dog', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe']);
  const CLASS_MAP = {
    person: 'peatón',
    pedestrian: 'peatón',
    human: 'peatón',
    people: 'peatón',
    car: 'vehículo',
    auto: 'vehículo',
    automobile: 'vehículo',
    vehicle: 'vehículo',
    truck: 'vehículo',
    bus: 'autobús',
    motorcycle: 'motocicleta',
    motorbike: 'motocicleta',
    scooter: 'motocicleta',
    bicycle: 'bicicleta',
    bike: 'bicicleta',
    crosswalk: 'cebra',
    zebra_crossing: 'cebra',
    zebra: 'cebra',
    'zebra crossing': 'cebra',
    stop_sign: 'señal de paso'
  };

  const SPECIAL_EVENTS = new Set(['autobús', 'bicicleta', 'señal de paso', 'cebra', 'animal', 'ambulancia', 'gesto']);

  const ui = {
    banner: document.getElementById('banner'),
    video: document.getElementById('video'),
    overlay: document.getElementById('overlay'),
    btnStart: document.getElementById('btnStart'),
    btnSimQR: document.getElementById('btnSimQR'),
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
  let handModel = null;
  let isRunning = false;
  let tracks = [];
  let nextTrackId = 1;
  let frameClock = 0;
  let lastEvents = [];
  const eventCooldown = new Map();
  const crosswalkState = {
    polygon: null,
    confidence: 0,
    lastSeenMs: 0,
    lastAnalyzedMs: 0
  };
  const CROSSWALK_ANALYZE_INTERVAL_MS = 450;

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

  function videoPointToCanvas(point, transform) {
    return {
      x: point.x * transform.scale + transform.offsetX,
      y: point.y * transform.scale + transform.offsetY
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
      ambulancia: { sx: 0.92, sy: 0.8, yBias: 0.04 },
      gesto: { sx: 1, sy: 1, yBias: 0 }
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

  function centroidOfPolygon(polygon) {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      return { x: 0, y: 0 };
    }
    const sum = polygon.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
  }

  function pointInPolygon(point, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return false;
    }

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersects = ((yi > point.y) !== (yj > point.y))
        && (point.x < ((xj - xi) * (point.y - yi)) / Math.max(1e-6, (yj - yi)) + xi);

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  function distancePointToSegment(point, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = point.x - a.x;
    const apy = point.y - a.y;
    const mag2 = abx * abx + aby * aby;
    const t = mag2 <= 1e-6 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / mag2));
    const proj = { x: a.x + t * abx, y: a.y + t * aby };
    return distance(point, proj);
  }

  function distancePointToPolygon(point, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return Infinity;
    }

    let minDist = Infinity;
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      minDist = Math.min(minDist, distancePointToSegment(point, a, b));
    }
    return minDist;
  }

  function smoothPolygon(nextPolygon) {
    if (!crosswalkState.polygon || crosswalkState.polygon.length !== nextPolygon.length) {
      return nextPolygon;
    }
    return nextPolygon.map((point, index) => ({
      x: crosswalkState.polygon[index].x * 0.6 + point.x * 0.4,
      y: crosswalkState.polygon[index].y * 0.6 + point.y * 0.4
    }));
  }

  function detectCrosswalkFromTopView(transform, nowMs) {
    if (nowMs - crosswalkState.lastAnalyzedMs < CROSSWALK_ANALYZE_INTERVAL_MS) {
      return;
    }
    crosswalkState.lastAnalyzedMs = nowMs;

    const sampleW = 220;
    const sampleH = 132;
    cropCanvas.width = sampleW;
    cropCanvas.height = sampleH;
    cropCtx.drawImage(ui.video, 0, 0, transform.videoW, transform.videoH, 0, 0, sampleW, sampleH);

    const pixels = cropCtx.getImageData(0, 0, sampleW, sampleH).data;
    const yStart = Math.floor(sampleH * 0.3);
    const yEnd = Math.floor(sampleH * 0.95);
    const roiH = Math.max(1, yEnd - yStart);

    const colScores = new Array(sampleW).fill(0);
    for (let x = 0; x < sampleW; x += 1) {
      let white = 0;
      for (let y = yStart; y < yEnd; y += 1) {
        const idx = (y * sampleW + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;

        if (luma > 165 && max - min < 70) {
          white += 1;
        }
      }
      colScores[x] = white / roiH;
    }

    const stripeRuns = [];
    let start = -1;
    for (let x = 0; x < sampleW; x += 1) {
      if (colScores[x] > 0.32) {
        if (start < 0) start = x;
      } else if (start >= 0) {
        if (x - start >= 2) {
          stripeRuns.push({ start, end: x - 1 });
        }
        start = -1;
      }
    }
    if (start >= 0 && sampleW - start >= 2) {
      stripeRuns.push({ start, end: sampleW - 1 });
    }

    if (stripeRuns.length < 4) {
      return;
    }

    const centers = stripeRuns.map((run) => (run.start + run.end) / 2);
    const gaps = centers.slice(1).map((center, idx) => center - centers[idx]);
    const meanGap = gaps.reduce((acc, gap) => acc + gap, 0) / Math.max(1, gaps.length);
    const variance = gaps.reduce((acc, gap) => acc + (gap - meanGap) * (gap - meanGap), 0) / Math.max(1, gaps.length);
    const stdGap = Math.sqrt(variance);
    const consistency = 1 - Math.min(1, stdGap / Math.max(1, meanGap));

    if (consistency < 0.22) {
      return;
    }

    const xMin = Math.max(0, stripeRuns[0].start - 2);
    const xMax = Math.min(sampleW - 1, stripeRuns[stripeRuns.length - 1].end + 2);

    let yMin = sampleH - 1;
    let yMax = 0;
    for (let y = yStart; y < yEnd; y += 1) {
      let whiteInRow = 0;
      for (let x = xMin; x <= xMax; x += 1) {
        const idx = (y * sampleW + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luma > 165 && max - min < 70) {
          whiteInRow += 1;
        }
      }
      const rowRatio = whiteInRow / Math.max(1, xMax - xMin + 1);
      if (rowRatio > 0.18) {
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
      }
    }

    if (yMax - yMin < 12) {
      return;
    }

    const sx = transform.videoW / sampleW;
    const sy = transform.videoH / sampleH;
    const polygon = [
      { x: xMin * sx, y: yMin * sy },
      { x: xMax * sx, y: yMin * sy },
      { x: xMax * sx, y: yMax * sy },
      { x: xMin * sx, y: yMax * sy }
    ];

    const confidence = Math.min(0.98, 0.4 + Math.min(0.45, stripeRuns.length * 0.05) + consistency * 0.25);
    crosswalkState.polygon = smoothPolygon(polygon);
    crosswalkState.confidence = confidence;
    crosswalkState.lastSeenMs = nowMs;
  }

  function getCrosswalkPolygonForFrame(videoW, videoH) {
    if (crosswalkState.polygon && Date.now() - crosswalkState.lastSeenMs < 2500 && crosswalkState.confidence > 0.45) {
      return crosswalkState.polygon;
    }
    return [
      { x: videoW * 0.34, y: videoH * 0.53 },
      { x: videoW * 0.66, y: videoH * 0.53 },
      { x: videoW * 0.74, y: videoH * 0.9 },
      { x: videoW * 0.26, y: videoH * 0.9 }
    ];
  }

  function drawCrosswalkOverlay(transform) {
    if (!crosswalkState.polygon || Date.now() - crosswalkState.lastSeenMs > 2500) {
      return;
    }

    const canvasPolygon = crosswalkState.polygon.map((point) => videoPointToCanvas(point, transform));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.fillStyle = 'rgba(125,211,252,0.16)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;

    ctx.beginPath();
    canvasPolygon.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const labelX = Math.min(...canvasPolygon.map((point) => point.x));
    const labelY = Math.max(14, Math.min(...canvasPolygon.map((point) => point.y)) - 8);
    ctx.setLineDash([]);
    ctx.fillStyle = '#dbeafe';
    ctx.font = '12px Segoe UI';
    ctx.fillText(`cebra superior (${Math.round(crosswalkState.confidence * 100)}%)`, labelX, labelY);
    ctx.restore();
  }

  function isTrackRelevantToCrosswalk(track, polygon) {
    if (!polygon) {
      return false;
    }
    if (pointInPolygon(track.center, polygon)) {
      return true;
    }
    const margin = Math.max(36, Math.max(track.bbox.w, track.bbox.h) * 0.55);
    return distancePointToPolygon(track.center, polygon) <= margin;
  }

  function isHeadingToCrosswalk(track, polygon) {
    if (!polygon) {
      return false;
    }
    const speed = speedPxPerSec(track.velocity);
    if (speed < 1) {
      return false;
    }

    const centroid = centroidOfPolygon(polygon);
    const future = {
      x: track.center.x + track.velocity.vx * 0.8,
      y: track.center.y + track.velocity.vy * 0.8
    };

    return distance(future, centroid) + 5 < distance(track.center, centroid);
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
      if (typeof window.tf === 'undefined' || typeof window.handpose === 'undefined') {
        throw new Error('Brave o el navegador bloquearon scripts del modelo. Verifica Shields/extensiones.');
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
        throw new Error('Brave o el navegador bloquearon coco-ssd. Desactiva Shields para localhost.');
      }

      this.detector = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
      setBanner('motor SenseCraft no disponible: modo compat coco-ssd');
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
          const bbox = entry.bbox || entry.box || entry.rect;
          if (!bbox) {
            return null;
          }
          const packed = toVideoPixelBbox(bbox, ui.video.videoWidth || 1, ui.video.videoHeight || 1);
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
    const crosswalkPolygon = getCrosswalkPolygonForFrame(ui.video.videoWidth || 1, ui.video.videoHeight || 1);
    const hasDynamicCrosswalk = Boolean(crosswalkState.polygon && Date.now() - crosswalkState.lastSeenMs < 2500 && crosswalkState.confidence > 0.45);

    const pedestriansNearCrosswalk = pedestrians.filter((track) => isTrackRelevantToCrosswalk(track, crosswalkPolygon));
    const threatsNearCrosswalk = threats.filter((track) => isTrackRelevantToCrosswalk(track, crosswalkPolygon) || isHeadingToCrosswalk(track, crosswalkPolygon));

    const riskPedestrians = pedestriansNearCrosswalk.length ? pedestriansNearCrosswalk : pedestrians;
    const riskThreats = threatsNearCrosswalk.length ? threatsNearCrosswalk : threats;

    if (!riskPedestrians.length || !riskThreats.length) {
      return { risk: 'Bajo', ttc: Infinity, pet: Infinity, vRel: 0 };
    }

    let bestPair = null;
    for (const p of riskPedestrians) {
      for (const v of riskThreats) {
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
    const hasConflict = hasDynamicCrosswalk
      ? (pedestriansNearCrosswalk.length > 0 && threatsNearCrosswalk.length > 0)
      : true;
    const risk = classifyRisk(ttc, pet, vRel, hasConflict);

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

  async function detectHands(transform) {
    if (!handModel) {
      return [];
    }

    const hands = await handModel.estimateHands(ui.video, true);
    return hands.map((hand, idx) => {
      const xs = hand.landmarks.map((p) => p[0]);
      const ys = hand.landmarks.map((p) => p[1]);
      const videoBox = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys)
      };
      const canvasBox = clampBboxToCanvas(videoBboxToCanvasBbox(videoBox, transform));
      return {
        classType: 'gesto',
        score: 0.9,
        bbox: canvasBox,
        sourceId: `hand-${idx}`
      };
    });
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

    const handDetections = await detectHands(transform);
    const allDetections = [...baseDetections, ...handDetections];

    detectCrosswalkFromTopView(transform, performance.now());

    for (const det of allDetections) {
      if (det.classType === 'vehículo' || det.classType === 'autobús') {
        const isAmbulance = await detectAmbulanceHeuristic(det.bbox, transform);
        if (isAmbulance) {
          det.classType = 'ambulancia';
        }
      }
    }

    updateTracks(allDetections, performance.now());

    lastEvents = [];
    if (crosswalkState.polygon && Date.now() - crosswalkState.lastSeenMs < 2500 && crosswalkState.confidence > 0.45) {
      const zebraEvent = 'cebra detectada (vista superior)';
      addBadge(zebraEvent);
      lastEvents.push({ type: 'cebra', label: zebraEvent, confidence: Number(crosswalkState.confidence.toFixed(2)) });
    }
    tracks.forEach((track) => {
      if (SPECIAL_EVENTS.has(track.classType)) {
        const eventName = `${track.classType} detectado`;
        addBadge(eventName);
        lastEvents.push({ type: track.classType, label: eventName, trackId: track.id });
      }
    });

    const metrics = computeRiskMetrics();
    updateStatePanel(metrics);
    renderObjectsList();

    ctx.clearRect(0, 0, ui.overlay.width, ui.overlay.height);
    drawCrosswalkOverlay(transform);
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

  async function boot() {
    try {
      setBanner('Solicitando cámara...');
      await startCamera();

      setBanner('Cargando detector...');
      detector = new SenseCraftDetector();
      await withTimeout(detector.init(), MODEL_TIMEOUT_MS, 'timeout modelo (15s) durante inicialización');

      setBanner('Cargando handpose...');
      handModel = await withTimeout(window.handpose.load(), MODEL_TIMEOUT_MS, 'timeout modelo (15s) en handpose');

      setBanner('motor SenseCraft listo');
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
  boot().catch(() => {});
})();