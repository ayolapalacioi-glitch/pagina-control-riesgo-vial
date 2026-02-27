let map;
let cameraLayer;
let heatLayer;
let demographicLayer;
let riskLayer;
let historicalLayer;
let liveTracksLayer;

const cameraRegistry = new Map();
const heatPoints = [];
let userLocationMarker;
const liveTrackRegistry = new Map();

function demographicColor(score) {
  return score > 0.75 ? '#8b0000'
    : score > 0.55 ? '#d95f0e'
    : score > 0.35 ? '#f59e0b'
    : '#16a34a';
}

window.initMap = async function initMap() {
  map = L.map('map').setView([10.4236, -75.5457], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  cameraLayer = L.layerGroup().addTo(map);
  riskLayer = L.layerGroup().addTo(map);
  historicalLayer = L.layerGroup().addTo(map);
  liveTracksLayer = L.layerGroup().addTo(map);

  const geojson = await fetch('/data/geojson-cartagena-manzanas-demografico-sample.json').then((res) => res.json());

  demographicLayer = L.geoJSON(geojson, {
    style: (feature) => ({
      fillColor: demographicColor(feature.properties.vulnerability_score),
      weight: 1,
      opacity: 1,
      color: '#e2e8f0',
      fillOpacity: 0.35
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <b>${p.zone}</b><br/>
        Población: ${p.population}<br/>
        % Adulto mayor: ${p.elderly_pct}%<br/>
        % Niñez: ${p.children_pct}%<br/>
        IPM: ${p.ipm}<br/>
        Vulnerabilidad: ${p.vulnerability_score}
      `);
      layer.on('click', () => {
        const target = document.getElementById('riskDetails');
        target.textContent = `Zona ${p.zone}: población ${p.population}, vulnerabilidad ${p.vulnerability_score}. Priorizar control de velocidad y campañas.`;
      });
    }
  }).addTo(map);

  heatLayer = L.heatLayer([], { radius: 28, blur: 22, maxZoom: 17 });

  const historical = await fetch('/data/cartagena-siniestros-publicos-sample.json').then((res) => res.json());
  historical.forEach((item) => {
    const color = item.severity === 'mortal' ? '#ef4444' : item.severity === 'grave' ? '#f97316' : '#f59e0b';
    const marker = L.circleMarker([item.lat, item.lng], {
      radius: item.severity === 'mortal' ? 7 : 5,
      color,
      weight: 2,
      fillOpacity: 0.45
    }).bindPopup(`<b>Siniestralidad histórica</b><br/>Fecha: ${item.date}<br/>Usuario: ${item.road_user}<br/>Severidad: ${item.severity}`);
    marker.addTo(historicalLayer);
  });

  L.control.layers({}, {
    'Cámaras': cameraLayer,
    'Heatmap near-miss': heatLayer,
    'Choropleth demográfico': demographicLayer,
    'Riesgo acumulado': riskLayer,
    'Siniestralidad histórica': historicalLayer,
    'Tracks tiempo real': liveTracksLayer
  }).addTo(map);
};

window.updateMapFromObjectsEnvelope = function updateMapFromObjectsEnvelope(envelope) {
  if (!map || !envelope || !Array.isArray(envelope.objects)) return;

  const now = Date.now();
  const seen = new Set();

  envelope.objects.forEach((obj) => {
    if (!obj?.id || !obj?.latLng) return;
    seen.add(obj.id);

    const latlng = [obj.latLng.lat, obj.latLng.lng];
    const popup = `
      <b>${obj.id}</b><br/>
      Tipo: ${obj.classType || 'N/A'}<br/>
      Riesgo: ${envelope.state?.risk || 'Bajo'}<br/>
      Score: ${typeof obj.score === 'number' ? (obj.score * 100).toFixed(1) + '%' : 'N/A'}
    `;

    if (!liveTrackRegistry.has(obj.id)) {
      const marker = L.circleMarker(latlng, {
        radius: 6,
        color: '#7dd3fc',
        weight: 2,
        fillOpacity: 0.35
      }).addTo(liveTracksLayer);

      const trail = L.polyline([latlng], {
        color: '#38bdf8',
        weight: 2,
        opacity: 0.7
      }).addTo(liveTracksLayer);

      liveTrackRegistry.set(obj.id, { marker, trail, points: [latlng], updatedAt: now });
    }

    const item = liveTrackRegistry.get(obj.id);
    item.updatedAt = now;
    item.marker.setLatLng(latlng);
    item.marker.bindPopup(popup);

    item.points.push(latlng);
    if (item.points.length > 20) item.points.shift();
    item.trail.setLatLngs(item.points);
  });

  liveTrackRegistry.forEach((entry, id) => {
    if (seen.has(id)) return;
    if (now - entry.updatedAt > 5000) {
      liveTracksLayer.removeLayer(entry.marker);
      liveTracksLayer.removeLayer(entry.trail);
      liveTrackRegistry.delete(id);
    }
  });

  if (envelope.state?.risk === 'Crítico' && envelope.objects[0]?.latLng) {
    map.setView([envelope.objects[0].latLng.lat, envelope.objects[0].latLng.lng], Math.max(map.getZoom(), 15));
  }
};

window.setMapFocus = function setMapFocus(lat, lng, label) {
  if (!map) return;
  map.setView([lat, lng], 16);
  if (!userLocationMarker) {
    userLocationMarker = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#38bdf8',
      fillColor: '#38bdf8',
      fillOpacity: 0.35,
      weight: 2
    }).addTo(cameraLayer);
  }
  userLocationMarker.setLatLng([lat, lng]);
  userLocationMarker.bindPopup(`<b>${label || 'Ubicación actual'}</b>`);
};

window.updateMapFromSnapshot = function updateMapFromSnapshot(snapshot) {
  const key = snapshot.camera_id;
  const { lat, lng } = snapshot.gps;

  if (!cameraRegistry.has(key)) {
    const marker = L.marker([lat, lng]);
    marker.addTo(cameraLayer);
    cameraRegistry.set(key, marker);
  }

  const marker = cameraRegistry.get(key);
  marker.setLatLng([lat, lng]);
  marker.bindPopup(`<b>${snapshot.camera_id}</b><br/>Riesgo: ${snapshot.risk_event?.risk_level || 'BAJO'}<br/>Peatones: ${snapshot.counts.peaton}`);

  if (snapshot.risk_event) {
    heatPoints.push([lat, lng, snapshot.risk_event.risk_level === 'CRITICO' ? 1 : 0.6]);
    heatLayer.setLatLngs(heatPoints.slice(-300));

    const circle = L.circleMarker([lat, lng], {
      radius: snapshot.risk_event.risk_level === 'CRITICO' ? 10 : 6,
      color: snapshot.risk_event.risk_level === 'CRITICO' ? '#ef4444' : '#f97316'
    }).bindPopup(`Evento ${snapshot.risk_event.risk_level}`);
    circle.addTo(riskLayer);

    setTimeout(() => {
      riskLayer.removeLayer(circle);
    }, 60000);
  }
};

window.simulateMultipleCameras = function simulateMultipleCameras() {
  const base = [
    { id: 'cam-001-cartagena-centro', lat: 10.4236, lng: -75.5457 },
    { id: 'cam-002-bocagrande', lat: 10.3984, lng: -75.5533 },
    { id: 'cam-003-santa-marta-centro', lat: 11.2404, lng: -74.2110 }
  ];

  base.forEach((cam) => {
    const marker = L.marker([cam.lat, cam.lng]).addTo(cameraLayer);
    marker.bindPopup(`<b>${cam.id}</b><br/>Escenario de escalabilidad metropolitana.`);
    cameraRegistry.set(cam.id, marker);
  });
};
