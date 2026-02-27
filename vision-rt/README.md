# Vision RT (detección de siniestros viales)

Sistema web en tiempo real con visión por cámara, tracking multiobjeto, cálculo de riesgo y emisión por Socket.IO.

## Estructura

- `server.js`
- `index.html`
- `styles.css`
- `app.js`
- `map-adapter.js`
- `frame-schema.js`

## Instalación y ejecución local

```bash
cd vision-rt
npm install
npm start
```

Abrir en modo unificado (recomendado):

- `http://localhost:4000/vision`

Modo standalone (opcional, si corres `vision-rt` aparte):

- `http://localhost:3000`

## Advertencia Brave (localhost)

Si Brave bloquea modelos de IA (TFJS/coco-ssd/handpose):

1. Abrir `http://localhost:4000/vision`
2. Desactivar Shields para este sitio
3. Recargar

El arranque muestra errores explícitos para:

- permisos (`NotAllowedError`)
- ausencia de cámara (`NotFoundError`)
- timeout de modelo (`15s`)
- scripts bloqueados por Brave

## Integración con proyecto de mapa

El frontend emite por Socket.IO:

- `state_update`
- `objects_update`

`objects_update` usa:

- `VisionFrameSchema.buildObjectsEnvelope(...)`
- `MapAdapter.mapTrack(...)`

### Ejemplo payload `objects_update`

```json
{
  "schema": "vision-frame/v1",
  "cameraId": "cam-001",
  "timestamp": "2026-02-27T17:00:00.000Z",
  "state": {
    "risk": "Alto",
    "ttc": 2.1,
    "pet": 1.2,
    "vRel": 134.7
  },
  "objects": [
    {
      "id": "T0003",
      "classType": "peatón",
      "score": 0.93,
      "center": { "x": 640, "y": 300 },
      "latLng": { "lat": 10.4239, "lng": -75.5454 },
      "bbox": { "x": 612, "y": 220, "w": 58, "h": 152 },
      "predicted": { "x": 650, "y": 302 },
      "trail": [{ "x": 620, "y": 298 }, { "x": 632, "y": 300 }]
    }
  ],
  "events": [
    { "type": "autobús", "label": "autobús detectado", "trackId": "T0004" },
    { "type": "qr", "label": "QR simulado", "at": "2026-02-27T17:00:01.000Z" }
  ]
}
```

## Cómo ajustar

### `CAMERA_ID`

Editar en `app.js`:

```js
const CAMERA_ID = 'cam-001';
```

### `mapBounds`

Editar inicialización en `app.js`:

```js
const mapAdapter = new window.MapAdapter({
  north: 10.4265,
  south: 10.4203,
  east: -75.5402,
  west: -75.5498
});
```

O dinámicamente con:

```js
mapAdapter.setMapBounds({ north, south, east, west });
```

## Uso con Docker Compose del proyecto (un solo localhost)

Desde la raíz del repo:

```bash
docker compose up --build
```

Luego abre:

- `http://localhost:4000/vision`
