# 🚸 Proyecto Seguridad Vial Inteligente - Visión Cero Colombia

Sistema edge-to-cloud para reducir mortalidad de peatones en pasos de cebra bajo el **Plan Nacional de Seguridad Vial 2022-2031**, el enfoque **Sistema Seguro (ANSV)** y la filosofía **Visión Cero**.

## Mensaje de Impacto

**Tecnología al servicio de la vida. Priorizando al peatón más vulnerable para avanzar hacia cero muertes y lesiones graves en el tránsito en Colombia.**

## Arquitectura General

- **Edge AI**: SenseCraft AI + modelo custom YOLO (v8/v11) detecta actores viales por frame.
- **Backend Node.js 20 + TypeScript**:
  - Ingesta por `MQTT` o `HTTP POST`.
  - Tracking por `track_id` (fallback básico por clase/índice).
  - Cálculo de riesgo con `TTC`, `PET` y predicción de conflicto a 1-5s.
  - Persistencia de near-miss en `lowdb` (JSON local para demo competitiva).
  - Emisión en tiempo real a dashboard con `Socket.io`.

### Modelos SenseCraft soportados (ingesta)

El backend acepta y procesa estas clases en `detections[].class_name`:

- `peaton`
- `peaton_aereo` (detección cenital / vista superior)
- `movimiento_peaton` (actividad/movimiento de peatón)
- `motocicleta`
- `automovil`
- `bus_transcaribe`
- `bicicleta`
- `ciclista`
- `ambulancia`
- `gesto`
- `aparcamiento`
- `senal_paso`

Esto permite integrar modelos SenseCraft especializados para: buses, bicicletas, gestos, estacionamiento, señalización de paso y ambulancias.
- **Frontend Smart-City**:
  - KPIs en vivo, alerta visual/sonora/voz.
  - Mapa Leaflet + OSM con capas de cámaras, heatmap, choropleth demográfico y riesgo acumulado.
  - Gráficas de tendencias y tipos vehiculares.

## Estructura

```text
proyecto-seguridad-vial/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── types.ts
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── css/tailwind.css
│   ├── js/dashboard.js
│   ├── js/map.js
│   └── assets/
├── data/
│   ├── sample-sensecraft-json.json
│   ├── mock-near-miss-events.json
│   └── geojson-cartagena-manzanas-demografico-sample.json
├── docker-compose.yml
└── README.md
```

## Instalación (modo competencia en < 48h)

### 1) Requisitos

- Node.js 20+
- npm 10+
- (Opcional) broker MQTT local o Docker

### 2) Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

> En Windows PowerShell, si `npm` falla por política de ejecución, usa:

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

Servidor en: `http://localhost:4000`

### 3) Abrir Dashboard

Con backend encendido, abre:

- `http://localhost:4000`

> El frontend es servido directamente por Express. Todo (mapa + cámara IA + tracking + riesgo + telemetría) está integrado en esta única página.

## Arranque con Docker (recomendado para demo)

Desde la raíz del proyecto:

```bash
docker compose up --build
```

Con eso se levantan:

- Backend: `http://localhost:4000`
- MQTT broker (Mosquitto): `localhost:1883`

Para detener:

```bash
docker compose down
```

## Flujo de demo (sin hardware)

1. Inicia backend.
2. En el dashboard, clic en **Modo Demo Offline**.
3. El sistema procesa `data/sample-sensecraft-json.json`.
4. Observa:
   - KPIs en vivo
   - nivel de riesgo
   - alertas sonoras y de voz
   - puntos de riesgo en mapa
5. Exporta evidencia para jurado:
   - **CSV** (`/api/export/csv`)
   - **PDF diario** (`/api/export/pdf`)

## Modo Cámara del PC (detección en vivo)

1. Abre `http://localhost:4000`.
2. Clic en **Abrir cámara PC (IA)** y acepta permisos del navegador.
3. El sistema detecta en tiempo real: `peaton`, `motocicleta`, `automovil`, `bus_transcaribe` (mapeado desde clase `bus`) y `ciclista`.
4. Cada ciclo se envía al backend por `POST /api/ingest` y actualiza KPIs, riesgo y mapa.
5. Clic en **Reporte detecciones cámara** para descargar conteos acumulados por clase/cámara.

Notas:

- En modo cámara PC se usa IA en navegador (COCO-SSD) como fallback de demo; la ingesta mantiene el mismo esquema SenseCraft en backend.
- Para `gesto`, `ambulancia`, `peaton_aereo` y `movimiento_peaton` en producción, se recomienda enviar esas clases desde el modelo custom de SenseCraft (edge), porque el fallback del navegador no está entrenado específicamente para todas ellas.
- La app intenta usar la geolocalización actual del equipo para ubicar la cámara en el mapa.
- Si no hay permiso de ubicación, usa coordenadas de Cartagena por defecto.

## MQTT y HTTP

### Ingesta HTTP

Endpoint:

- `POST /api/ingest`

Payload esperado (ejemplo):

```json
{
  "camera_id": "cam-001-cartagena-centro",
  "timestamp": "2026-02-24T15:40:00.250Z",
  "gps": { "lat": 10.4236, "lng": -75.5457 },
  "frame_size": { "width": 1280, "height": 720 },
  "crosswalk_polygon": [{ "x": 520, "y": 380 }, { "x": 880, "y": 380 }, { "x": 980, "y": 580 }, { "x": 470, "y": 580 }],
  "detections": [
    { "track_id": "p-101", "class_name": "peaton", "confidence": 0.95, "bbox": { "x": 680, "y": 435, "width": 60, "height": 150 } },
    { "track_id": "m-202", "class_name": "motocicleta", "confidence": 0.92, "bbox": { "x": 560, "y": 455, "width": 100, "height": 100 } }
  ]
}
```

### Ingesta MQTT

- Configura `.env`:
  - `USE_MQTT=true`
  - `MQTT_BROKER_URL=mqtt://localhost:1883`
  - `MQTT_TOPIC=sensecraft/crosswalk/cam-001`

## Lógica de Riesgo (resumen técnico)

`calculateRisk()` pondera:

- Peatón dentro de cebra.
- Vehículo con trayectoria hacia cebra.
- Velocidad vehicular > 30 km/h.
- **TTC**:
  - `< 2.5s` crítico.
- **PET**:
  - `< 1.5s` crítico.
- Predicción de conflicto (1-5s).

Salida: `BAJO | MEDIO | ALTO | CRITICO` + factores explicativos + acción recomendada.

## Endpoints principales

- `GET /api/health`
- `POST /api/ingest`
- `POST /api/simulate/offline`
- `GET /api/events`
- `GET /api/stats?period=hour|day|week`
- `GET /api/export/csv`
- `GET /api/export/pdf`

## Script generador de datos falsos

```bash
cd backend
npm run seed
```

Genera frames sintéticos en `data/sample-sensecraft-json.json`.

## Cómo impresionar al jurado (guion de 5 minutos)

1. **Problema real local**: siniestros peatonales en cebra (Caribe colombiano).
2. **Sistema proactivo**: no esperamos el choque, predecimos conflicto con TTC/PET.
3. **Enfoque demográfico**: priorización por vulnerabilidad (niñez/adulto mayor/IPM).
4. **Escalabilidad ciudad**: botón “Simular múltiples cámaras”.
5. **Evidencia de gestión pública**: exportes CSV/PDF para secretarías de movilidad.
6. **Cierre social**: “No se trata de cámaras, se trata de vidas salvadas”.

## Roadmap post-competencia

- Homografía calibrada por cámara para velocidad métrica real.
- Filtro de Kalman robusto y re-identificación multi-cámara.
- Integración con paneles VMS y semáforos inteligentes.
- Analítica espacial avanzada (kernel density + priorización de intervención).

---

Proyecto orientado a impacto público, innovación tecnológica y despliegue rápido para pilotos en Magdalena, Bolívar y región Caribe.

## Documentación técnica completa

- Especificaciones funcionales y no funcionales
- Librerías y stack usado (frontend/backend/infra)
- Contratos de datos (`state_update`, `objects_update`)
- Patrones de diseño aplicados
- Parámetros de ajuste y pruebas manuales

Ver: `docs/ESPECIFICACIONES-TECNICAS.md`
