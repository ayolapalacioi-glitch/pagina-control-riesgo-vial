# Inventario Detallado de Funciones, Métodos y Variables

Este documento lista **todas** las funciones, métodos, clases y variables relevantes del
repositorio *Proyecto Seguridad Vial Inteligente – Visión Cero Colombia*, organizadas por
archivo y módulo.

---

## Tabla de contenido

1. [Backend – TypeScript/Node.js](#1-backend--typescriptnodejs)
   - [types.ts](#11-typests)
   - [constants/actorClasses.ts](#12-constantsactorclassts)
   - [config/env.ts](#13-configenvts)
   - [config/db.ts](#14-configdbts)
   - [config/mqtt.ts](#15-configmqtts)
   - [controllers/ingestController.ts](#16-controllersingestcontrollerts)
   - [routes/apiRoutes.ts](#17-routesapiroutests)
   - [services/tracker.ts](#18-servicestrackerts)
   - [services/riskCalculator.ts](#19-servicesriskcalculatorts)
   - [services/prediction.ts](#110-servicespredictionts)
   - [services/counts.ts](#111-servicescountsts)
   - [services/eventStore.ts](#112-serviceseventstorts)
   - [services/statsService.ts](#113-servicesstatsservicets)
   - [services/reportService.ts](#114-servicesreportservicets)
   - [services/trafficCounter.ts](#115-servicestrafficcounterts)
   - [utils/geometry.ts](#116-utilsgeometryts)
   - [utils/generateMockData.ts](#117-utilsgeneratemockdatats)
   - [server.ts](#118-serverts)
2. [Frontend – JavaScript](#2-frontend--javascript)
   - [js/frame-schema.js](#21-jsframe-schemajs)
   - [js/map-adapter.js](#22-jsmap-adapterjs)
   - [js/map.js](#23-jsmapjs)
   - [js/dashboard.js](#24-jsdashboardjs)
3. [Vision-RT – Sistema autónomo de visión](#3-vision-rt--sistema-autónomo-de-visión)
   - [server.js](#31-serverjs)
   - [frame-schema.js](#32-frame-schemajs)
   - [map-adapter.js](#33-map-adapterjs)
   - [app.js](#34-appjs)
4. [Resumen de endpoints HTTP](#4-resumen-de-endpoints-http)
5. [Resumen de eventos Socket.IO](#5-resumen-de-eventos-socketio)

---

## 1. Backend – TypeScript/Node.js

### 1.1 `types.ts`

Define los tipos e interfaces compartidos en todo el backend.

#### Tipos exportados

| Nombre | Tipo TS | Descripción |
|---|---|---|
| `ActorClass` | `type` (re-export) | Unión de las 12 clases de actores viales |
| `SenseCraftDetection` | `interface` | Detección individual recibida por frame |
| `SenseCraftFramePayload` | `interface` | Sobre completo de un frame de cámara |
| `TrackedActor` | `interface` | Actor vial con métricas de tracking |
| `RiskLevel` | `type` | `'BAJO' \| 'MEDIO' \| 'ALTO' \| 'CRITICO'` |
| `NearMissEvent` | `interface` | Evento de cuasi-colisión persistido |

#### `SenseCraftDetection`

| Campo | Tipo | Descripción |
|---|---|---|
| `track_id` | `string?` | Identificador de track (opcional) |
| `class_name` | `ActorClass` | Clase del actor detectado |
| `confidence` | `number` | Confianza del modelo (0-1) |
| `bbox.x` | `number` | Coordenada X de la esquina superior izquierda |
| `bbox.y` | `number` | Coordenada Y de la esquina superior izquierda |
| `bbox.width` | `number` | Ancho del bounding box en píxeles |
| `bbox.height` | `number` | Alto del bounding box en píxeles |

#### `SenseCraftFramePayload`

| Campo | Tipo | Descripción |
|---|---|---|
| `camera_id` | `string` | Identificador único de la cámara |
| `timestamp` | `string` | Fecha/hora ISO 8601 |
| `gps.lat` | `number` | Latitud geográfica |
| `gps.lng` | `number` | Longitud geográfica |
| `frame_size.width` | `number` | Ancho del frame en píxeles |
| `frame_size.height` | `number` | Alto del frame en píxeles |
| `crosswalk_polygon` | `Array<{x,y}>` | Polígono del cruce (mínimo 3 puntos) |
| `detections` | `SenseCraftDetection[]` | Lista de detecciones del frame |

#### `TrackedActor`

| Campo | Tipo | Descripción |
|---|---|---|
| `trackId` | `string` | ID único del track |
| `className` | `ActorClass` | Clase del actor |
| `center.x` | `number` | Centro X en píxeles |
| `center.y` | `number` | Centro Y en píxeles |
| `velocityPxPerSec.x` | `number` | Velocidad horizontal (px/s) |
| `velocityPxPerSec.y` | `number` | Velocidad vertical (px/s) |
| `speedKmh` | `number` | Rapidez en km/h |
| `headingToCrosswalk` | `boolean` | `true` si se dirige hacia el cruce |
| `inCrosswalk` | `boolean` | `true` si está dentro del polígono del cruce |
| `predictedPath` | `Array<{x,y,t}>` | Posiciones predichas para t = 1-5 s |

#### `NearMissEvent`

| Campo | Tipo | Descripción |
|---|---|---|
| `event_id` | `string` | ID compuesto único del evento |
| `camera_id` | `string` | Cámara que generó el evento |
| `timestamp` | `string` | Fecha/hora ISO del evento |
| `gps.lat` / `gps.lng` | `number` | Posición geográfica |
| `risk_level` | `RiskLevel` | Nivel de riesgo clasificado |
| `ttc_seconds` | `number \| null` | Tiempo hasta colisión en segundos |
| `pet_seconds` | `number \| null` | Post-Encroachment Time en segundos |
| `vehicle` | `TrackedActor \| null` | Actor vehículo involucrado |
| `pedestrian` | `TrackedActor \| null` | Actor peatón involucrado |
| `factors` | `string[]` | Lista de factores de riesgo identificados |
| `recommended_action` | `string` | Acción recomendada textual |
| `source` | `'mqtt' \| 'http' \| 'mock'` | Origen de la ingesta |

---

### 1.2 `constants/actorClasses.ts`

#### Variables / constantes

| Nombre | Tipo | Valor / Descripción |
|---|---|---|
| `ALL_ACTOR_CLASSES` | `readonly string[]` | Las 12 clases: `peaton`, `peaton_aereo`, `movimiento_peaton`, `motocicleta`, `automovil`, `bus_transcaribe`, `bicicleta`, `ciclista`, `ambulancia`, `gesto`, `aparcamiento`, `senal_paso` |
| `ActorClass` | `type` | Unión de literales derivada de `ALL_ACTOR_CLASSES` |
| `VEHICLE_CLASSES` | `ReadonlySet<ActorClass>` | `{ motocicleta, automovil, bus_transcaribe, ambulancia }` |
| `PEDESTRIAN_CLASSES` | `ReadonlySet<ActorClass>` | `{ peaton, peaton_aereo, movimiento_peaton, ciclista, bicicleta }` |

---

### 1.3 `config/env.ts`

#### Variables exportadas

| Variable | Tipo | Valor por defecto | Descripción |
|---|---|---|---|
| `env.port` | `number` | `4000` | Puerto TCP del servidor Express |
| `env.frontendOrigin` | `string` | `'*'` | Origen CORS permitido |
| `env.mqttBrokerUrl` | `string` | `'mqtt://localhost:1883'` | URL del broker MQTT |
| `env.mqttTopic` | `string` | `'sensecraft/crosswalk/cam-001'` | Tópico MQTT de suscripción |
| `env.useMqtt` | `boolean` | `false` | Activa el cliente MQTT |
| `env.dbMode` | `string` | `'lowdb'` | Motor de base de datos |

---

### 1.4 `config/db.ts`

#### Variables exportadas

| Nombre | Tipo | Descripción |
|---|---|---|
| `dbPromise` | `Promise<LowDB>` | Promesa que resuelve la instancia de lowdb apuntando a `../data/mock-near-miss-events.json` |

#### Variables internas

| Nombre | Tipo | Descripción |
|---|---|---|
| `DbSchema` | `type` | `{ nearMissEvents: NearMissEvent[] }` – esquema del archivo JSON |
| `dbFilePath` | `string` | Ruta absoluta al archivo de base de datos |

---

### 1.5 `config/mqtt.ts`

#### Funciones

##### `createMqttClient(onMessage)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `onMessage: (topic: string, payload: string) => void` |
| **Retorna** | `MqttClient \| null` |
| **Descripción** | Conecta al broker MQTT si `env.useMqtt` es `true`. Suscribe al tópico configurado y llama a `onMessage` por cada mensaje recibido. Retorna `null` si MQTT está desactivado. |
| **Eventos internos** | `connect`, `message`, `error` |

---

### 1.6 `controllers/ingestController.ts`

#### Variables internas (esquemas Zod)

| Nombre | Descripción |
|---|---|
| `detectionSchema` | Esquema Zod para `SenseCraftDetection` |
| `frameSchema` | Esquema Zod para `SenseCraftFramePayload` |

#### Funciones exportadas

##### `validatePayload(payload)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `payload: unknown` |
| **Retorna** | `SenseCraftFramePayload` |
| **Descripción** | Valida y parsea el payload de entrada usando Zod. Lanza excepción si no cumple el esquema. |

---

### 1.7 `routes/apiRoutes.ts`

#### Funciones exportadas

##### `buildApiRoutes(io)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `io: Server` (instancia Socket.IO) |
| **Retorna** | `Router` de Express con 8 rutas montadas |
| **Descripción** | Registra todos los endpoints REST de la API. |

#### Endpoints registrados por `buildApiRoutes`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Devuelve `{ status:'ok', service:'seguridad-vial-backend' }` |
| `POST` | `/ingest` | Ingesta un frame, calcula riesgo, emite `snapshot` por Socket.IO |
| `POST` | `/simulate/offline` | Procesa todos los frames de `sample-sensecraft-json.json` |
| `GET` | `/events` | Devuelve todos los near-miss events almacenados |
| `GET` | `/stats?period=hour\|day\|week` | Estadísticas agregadas por período |
| `GET` | `/report/traffic` | Reporte de conteo de tráfico por cámara |
| `GET` | `/export/csv` | Descarga eventos como archivo CSV |
| `GET` | `/export/pdf` | Descarga reporte diario en PDF |

---

### 1.8 `services/tracker.ts`

#### Variables internas (módulo)

| Nombre | Tipo | Descripción |
|---|---|---|
| `trackMemory` | `Map<string, TrackState>` | Historial de posición y velocidad por track ID |
| `pxToMeter` | `number` (`0.08`) | Factor de conversión píxel → metro |

#### Tipos internos

| Nombre | Campos | Descripción |
|---|---|---|
| `TrackState` | `lastCenter`, `lastTs`, `velocity` | Estado previo de un track para calcular velocidad |

#### Funciones exportadas

##### `updateTracks(payload)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `payload: SenseCraftFramePayload` |
| **Retorna** | `TrackedActor[]` |
| **Descripción** | Para cada detección del frame: <br>• Calcula el centro del bbox.<br>• Recupera velocidad previa de `trackMemory`.<br>• Aplica suavizado exponencial `0.7 × prev + 0.3 × raw`.<br>• Convierte velocidad a km/h usando `pxToMeter`.<br>• Determina si el actor se dirige al cruce (`headingToCrosswalk`).<br>• Verifica si está dentro del polígono del cruce (`inCrosswalk`).<br>• Genera `predictedPath` para t = 1, 2, 3, 4, 5 s.<br>• Actualiza `trackMemory`. |

---

### 1.9 `services/riskCalculator.ts`

#### Funciones internas

##### `classifyRisk(score)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `score: number` |
| **Retorna** | `RiskLevel` |
| **Descripción** | Convierte puntuación numérica en nivel de riesgo: ≥90 → `CRITICO`, ≥65 → `ALTO`, ≥40 → `MEDIO`, <40 → `BAJO`. |

#### Funciones exportadas

##### `calculateRisk(payload, tracks, source)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `payload: SenseCraftFramePayload`, `tracks: TrackedActor[]`, `source: NearMissEvent['source']` |
| **Retorna** | `NearMissEvent \| null` |
| **Descripción** | Evalúa todas las combinaciones peatón-vehículo y elige el par de mayor puntuación. Puntuación base 10, más bonus: <br>+25 peatón en cebra <br>+20 vehículo apuntando a cebra <br>+20 velocidad > 30 km/h <br>+15 ambulancia <br>+30/+15 TTC < 2.5 s / < 4 s <br>+20/+10 PET < 1.5 s / < 3 s <br>+25 conflicto predicho 1-5 s. |

---

### 1.10 `services/prediction.ts`

#### Funciones exportadas

##### `computeTTC(vehicle, pedestrian)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `vehicle: TrackedActor`, `pedestrian: TrackedActor` |
| **Retorna** | `number \| null` |
| **Descripción** | Calcula el **Time-to-Collision** en segundos. Fórmula: `distanciaRelativa / velocidadRelativa`. Retorna `null` si la velocidad relativa < 1 px/frame. |

##### `computePET(vehicle, pedestrian)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `vehicle: TrackedActor`, `pedestrian: TrackedActor` |
| **Retorna** | `number \| null` |
| **Descripción** | Calcula el **Post-Encroachment Time** en segundos. Compara el tiempo que tardaría cada actor en llegar al mismo punto. Fórmula: `|tiempoVehículo - tiempoPeatón|`. Usa velocidad mínima de 1 para evitar división por cero. |

##### `predictedConflictWithinSeconds(vehicle, pedestrian, thresholdPx?)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `vehicle: TrackedActor`, `pedestrian: TrackedActor`, `thresholdPx = 28` |
| **Retorna** | `boolean` |
| **Descripción** | Recorre los `predictedPath` de ambos actores. Si en algún paso temporal la distancia entre sus posiciones predichas ≤ `thresholdPx`, retorna `true`. |

---

### 1.11 `services/counts.ts`

#### Funciones exportadas

##### `buildCounts(tracks)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `tracks: TrackedActor[]` |
| **Retorna** | `{ peaton, motocicleta, automovil, bus_transcaribe, ciclista, full }` |
| **Descripción** | Cuenta cuántos tracks hay de cada clase. `full` es un `Record<ActorClass, number>` con las 12 clases. |

---

### 1.12 `services/eventStore.ts`

#### Funciones exportadas

##### `saveEvent(event)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `event: NearMissEvent` |
| **Retorna** | `Promise<void>` |
| **Descripción** | Agrega el evento al array `nearMissEvents` en lowdb. Limita a 5 000 eventos (FIFO). Llama a `db.write()` para persistir. |

##### `getAllEvents()`

| Elemento | Detalle |
|---|---|
| **Parámetros** | ninguno |
| **Retorna** | `Promise<NearMissEvent[]>` |
| **Descripción** | Devuelve todos los eventos almacenados. |

##### `getEventsSince(hoursBack)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `hoursBack: number` |
| **Retorna** | `Promise<NearMissEvent[]>` |
| **Descripción** | Filtra eventos cuyo `timestamp` sea >= `Date.now() - hoursBack * 3600 * 1000`. |

---

### 1.13 `services/statsService.ts`

#### Funciones exportadas

##### `aggregateStats(events)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `events: NearMissEvent[]` |
| **Retorna** | `{ totalEvents, riskCount, byHour, vehicleTypes }` |
| **Descripción** | Recorre los eventos y acumula:<br>• `riskCount`: conteo por nivel `{BAJO, MEDIO, ALTO, CRITICO}`.<br>• `byHour`: array de 24 posiciones `{hour, count}` con actividad por hora.<br>• `vehicleTypes`: conteo por clase de vehículo involucrado.<br>• `totalEvents`: longitud total del array. |

---

### 1.14 `services/reportService.ts`

#### Variables internas

| Nombre | Tipo | Descripción |
|---|---|---|
| `reportsDir` | `string` | Ruta absoluta al directorio `../data/reports` |

#### Funciones internas

##### `ensureReportsDir()`

| Descripción |
|---|
| Crea el directorio de reportes si no existe. |

#### Funciones exportadas

##### `exportEventsToCsv(events)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `events: NearMissEvent[]` |
| **Retorna** | `string` (ruta del archivo generado) |
| **Columnas CSV** | `event_id, timestamp, camera_id, lat, lng, risk_level, ttc_seconds, pet_seconds, vehicle, vehicle_speed_kmh, pedestrian` |
| **Descripción** | Genera un CSV en `../data/reports/near-miss-{timestamp}.csv` usando `csv-stringify`. |

##### `exportDailyPdf(events)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `events: NearMissEvent[]` |
| **Retorna** | `Promise<string>` (ruta del PDF generado) |
| **Descripción** | Genera un PDF en `../data/reports/reporte-diario-{timestamp}.pdf` usando pdfkit. Incluye: título, misión, totales por nivel de riesgo y los últimos 8 eventos. |

---

### 1.15 `services/trafficCounter.ts`

#### Variables internas (módulo)

| Nombre | Tipo | Descripción |
|---|---|---|
| `TRACK_TTL_MS` | `number` (`20 000`) | Tiempo de vida de un track en el registro (ms) |
| `sessionStartedAt` | `string` | ISO timestamp del inicio de sesión del proceso |
| `globalTotals` | `Totals` | Conteo global acumulado de todas las clases |
| `totalsByCamera` | `Map<string, Totals>` | Conteo por `camera_id` |
| `trackSeen` | `Map<string, TrackSeenState>` | Registro de tracks vistos: `"cameraId:trackId"` → `{className, lastSeenAt}` |

#### Tipos internos

| Nombre | Campos | Descripción |
|---|---|---|
| `Totals` | `Record<ActorClass, number>` | Mapa clase → conteo |
| `CameraReport` | `camera_id, totals, active_tracks` | Reporte por cámara |
| `TrackSeenState` | `className, lastSeenAt` | Estado del track en el registro |

#### Funciones internas

##### `zeroTotals()`

Devuelve un objeto `Totals` con todas las clases en 0.

##### `getCameraTotals(cameraId)`

Inicializa e inserta en `totalsByCamera` si la cámara no existe; retorna el objeto de totales.

##### `cleanupOldTracks(nowTs)`

Elimina de `trackSeen` los tracks cuyo `lastSeenAt` supera `TRACK_TTL_MS`.

#### Funciones exportadas

##### `registerTracksForReport(cameraId, tracks, timestamp)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `cameraId: string`, `tracks: TrackedActor[]`, `timestamp: string` |
| **Retorna** | `void` |
| **Descripción** | Para cada track nuevo (o expirado), incrementa `globalTotals` y el total de la cámara. Actualiza `trackSeen` con el timestamp actual. |

##### `getTrafficReport()`

| Elemento | Detalle |
|---|---|
| **Parámetros** | ninguno |
| **Retorna** | `{ generated_at, session_started_at, totals, by_camera }` |
| **Descripción** | Construye el reporte de tráfico acumulado desde el inicio de sesión, incluyendo tracks activos por cámara. |

---

### 1.16 `utils/geometry.ts`

#### Funciones exportadas

##### `pointInPolygon(point, polygon)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `point: {x,y}`, `polygon: Array<{x,y}>` |
| **Retorna** | `boolean` |
| **Descripción** | Algoritmo de ray-casting. Lanza un rayo horizontal desde `point` y cuenta intersecciones con los lados del polígono. |

##### `distance(a, b)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `a: {x,y}`, `b: {x,y}` |
| **Retorna** | `number` |
| **Descripción** | Distancia euclidiana: `Math.hypot(a.x - b.x, a.y - b.y)`. |

##### `polygonCentroid(polygon)`

| Elemento | Detalle |
|---|---|
| **Parámetros** | `polygon: Array<{x,y}>` |
| **Retorna** | `{x, y}` |
| **Descripción** | Centroide como media aritmética de todos los vértices. |

---

### 1.17 `utils/generateMockData.ts`

Script de generación de datos sintéticos (no exporta módulo, se ejecuta directamente).

#### Variables internas

| Nombre | Tipo | Descripción |
|---|---|---|
| `classes` | `readonly string[]` | `['peaton', 'motocicleta', 'automovil', 'bus_transcaribe', 'ciclista']` |
| `outputPath` | `string` | Ruta de salida: `../data/sample-sensecraft-json.json` |

#### Funciones internas

##### `rand(min, max)`

| Parámetros | Retorna | Descripción |
|---|---|---|
| `min: number`, `max: number` | `number` | Número aleatorio en [min, max) |

##### `randomDetection(trackId)`

| Parámetros | Retorna | Descripción |
|---|---|---|
| `trackId: string` | `object` | Genera una detección aleatoria: clase, confianza y bbox con coordenadas aleatorias |

##### `generateFrames(totalFrames?)`

| Parámetros | Retorna | Descripción |
|---|---|---|
| `totalFrames = 80` | `Frame[]` | Genera N frames a intervalos de 200 ms, cada uno con 4-12 detecciones. Coordenadas GPS fijas: `10.4236, -75.5457`. |

---

### 1.18 `server.ts`

Punto de entrada del backend. Configura Express, Socket.IO y el cliente MQTT.

#### Variables principales

| Nombre | Tipo | Descripción |
|---|---|---|
| `app` | `Express` | Aplicación Express |
| `server` | `http.Server` | Servidor HTTP |
| `io` | `Server` (Socket.IO) | Instancia del servidor WebSocket |
| `DEFAULT_GPS` | `{lat, lng}` | `{ lat: 10.4236, lng: -75.5457 }` |

#### Middleware y rutas estáticas

| Ruta | Directorio servido |
|---|---|
| `/data` | `../data` |
| `/` | `../frontend` |
| `/vision` | `../vision-rt` |
| `/api` | Router de `buildApiRoutes` |

#### Manejadores Socket.IO

| Evento entrante | Comportamiento |
|---|---|
| `connection` | Loga el ID del cliente. Emite `message` de bienvenida al socket. |
| `state_update` | Re-emite el payload a todos los clientes con `source` y `timestamp` añadidos. |
| `objects_update` | Re-emite el payload a todos los clientes con `source` y `timestamp` añadidos. |

#### Manejador MQTT (función anónima async)

Cuando llega un mensaje MQTT:
1. Parsea JSON del mensaje.
2. Llama a `validatePayload`.
3. Llama a `updateTracks`.
4. Llama a `calculateRisk`.
5. Llama a `registerTracksForReport`.
6. Llama a `buildCounts`.
7. Construye `snapshot` y llama a `saveEvent` si el riesgo es `ALTO` o `CRITICO`.
8. Emite `snapshot` a todos los clientes WebSocket.

---

## 2. Frontend – JavaScript

### 2.1 `js/frame-schema.js`

Expone `window.VisionFrameSchema` mediante una IIFE.

#### Clase `VisionFrameSchema`

##### Método estático `buildObjectsEnvelope({ cameraId, timestamp, risk, ttc, pet, vRel, objects, events })`

| Retorna | Descripción |
|---|---|
| `VisionFrame` | Construye el sobre canónico de un frame de visión |

**Estructura del objeto retornado:**

```js
{
  schema: 'vision-frame/v1',
  cameraId: string,
  timestamp: string,           // ISO 8601
  state: { risk, ttc, pet, vRel },
  objects: [...],              // array (o [] si no es array)
  events:  [...]               // array (o [] si no es array)
}
```

---

### 2.2 `js/map-adapter.js`

Expone `window.MapAdapter` mediante una IIFE.

#### Clase `MapAdapter`

##### Constructor `constructor(bounds?)`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `bounds` | `{north, south, east, west}` | Caja geográfica (lat/lng). Defecto: zona Cartagena |

##### Propiedad de instancia

| Nombre | Tipo | Descripción |
|---|---|---|
| `bounds` | `{north, south, east, west}` | Caja geográfica activa |

##### Método `setMapBounds(bounds)`

Actualiza `this.bounds` fusionando los nuevos valores.

##### Método `normalizePoint(point, canvasSize)`

| Parámetros | Retorna | Descripción |
|---|---|---|
| `point: {x,y}`, `canvasSize: {width,height}` | `{x, y}` ∈ [0,1] | Normaliza coordenadas de píxel a rango [0,1] |

##### Método `toLatLng(point, canvasSize)`

| Parámetros | Retorna | Descripción |
|---|---|---|
| `point: {x,y}`, `canvasSize: {width,height}` | `{lat, lng}` | Convierte píxel a coordenada geográfica. Fórmula: `lat = north - (north-south)×norm_y` |

##### Método `mapTrack(track, canvasSize)`

| Parámetros | Retorna | Descripción |
|---|---|---|
| `track`, `canvasSize` | `MappedTrack` | Devuelve `{id, classType, score, center, latLng, bbox, predicted, trail}` |

---

### 2.3 `js/map.js`

Gestión del mapa Leaflet. Todas las funciones se exponen como `window.*`.

#### Variables de módulo

| Nombre | Tipo | Descripción |
|---|---|---|
| `map` | `L.Map` | Instancia Leaflet |
| `cameraLayer` | `L.LayerGroup` | Marcadores de cámaras |
| `heatLayer` | `L.HeatLayer` | Capa de heatmap de near-miss |
| `demographicLayer` | `L.GeoJSON` | Choropleth de vulnerabilidad demográfica |
| `riskLayer` | `L.LayerGroup` | Círculos de eventos de riesgo |
| `historicalLayer` | `L.LayerGroup` | Marcadores de siniestros históricos |
| `liveTracksLayer` | `L.LayerGroup` | Tracks en tiempo real |
| `cameraRegistry` | `Map<string, L.Marker>` | Marcadores indexados por `camera_id` |
| `heatPoints` | `Array` | Puntos acumulados del heatmap |
| `userLocationMarker` | `L.CircleMarker` | Marcador de posición del usuario |
| `liveTrackRegistry` | `Map<string, {marker, trail, points, updatedAt}>` | Registro de tracks vivos |

#### Funciones internas

##### `demographicColor(score)`

| Parámetros | Retorna | Descripción |
|---|---|---|
| `score: number` | `string` (color hex) | >0.75 → rojo oscuro, >0.55 → naranja, >0.35 → ámbar, else → verde |

#### Funciones exportadas (window)

##### `window.initMap()`

| Retorna | Descripción |
|---|---|
| `Promise<void>` | Inicializa el mapa Leaflet, carga capas GeoJSON demográfica e histórica, configura el control de capas. |

##### `window.updateMapFromObjectsEnvelope(envelope)`

| Parámetros | Descripción |
|---|---|
| `envelope: VisionFrame` | Crea o actualiza marcadores y trails para cada objeto del envelope. Elimina tracks inactivos >5 s. Hace pan al mapa si riesgo es `Crítico`. |

##### `window.setMapFocus(lat, lng, label?)`

| Parámetros | Descripción |
|---|---|
| `lat, lng: number`, `label?: string` | Centra el mapa en zoom 16 y actualiza el marcador de usuario. |

##### `window.updateMapFromSnapshot(snapshot)`

| Parámetros | Descripción |
|---|---|
| `snapshot: object` | Actualiza el marcador de la cámara, agrega punto al heatmap y dibuja círculo de riesgo (auto-eliminado a los 60 s). |

##### `window.simulateMultipleCameras()`

Agrega marcadores de 3 cámaras de demostración: Cartagena Centro, Bocagrande y Santa Marta.

---

### 2.4 `js/dashboard.js`

Lógica principal del dashboard (≈1 055 líneas). Ejecuta en el contexto global de la página.

#### Constantes globales

| Nombre | Valor | Descripción |
|---|---|---|
| `API_BASE` | `'http://localhost:4000/api'` | Base URL de la API |
| `CAMERA_ID` | `'cam-pc-live-001'` | ID de la cámara web local |
| `DETECTION_ENGINE` | `'sensecraft'` | Motor de detección activo |
| `MODEL_TIMEOUT_MS` | `15 000` | Timeout de carga del modelo (ms) |
| `REALTIME_WINDOW` | `60` | Puntos en la ventana de series temporales |
| `CLASS_MAP` | `object` | Mapeo clases coco-ssd → clases de dominio |
| `ANIMAL_CLASSES` | `Set` | Clases de animales de coco-ssd |
| `SPECIAL_EVENTS` | `Set` | Clases que generan badge especial |
| `CLASS_COLORS` | `object` | Color hex por clase de actor |
| `messages` | `string[]` | Mensajes de sensibilización vial |

#### Variables de estado global

| Nombre | Tipo | Descripción |
|---|---|---|
| `hourlyChart` | `Chart` | Instancia Chart.js de la gráfica horaria |
| `vehicleChart` | `Chart` | Instancia Chart.js de tipos vehiculares |
| `cameraStream` | `MediaStream` | Stream de la cámara web |
| `currentGps` | `{lat,lng}` | GPS actual del dispositivo |
| `realtimeSeries` | `Array` | Buffer circular de métricas en tiempo real |
| `detector` | `SenseCraftDetector \| null` | Instancia del detector |
| `handModel` | `Handpose \| null` | Modelo de manos TensorFlow |
| `isRunning` | `boolean` | Estado del loop de cámara |
| `frameClock` | `number` | Timestamp del último frame procesado |
| `nextTrackId` | `number` | Contador de track IDs (desde 1) |
| `tracks` | `Array` | Tracks activos actuales |
| `lastEmittedEvents` | `Array` | Eventos emitidos en el último frame |
| `lastIngestMs` | `number` | Timestamp del último POST HTTP |
| `eventCooldown` | `Map` | Cooldown por tipo de evento especial |

#### Referencias DOM

| Variable | Elemento HTML |
|---|---|
| `riskPill` | `#riskPill` |
| `riskDetails` | `#riskDetails` |
| `eventList` | `#eventList` |
| `modelCounts` | `#modelCounts` |
| `cameraVideo` | `#cameraVideo` |
| `cameraCanvas` | `#cameraCanvas` |
| `cameraStatus` | `#cameraStatus` |
| `visionRtStatus` | `#visionRtStatus` |
| `objectsLiveList` | `#objectsLiveList` |
| `liveBadges` | `#liveBadges` |
| `liveEngine` | `#liveEngine` |
| `liveRisk` | `#liveRisk` |
| `liveObjCount` | `#liveObjCount` |
| `liveTTC` | `#liveTTC` |
| `livePET` | `#livePET` |
| `liveVRel` | `#liveVRel` |
| `vehicleTableBody` | `#vehicleTableBody` |
| `cameraCtx` | Contexto 2D de `cameraCanvas` |
| `cropCanvas` | Canvas temporal para recortes |
| `cropCtx` | Contexto 2D de `cropCanvas` |
| `mapAdapter` | Instancia `MapAdapter` |

#### Clase `SenseCraftDetector`

##### `constructor()`

Inicializa `this.detector = null` y `this.name = 'compat coco-ssd'`.

##### `async init()`

Intenta cargar `window.sensecraft` o `window.SenseCraft`. Si no están disponibles, carga `cocoSsd.load()`. Lanza error si TensorFlow.js no está disponible.

##### `async detect(videoElement)`

| Parámetros | Retorna | Descripción |
|---|---|---|
| `videoElement: HTMLVideoElement` | `Array<{class, score, bbox}>` | Llama al método apropiado del detector (`detect`, `predict` o `infer`) y normaliza el resultado. |

##### `normalizeDetections(raw)`

Convierte la salida cruda del modelo a formato estandarizado con `class`, `score` y `bbox` en píxeles de video.

#### Funciones de utilidad

##### `withTimeout(promise, timeoutMs, msg)`

| Parámetros | Retorna | Descripción |
|---|---|---|
| `promise`, `timeoutMs: number`, `msg: string` | `Promise` | Rechaza la promesa si no resuelve dentro del timeout. |

##### `showStartupError(error)`

Muestra el error de arranque en la UI según el tipo de excepción.

##### `playBeep()`

Genera un pitido de 880 Hz durante 160 ms usando la API Web Audio.

##### `speakAlert(text)`

Anuncia el texto en español (es-CO) mediante la API SpeechSynthesis.

##### `detectLocation()`

Solicita geolocalización al navegador y actualiza `currentGps`. Llama a `window.setMapFocus`.

##### `addRealtimeBadge(label)`

Agrega un badge con el evento especial detectado a `#liveBadges`.

##### `pushEventLine(text)`

Inserta una nueva línea en `#eventList` con timestamp.

#### Funciones de transformación de coordenadas

##### `getVideoToCanvasTransform()`

Calcula `scale` y `offset` para mapear coordenadas del video al canvas (letter-boxing).

##### `videoBboxToCanvasBbox(bbox, transform)`

Aplica la transformación video→canvas al bounding box.

##### `canvasBboxToVideoBbox(bbox, transform)`

Transformación inversa canvas→video.

##### `toVideoPixelBbox(bbox, videoW, videoH)`

Maneja bboxes normalizadas [0,1] o ya en píxeles, y las devuelve siempre en píxeles de video.

##### `clampBboxToCanvas(bbox)`

Recorta el bbox para que quede dentro de los límites del canvas.

#### Funciones de detección y normalización

##### `normalizeClass(rawClass)`

Mapea clases coco-ssd (ej. `person`) a clases de dominio (ej. `peaton`). Detecta animales y retorna `animal`.

##### `refineBboxForClass(classType, bbox)`

Ajusta el bbox según la clase: para `peaton` aplica `sx=0.82, sy=0.9`; para `ambulancia` usa valores distintos, etc.

#### Funciones de tracking

##### `updateTracks(detections, nowMs)`

| Parámetros | Descripción |
|---|---|
| `detections: Array`, `nowMs: number` | Matching por costo mínimo (distancia + 1-IoU + penalización de clase). Suavizado exponencial 55% historia. Mantiene trail de 20 puntos. Elimina tracks sin actualización >1 200 ms. Calcula velocidad y posición predicha (+450 ms). |

#### Funciones de cálculo de riesgo

##### `classifyRisk(ttc, pet, vRel, hasConflict)`

| Retorna | Descripción |
|---|---|
| `RiskLevel` | Puntuación: conflicto+1, vRel>110+1, ttc<2.5+2, pet<1.5+2. ≥5→CRITICO, ≥3→ALTO, ≥2→MEDIO, else→BAJO. |

##### `computeRiskMetrics()`

| Retorna | `{ risk, ttc, pet, vRel }` |
|---|---|
| **Descripción** | Encuentra el par peatón-vehículo más cercano y calcula las métricas de riesgo. |

#### Funciones de actualización de UI

##### `updateMainRiskUi(metrics)`

Actualiza `riskPill`, colores de estado, `liveRisk`, `liveTTC`, `livePET`, `liveVRel` y los detalles de riesgo.

##### `updateKpisFromTracks()`

Cuenta tracks por clase y actualiza los KPI `kpiPeaton`, `kpiMoto`, `kpiAuto`, `kpiBus`. Retorna el objeto `counters`.

##### `renderVehicleTable(counters)`

Genera las filas HTML de `vehicleTableBody` con el conteo por clase.

##### `updateRealtimeCharts(counters, metrics)`

Añade un punto a `realtimeSeries` (ventana deslizante de 60 puntos) y actualiza:
- `hourlyChart`: línea de objetos detectados + nivel de riesgo.
- `vehicleChart`: barras de tipos vehiculares.

##### `renderObjectList()`

Genera el HTML de la lista `#objectsLiveList` con cada track activo.

##### `drawTrack(track)`

Dibuja en `cameraCanvas`: bounding box, etiqueta, trail (20 puntos), flecha de predicción y velocidad.

#### Funciones de detección especial

##### `detectAmbulanceHeuristic(bbox, transform)`

| Retorna | Descripción |
|---|---|
| `Promise<boolean>` | Recorta la región del bbox en `cropCanvas`, analiza píxeles. Si ratio rojo > 8% y ratio blanco > 12%, clasifica como `ambulancia`. |

##### `detectHands(transform)`

| Retorna | Descripción |
|---|---|
| `Promise<Hand[]>` | Ejecuta el modelo `handpose`. Estima la posición de la mano como bbox y genera detecciones de clase `gesto`. |

#### Funciones de ingesta y emisión

##### `toIngestPayload(transform)`

| Retorna | Descripción |
|---|---|
| `SenseCraftFramePayload` | Convierte los tracks activos (máx. 25) al formato de ingesta del backend. Genera el polígono del cruce como rectángulo sintético. Transforma coordenadas de canvas a video. |

##### `emitRealtime(metrics, transform)`

| Descripción |
|---|
| Emite `state_update` por Socket.IO. Emite `objects_update` con el envelope completo. Realiza POST HTTP a `/api/ingest` (throttle ~1 100 ms). Llama a `window.updateMapFromObjectsEnvelope`. |

#### Bucle principal

##### `processFrame(now)`

Función principal del animation loop (requestAnimationFrame):
1. Aplica throttle a ~10 FPS (ventana de 90 ms).
2. Detecta objetos con `detector.detect()`.
3. Detecta manos con `detectHands()`.
4. Verifica heurística de ambulancia.
5. Actualiza tracks con `updateTracks()`.
6. Calcula riesgo con `computeRiskMetrics()`.
7. Actualiza UI: KPIs, riesgo, gráficas, tabla.
8. Dibuja tracks en canvas.
9. Emite datos por `emitRealtime()`.
10. Programa siguiente frame.

#### Funciones de control de cámara

##### `startCameraMode()`

| Retorna | Descripción |
|---|---|
| `Promise<void>` | Solicita acceso a la cámara, inicializa el detector e inicia `processFrame`. |

##### `stopCameraMode()`

Detiene el MediaStream, limpia tracks, reinicia UI a estado inicial.

#### Funciones de exportación

##### `downloadCameraReport()`

| Retorna | Descripción |
|---|---|
| `Promise<void>` | Obtiene `/api/report/traffic`, lo convierte a CSV y lo descarga como archivo. |

##### `reportToCsv(report)`

| Parámetros | Retorna | Descripción |
|---|---|---|
| `report: object` | `string` | Genera un CSV con totales globales y por cámara. |

#### Manejadores de Socket.IO (dashboard)

| Evento | Acción |
|---|---|
| `connect` | Actualiza `visionRtStatus` a "Conectado" |
| `disconnect` | Actualiza `visionRtStatus` a "Desconectado" |
| `snapshot` | Llama a `window.updateMapFromSnapshot` |
| `objects_update` | Llama a `window.updateMapFromObjectsEnvelope` |

#### Función de inicialización

##### `wireUi()`

Enlaza todos los botones de la interfaz:

| Botón | Acción |
|---|---|
| Simular (online) | `POST /api/ingest` con dato de prueba |
| Offline | `POST /api/simulate/offline` |
| Iniciar cámara | `startCameraMode()` |
| Detener cámara | `stopCameraMode()` |
| Reporte | `downloadCameraReport()` |
| CSV | `GET /api/export/csv` |
| PDF | `GET /api/export/pdf` |
| SimQR | `simulateMultipleCameras()` |
| Tecla `R` | Equivale a SimQR |

---

## 3. Vision-RT – Sistema autónomo de visión

### 3.1 `server.js`

Servidor Node.js independiente en puerto 3000 (o `$PORT`).

#### Variables

| Nombre | Tipo | Descripción |
|---|---|---|
| `app` | `Express` | Aplicación Express |
| `server` | `http.Server` | Servidor HTTP |
| `io` | `Server` (Socket.IO) | Instancia WebSocket |
| `PORT` | `number` | `process.env.PORT \|\| 3000` |

#### Rutas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | `{ ok: true, service: 'vision-rt', time: ISO }` |
| `static` | `/` | Archivos estáticos del directorio |

#### Manejadores Socket.IO

| Evento | Comportamiento |
|---|---|
| `state_update` | Re-emite a todos los clientes con `source` y `timestamp` |
| `objects_update` | Re-emite a todos los clientes con `source` y `timestamp` |

---

### 3.2 `frame-schema.js`

Idéntico al de `frontend/js/frame-schema.js`. Ver [§2.1](#21-jsframe-schemajs).

---

### 3.3 `map-adapter.js`

Casi idéntico al de `frontend/js/map-adapter.js`. Diferencia: el método `mapTrack` incluye
el campo `risk` en el objeto retornado:

```js
{
  id, classType, score,
  risk: track.risk || null,   // ← campo adicional
  center, latLng, bbox, predicted, trail
}
```

Ver [§2.2](#22-jsmap-adapterjs) para el resto de la documentación.

---

### 3.4 `app.js`

Módulo de visión standalone (≈781 líneas) envuelto en una IIFE para evitar contaminación
del espacio global.

#### Constantes internas

| Nombre | Valor | Descripción |
|---|---|---|
| `DETECTION_ENGINE` | `'sensecraft'` | Motor de detección |
| `CAMERA_ID` | `'cam-001'` | ID de cámara |
| `MODEL_TIMEOUT_MS` | `15 000` | Timeout modelo (ms) |
| `CLASS_COLORS` | `object` | Colores en español (peatón, vehículo, …) |
| `ANIMAL_CLASSES` | `Set` | Mismas clases de animales que dashboard.js |
| `CLASS_MAP` | `object` | Mapeo coco-ssd → etiquetas en español |
| `SPECIAL_EVENTS` | `Set` | Clases que generan badge especial |

#### Objeto `ui`

Referencias a elementos DOM:

| Clave | Elemento |
|---|---|
| `banner` | `#banner` |
| `video` | `#video` |
| `overlay` | `#overlay` |
| `btnStart` | `#btnStart` |
| `btnSimQR` | `#btnSimQR` |
| `badges` | `#badges` |
| `objectsList` | `#objectsList` |
| `mRisk` | `#mRisk` |
| `mTtc` | `#mTtc` |
| `mPet` | `#mPet` |
| `mVrel` | `#mVrel` |

#### Variables de estado internas

| Nombre | Tipo | Descripción |
|---|---|---|
| `ctx` | `CanvasRenderingContext2D` | Contexto del canvas de overlay |
| `cropCanvas` | `HTMLCanvasElement` | Canvas temporal para recortes |
| `cropCtx` | `CanvasRenderingContext2D` | Contexto de `cropCanvas` |
| `socket` | Socket.IO client | Conexión al servidor local |
| `mapAdapter` | `MapAdapter` | Adaptador de coordenadas |
| `detector` | `SenseCraftDetector \| null` | Instancia del detector |
| `handModel` | `Handpose \| null` | Modelo de manos |
| `isRunning` | `boolean` | Estado del loop |
| `tracks` | `Array` | Tracks activos |
| `nextTrackId` | `number` | Contador de IDs |
| `frameClock` | `number` | Timestamp del último frame |
| `lastEvents` | `Array` | Eventos del último frame |
| `eventCooldown` | `Map` | Cooldown por tipo de evento |

#### Clase `SenseCraftDetector` (vision-rt)

Misma estructura que la del dashboard. Ver [§2.4 – Clase SenseCraftDetector](#clase-sensecraftdetector).

#### Funciones internas (vision-rt/app.js)

Las funciones siguientes tienen el mismo propósito que sus homólogas en `dashboard.js`
(ver [§2.4](#24-jsdashboardjs)):

| Función | Equivalente en dashboard.js |
|---|---|
| `setBanner(message, isError?)` | (sin equivalente directo) – Actualiza `ui.banner` |
| `withTimeout(promise, ms, msg)` | `withTimeout` |
| `showStartupError(error)` | `showStartupError` |
| `getVideoToCanvasTransform()` | `getVideoToCanvasTransform` |
| `videoBboxToCanvasBbox(bbox, tf)` | `videoBboxToCanvasBbox` |
| `toVideoPixelBbox(bbox, w, h)` | `toVideoPixelBbox` |
| `clampBboxToCanvas(bbox)` | `clampBboxToCanvas` |
| `normalizeClass(raw)` | `normalizeClass` |
| `refineBboxForClass(type, bbox)` | `refineBboxForClass` |
| `updateTracks(detections, nowMs)` | `updateTracks` |
| `classifyRisk(ttc, pet, vRel, conf)` | `classifyRisk` |
| `computeRiskMetrics()` | `computeRiskMetrics` |
| `updateStatePanel(metrics)` | `updateMainRiskUi` |
| `detectAmbulanceHeuristic(bbox, tf)` | `detectAmbulanceHeuristic` |
| `detectHands(tf)` | `detectHands` |
| `renderObjectsList()` | `renderObjectList` |
| `drawTrack(track)` | `drawTrack` |
| `emitSocketPayload(metrics)` | `emitRealtime` (solo Socket.IO, sin HTTP) |
| `processFrame(now)` | `processFrame` |
| `startCamera()` | `startCameraMode` |
| `boot()` | Inicialización automática al cargar la página |

---

## 4. Resumen de endpoints HTTP

| Método | Ruta | Módulo | Descripción |
|---|---|---|---|
| `GET` | `/health` | `server.ts` | Estado del servicio |
| `POST` | `/api/ingest` | `apiRoutes.ts` | Ingesta de frame, cálculo de riesgo |
| `POST` | `/api/simulate/offline` | `apiRoutes.ts` | Simulación por lotes desde archivo JSON |
| `GET` | `/api/events` | `apiRoutes.ts` | Todos los near-miss events |
| `GET` | `/api/stats` | `apiRoutes.ts` | Estadísticas por período (`hour\|day\|week`) |
| `GET` | `/api/report/traffic` | `apiRoutes.ts` | Reporte de conteo de tráfico |
| `GET` | `/api/export/csv` | `apiRoutes.ts` | Exportar eventos a CSV |
| `GET` | `/api/export/pdf` | `apiRoutes.ts` | Exportar reporte diario a PDF |
| `GET` | `/api/health` | `vision-rt/server.js` | Estado del servicio vision-rt |

---

## 5. Resumen de eventos Socket.IO

### Emitidos por el frontend / vision-rt

| Evento | Payload | Descripción |
|---|---|---|
| `state_update` | `{ cameraId, timestamp, risk, ttc, pet, vRel, objectCount }` | Estado de riesgo y métricas del frame actual |
| `objects_update` | `VisionFrame` (schema vision-frame/v1) | Sobre completo con objetos detectados |

### Emitidos por el backend

| Evento | Payload | Descripción |
|---|---|---|
| `message` | `{ text }` | Confirmación de conexión al cliente |
| `snapshot` | `{ type, camera_id, timestamp, gps, counts, risk_event }` | Snapshot procesado de un frame |
| `state_update` | Re-broadcast del payload del cliente | Re-emitido a todos los sockets |
| `objects_update` | Re-broadcast del payload del cliente | Re-emitido a todos los sockets |
