# Especificaciones Técnicas — Página de Control de Riesgo Vial

## 1) Propósito del sistema
Plataforma web edge-to-cloud para detección de actores viales, tracking multiobjeto, estimación de riesgo (TTC/PET/vRel) y visualización operativa en tiempo real para prevención de siniestros.

---

## 2) Alcance funcional

### 2.1 Funcionales
1. Captura de video en navegador (PC cámara) con permisos del usuario.
2. Detección por motor `YOLO` ejecutado en backend Python.
3. Cliente web sin modelos IA locales: captura frame y delega inferencia al servidor.
4. Normalización de clases y mapeo a dominio vial:
   - `person -> peaton`
   - `car/truck -> automovil`
   - `bus -> bus_transcaribe`
   - `motorcycle -> motocicleta`
   - `bicycle -> bicicleta`
   - `stop_sign -> senal_paso`
   - animales múltiples -> `animal`
5. Tracking con IDs estables por matching distancia + IoU.
6. Suavizado de bounding boxes y predicción lineal de trayectoria.
7. Cálculo de métricas:
   - TTC aproximado
   - PET aproximado
   - velocidad relativa (vRel)
   - riesgo discreto: `BAJO|MEDIO|ALTO|CRITICO`
8. Normalización de detecciones YOLO a clases de dominio vial para analítica de riesgo.
9. Emisión de eventos por Socket.IO:
   - `state_update`
   - `objects_update`
   - `snapshot` (backend)
10. Ingesta de visión por `POST /api/vision/infer` y soporte de ingesta externa por `POST /api/ingest`.
11. UI unificada en una sola página (`http://localhost:4000`) con:
   - mapa Leaflet
   - overlay de detección
   - KPIs
   - gráficas en tiempo real
   - tabla de tipos vehiculares actual
   - telemetría técnica y eventos

### 2.2 No funcionales
1. **Tiempo real**: objetivo de loop visual ~10 FPS (throttle por `requestAnimationFrame` y ventana de 90ms).
2. **Disponibilidad local demo**: ejecución por Docker Compose o Python local.
3. **Resiliencia**:
   - validación robusta de payloads en backend
   - mensajes explícitos de fallo de cámara/comunicación con API
4. **Escalabilidad lógica**:
   - soporte multicámara por `camera_id`
   - estructura de envelope reusable para integración con mapa/sistemas externos
5. **Observabilidad básica**:
   - telemetría en frontend
   - stream de eventos en UI
6. **Mantenibilidad**:
   - separación por capas: rutas/controladores/servicios/utilidades
   - contratos de datos explícitos

---

## 3) Arquitectura

### 3.1 Componentes
- **Frontend (`frontend/`)**
  - `index.html`: dashboard unificado
   - `js/dashboard.js`: captura de cámara, envío de frames a backend y render de resultados
  - `js/map.js`: capas geográficas y actualización de mapa
  - `js/frame-schema.js`: contrato `objects_update`
  - `js/map-adapter.js`: transformación pixel->lat/lng
  - `css/tailwind.css`: estilos custom

- **Backend (`backend_py/`)**
   - `app/main.py`: FastAPI + Socket.IO + static frontend/data
   - `app/vision_service.py`: inferencia YOLO en servidor
   - `app/*`: tracker, risk, stats, reportes, event store JSON

- **Infra**
  - `docker-compose.yml`: backend + mosquitto

### 3.2 Flujo de datos
1. Navegador captura frame.
2. Frontend envía frame por `POST /api/vision/infer`.
3. Backend ejecuta YOLO, tracking y cálculo TTC/PET/vRel.
4. Backend emite `state_update`, `objects_update` y `snapshot` por Socket.IO.
5. Dashboard renderiza mapa, KPIs, eventos, gráficas y tabla.
8. Dashboard actualiza mapa, KPIs, eventos, gráficas y tabla.

---

## 4) Librerías y tecnologías usadas

## 4.1 Backend
- **Python 3.11+**
- **FastAPI**
- **Uvicorn**
- **Socket.IO 4.8.x**
- **paho-mqtt**
- **pydantic**
- **ultralytics (YOLO)**
- **opencv-python-headless + numpy**
- **reportlab**

## 4.2 Frontend
- **Leaflet 1.9.x**
- **leaflet.heat**
- **Chart.js**
- **Socket.IO client 4.8.x**

## 4.3 Infraestructura
- **Docker Compose**
- **Mosquitto**

---

## 5) Patrones de diseño aplicados
1. **Adapter Pattern**
   - `MapAdapter`: desacopla coordenadas de canvas respecto a georreferenciación.
2. **Schema/Envelope Pattern**
   - `VisionFrameSchema`: contrato reusable para emisión de `objects_update`.
3. **Backend Vision Pattern**
   - Inferencia centralizada en backend YOLO y cliente ligero de visualización.
4. **Publisher/Subscriber**
   - Socket.IO para eventos en tiempo real (`emit`/`on`).
5. **Layered Architecture**
   - separación por capas en backend: rutas -> controladores -> servicios.

---

## 6) Contratos clave

### 6.1 `state_update`
```json
{
  "cameraId": "cam-pc-live-001",
  "timestamp": "2026-02-27T20:10:00.000Z",
  "risk": "ALTO",
  "ttc": 2.14,
  "pet": 1.48,
  "vRel": 132.7,
  "objectCount": 7
}
```

### 6.2 `objects_update` (envelope)
```json
{
  "schema": "vision-frame/v1",
  "cameraId": "cam-pc-live-001",
  "timestamp": "2026-02-27T20:10:00.000Z",
  "state": {
    "risk": "ALTO",
    "ttc": 2.14,
    "pet": 1.48,
    "vRel": 132.7
  },
  "objects": [
    {
      "id": "T0007",
      "classType": "peaton",
      "score": 0.93,
      "center": { "x": 640, "y": 340 },
      "latLng": { "lat": 10.4239, "lng": -75.5454 },
      "bbox": { "x": 610, "y": 240, "w": 60, "h": 160 },
      "predicted": { "x": 652, "y": 341 },
      "trail": [{ "x": 615, "y": 338 }, { "x": 628, "y": 339 }]
    }
  ],
  "events": [
    { "type": "bus_transcaribe", "label": "bus_transcaribe detectado", "trackId": "T0002" }
  ]
}
```

---

## 7) Parámetros y ajuste operativo

1. `CAMERA_ID` en frontend (`dashboard.js`).
2. `mapBounds` en `MapAdapter` para conversión geo.
3. `YOLO_MODEL_PATH` y `YOLO_CONF` para selección/umbral del modelo.
4. Ventana de serie real-time (`REALTIME_WINDOW = 60`).
5. Frecuencia de ingesta backend (`lastIngestMs`, ~1.1s).

---

## 8) Seguridad y riesgos técnicos
1. Cámara requiere contexto seguro (`localhost`/HTTPS).
2. El rendimiento depende de CPU/GPU del backend para inferencia YOLO.
3. La detección de ambulancia depende de clases disponibles en el modelo entrenado.
4. Coordenadas geo desde bounds lineales: útiles para visualización, no para peritaje.

---

## 9) Pruebas manuales recomendadas
1. Arranque de cámara automático y por botón.
2. Alineación de bbox con `object-fit: cover`.
3. Persistencia de track IDs entre frames.
4. Emisión de `state_update` y `objects_update`.
5. Actualización en tiempo real de:
   - Gráfica de objetos/riesgo
   - Gráfica de tipos vehiculares
   - Tabla vehicular actual
6. Exportes CSV/PDF.

---

## 10) Roadmap técnico sugerido
1. ReID multi-cámara y Kalman avanzado.
2. Homografía por cámara para velocidad métrica real (m/s, km/h).
3. Test automatizados de contrato (`schema` + eventos socket).
4. Gestión de configuración por perfiles (`dev/demo/prod`).
5. Integración con paneles semafóricos/VMS.
