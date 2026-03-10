const socket = io(window.location.origin);
const DEFAULT_GPS = { lat: 10.4236, lng: -75.5457 };
const FENCE_RADIUS_METERS = 50;
const RISK_NEARBY_RADIUS_METERS = 450;
const FENCE_SYNC_INTERVAL_MS = 1500;
const FENCE_TTL_MS = 180000;
const GEO_EXPECTED_UPDATE_MS = 5000;
const GEO_STALE_RESTART_MS = 15000;
const GEO_LOW_ACCURACY_THRESHOLD_METERS = 35;
const GEOFENCE_CENTER = { lat: 10.3997, lng: -75.5144 };
const GEOFENCE_RADIUS_METERS = 50;

const statusEl = document.getElementById('status');
const riskInfoEl = document.getElementById('riskInfo');
const btnRequestLocation = document.getElementById('btnRequestLocation');
const query = new URLSearchParams(window.location.search);
const shouldActivateQr = query.get('qr') === '1';

let map;
let myLocation = { ...DEFAULT_GPS };
let myMarker;
let fenceCircle;
let riskLayer;
let watchId = null;
let fenceTimer = null;
let manualModeEnabled = false;
let hasPreciseLocation = false;
let geofenceWasInside = null;
let lastGeoUpdateAt = 0;
let staleGeoMonitorId = null;
let locationHeartbeatId = null;
let hasGestureTriggeredGps = false;
let lastSpokenRiskAt = 0;
const RISK_SPEAK_COOLDOWN_MS = 7000;

function autoKickGpsFromQr() {
  startLocationTracking();

  setTimeout(() => {
    if (!hasPreciseLocation) startLocationTracking();
  }, 3500);

  setTimeout(() => {
    if (!hasPreciseLocation) startLocationTracking();
  }, 9000);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function timeLabel(iso = new Date().toISOString()) {
  return new Date(iso).toLocaleTimeString();
}

function speakRiskAlert(text) {
  if (!window.speechSynthesis) return;
  const now = Date.now();
  if (now - lastSpokenRiskAt < RISK_SPEAK_COOLDOWN_MS) return;
  lastSpokenRiskAt = now;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-CO';
  window.speechSynthesis.speak(utterance);
}

function geoErrorMessage(error) {
  if (!error) return 'Error de geolocalización desconocido.';
  if (error.code === error.PERMISSION_DENIED) {
    return 'PERMISSION_DENIED: permiso de ubicación denegado. Habilítalo en el navegador del celular.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'POSITION_UNAVAILABLE: el dispositivo no pudo obtener ubicación. Intenta en una zona con mejor señal.';
  }
  if (error.code === error.TIMEOUT) {
    return 'TIMEOUT: no se obtuvo ubicación dentro del tiempo esperado.';
  }
  return `Error de geolocalización: ${error.message || 'sin detalle'}`;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y;
}

function initMap() {
  map = L.map('map').setView([myLocation.lat, myLocation.lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  riskLayer = L.layerGroup().addTo(map);

  myMarker = L.circleMarker([myLocation.lat, myLocation.lng], {
    radius: 8,
    color: '#38bdf8',
    fillColor: '#38bdf8',
    fillOpacity: 0.35,
    weight: 2
  }).addTo(map).bindPopup('Tu ubicación');
}

function updateMyLocation(lat, lng) {
  myLocation = { lat, lng };
  if (myMarker) {
    myMarker.setLatLng([lat, lng]);
  }
  if (map) {
    map.setView([myLocation.lat, myLocation.lng], Math.max(map.getZoom(), 15));
  }
  socket.emit('location_update', { gps: myLocation });
}

function startLocationHeartbeat() {
  if (locationHeartbeatId) return;
  locationHeartbeatId = setInterval(() => {
    socket.emit('location_update', { gps: myLocation });
  }, 5000);
}

function evaluateGeofence(coords) {
  const point = { lat: coords.latitude, lng: coords.longitude };
  const distance = haversineMeters(point, GEOFENCE_CENTER);
  const inside = distance <= GEOFENCE_RADIUS_METERS;

  if (geofenceWasInside !== null && geofenceWasInside && !inside) {
    alert('⚠️ Saliste de la geocerca de 50m.');
  }

  geofenceWasInside = inside;
  return { distance, inside };
}

function updateGeoDiagnostics(pos) {
  const { coords } = pos;
  const accuracy = Number.isFinite(coords.accuracy) ? coords.accuracy : NaN;
  const speed = Number.isFinite(coords.speed) ? coords.speed : NaN;
  const altitude = Number.isFinite(coords.altitude) ? coords.altitude : NaN;

  const geofence = evaluateGeofence(coords);
  const lowAccuracy = Number.isFinite(accuracy) && accuracy > GEO_LOW_ACCURACY_THRESHOLD_METERS;

  console.log('[GEO][UPDATE]', {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy,
    speed,
    altitude,
    geofenceDistanceMeters: geofence.distance,
    geofenceInside: geofence.inside,
    lowAccuracy,
    timestamp: new Date().toISOString()
  });

  const accuracyTxt = Number.isFinite(accuracy) ? `${accuracy.toFixed(1)}m` : 'N/A';
  const speedTxt = Number.isFinite(speed) ? `${speed.toFixed(2)}m/s` : 'N/A';
  const altitudeTxt = Number.isFinite(altitude) ? `${altitude.toFixed(2)}m` : 'N/A';
  const locationTxt = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;

  setStatus(
    `GPS activo: ${locationTxt} | Precisión: ${accuracyTxt}${lowAccuracy ? ' ⚠️' : ''} | Velocidad: ${speedTxt} | Altitud: ${altitudeTxt} | Geocerca: ${geofence.inside ? 'DENTRO' : 'FUERA'} (${Math.round(geofence.distance)}m)`
  );
}

function ensureLocationWatch() {
  if (!navigator.geolocation) return;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  watchId = navigator.geolocation.watchPosition((pos) => {
    updateMyLocation(pos.coords.latitude, pos.coords.longitude);
    updateGeoDiagnostics(pos);
    manualModeEnabled = false;
    hasPreciseLocation = true;
    lastGeoUpdateAt = Date.now();
  }, (error) => {
    console.warn('[GEO][WATCH_ERROR]', error);
    manualModeEnabled = true;
    setStatus(geoErrorMessage(error));
  }, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  });

  if (!staleGeoMonitorId) {
    staleGeoMonitorId = setInterval(() => {
      if (!lastGeoUpdateAt) return;
      const elapsed = Date.now() - lastGeoUpdateAt;
      if (elapsed > GEO_STALE_RESTART_MS) {
        console.warn('[GEO][STALE] Reiniciando watchPosition por falta de updates', { elapsedMs: elapsed });
        ensureLocationWatch();
      }
    }, GEO_EXPECTED_UPDATE_MS);
  }
}

function drawLocalFence() {
  drawFence({
    active: true,
    gps: myLocation,
    radiusMeters: FENCE_RADIUS_METERS
  });
}

function drawFence(payload) {
  if (!payload || !payload.active || !payload.gps) {
    if (fenceCircle) {
      map.removeLayer(fenceCircle);
      fenceCircle = null;
    }
    return;
  }

  const center = [payload.gps.lat, payload.gps.lng];
  const radius = Number(payload.radiusMeters) || FENCE_RADIUS_METERS;

  if (!fenceCircle) {
    fenceCircle = L.circle(center, {
      radius,
      color: '#ef4444',
      weight: 2,
      fillColor: '#ef4444',
      fillOpacity: 0.08
    }).addTo(map);
  } else {
    fenceCircle.setLatLng(center);
    fenceCircle.setRadius(radius);
  }

  fenceCircle.bindPopup(`Cerca activa (${Math.round(radius)}m)`);
}

function pushRisk(snapshot) {
  if (!snapshot?.gps || !snapshot?.risk_event) return;
  const distance = haversineMeters(myLocation, snapshot.gps);
  if (distance > RISK_NEARBY_RADIUS_METERS) return;

  const level = snapshot.risk_event.risk_level || 'BAJO';
  const color = level === 'CRITICO' ? '#ef4444' : level === 'ALTO' ? '#f97316' : level === 'MEDIO' ? '#eab308' : '#22c55e';

  const marker = L.circleMarker([snapshot.gps.lat, snapshot.gps.lng], {
    radius: level === 'CRITICO' ? 9 : 6,
    color,
    weight: 2,
    fillOpacity: 0.35
  }).addTo(riskLayer);

  marker.bindPopup(`<b>Riesgo ${level}</b><br/>Distancia: ${Math.round(distance)}m`);
  riskInfoEl.textContent = `Riesgo ${level} detectado a ${Math.round(distance)}m de tu zona.`;

  setTimeout(() => {
    riskLayer.removeLayer(marker);
  }, 45000);
}

function emitFence(active, source) {
  socket.emit('fence_update', {
    active,
    source,
    cameraId: 'mobile-viewer',
    gps: myLocation,
    radiusMeters: FENCE_RADIUS_METERS,
    expiresAt: active ? new Date(Date.now() + FENCE_TTL_MS).toISOString() : null
  });
}

function startFenceSync() {
  emitFence(true, 'qr_viewer_start');
  drawLocalFence();
  if (fenceTimer) clearInterval(fenceTimer);
  fenceTimer = setInterval(() => {
    emitFence(true, 'device_location');
    drawLocalFence();
  }, FENCE_SYNC_INTERVAL_MS);
}

function stopFenceSync() {
  if (fenceTimer) {
    clearInterval(fenceTimer);
    fenceTimer = null;
  }
  emitFence(false, 'viewer_exit');
}

function startLocationTracking() {
  if (!navigator.geolocation) {
    setStatus('Geolocalización no disponible en este navegador. Toca el mapa para ubicarte manualmente.');
    manualModeEnabled = true;
    return;
  }

  ensureLocationWatch();
  setStatus('Solicitando permiso de ubicación del navegador...');

  navigator.geolocation.getCurrentPosition((pos) => {
    updateMyLocation(pos.coords.latitude, pos.coords.longitude);
    updateGeoDiagnostics(pos);
    manualModeEnabled = false;
    hasPreciseLocation = true;
    lastGeoUpdateAt = Date.now();
    ensureLocationWatch();
  }, (error) => {
    console.warn('[GEO][GET_CURRENT_ERROR]', error);
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setStatus('Tu navegador bloqueó GPS por conexión no segura (HTTP). Abre el QR desde URL HTTPS para habilitar ubicación.');
    } else {
      setStatus(geoErrorMessage(error));
    }
    manualModeEnabled = true;
  }, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  });
}

socket.on('connect', () => {
  setStatus('Conectado al sistema en tiempo real.');
  socket.emit('device_hello', {
    displayName: 'Visor móvil',
    kind: 'viewer'
  });
  socket.emit('location_update', { gps: myLocation });
  startLocationHeartbeat();
  if (shouldActivateQr) {
    startFenceSync();
  }
});

socket.on('snapshot', (snapshot) => {
  pushRisk(snapshot);
});

socket.on('state_update', (payload) => {
  const risk = payload?.risk;
  if (!risk) return;
  const at = timeLabel(payload?.timestamp);

  if (risk === 'CRITICO') {
    riskInfoEl.textContent = `🔴 ${at} · Alerta crítica sincronizada desde dashboard.`;
    speakRiskAlert('Alerta crítica detectada. Mantente fuera de la vía y prioriza zona segura.');
  } else if (risk === 'ALTO') {
    riskInfoEl.textContent = `🟠 ${at} · Alerta alta sincronizada desde dashboard.`;
    speakRiskAlert('Alerta alta detectada. Atención al entorno vial.');
  }
});

socket.on('fence_update', (payload) => {
  drawFence(payload);
});

if (btnRequestLocation) {
  btnRequestLocation.addEventListener('click', () => {
    startLocationTracking();
  });
}

map?.on?.('click', () => null);

window.addEventListener('beforeunload', () => {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  if (staleGeoMonitorId !== null) {
    clearInterval(staleGeoMonitorId);
    staleGeoMonitorId = null;
  }
  if (locationHeartbeatId !== null) {
    clearInterval(locationHeartbeatId);
    locationHeartbeatId = null;
  }
  if (shouldActivateQr) {
    stopFenceSync();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !hasPreciseLocation) {
    startLocationTracking();
  }
});

initMap();
if (shouldActivateQr) {
  setStatus('Activando ubicación GPS automáticamente desde QR...');
  autoKickGpsFromQr();
} else {
  setStatus('Pulsa "Usar mi ubicación" para activar GPS en tiempo real.');
  startLocationTracking();
}

const triggerGpsFromGesture = () => {
  if (hasPreciseLocation || hasGestureTriggeredGps) return;
  hasGestureTriggeredGps = true;
  startLocationTracking();
};

window.addEventListener('touchstart', triggerGpsFromGesture, { passive: true });
window.addEventListener('click', triggerGpsFromGesture, { passive: true });

map.on('click', (event) => {
  if (!manualModeEnabled) return;
  updateMyLocation(event.latlng.lat, event.latlng.lng);
  setStatus(`Ubicación manual: ${myLocation.lat.toFixed(5)}, ${myLocation.lng.toFixed(5)}`);
  if (shouldActivateQr) {
    drawLocalFence();
    emitFence(true, 'manual_location');
  }
});
