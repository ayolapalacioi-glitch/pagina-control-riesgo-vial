# 🚸 Proyecto Seguridad Vial Inteligente - Visión Cero Colombia

Sistema edge-to-cloud para reducir mortalidad de peatones en pasos de cebra bajo el **Plan Nacional de Seguridad Vial 2022-2031**, el enfoque **Sistema Seguro (ANSV)** y la filosofía **Visión Cero**.

## Mensaje de Impacto

**Tecnología al servicio de la vida. Priorizando al peatón más vulnerable para avanzar hacia cero muertes y lesiones graves en el tránsito en Colombia.**

## Avances Nuevos del Proyecto (Actualizado)

- Unificación del stack en una sola app de backend: dashboard principal en `/`, visor móvil en `/viewer.html` y módulo de visión en `/vision`.
- Soporte de ingesta híbrida en tiempo real por `HTTP` y `MQTT`, con validación estricta del payload usando `pydantic`.
- Motor de riesgo operativo con métricas `TTC`, `PET`, predicción de conflicto a 1-5s y clasificación `BAJO|MEDIO|ALTO|CRITICO`.
- Persistencia local de eventos near-miss en JSON y tope de retención para mantener rendimiento de demo.
- Exportación lista para operación pública: reportes `CSV` y `PDF` desde API.
- Mapa táctico con capas de demografía, siniestralidad histórica, calor de riesgo, tracks vivos y cerca invisible.
- Sincronización multi-dispositivo de cerca invisible (50m) por `Socket.IO` para dashboard + celulares conectados.
- Flujo QR fortalecido: generación de enlace de red, QR gráfico y activación automática del modo visor.
- Pipeline de cámara PC migrado a inferencia backend: el cliente envía frames y el servidor Python ejecuta YOLO en tiempo real.
- Detección de eventos enriquecidos en backend: `ambulancia`, `movimiento_peaton`, `senal_paso` y clases vehiculares/peatonales de operación vial.
- Gestión de dispositivos conectados en tiempo real con identificación, tipo de cliente y ubicación GPS.
- Señal de presencia peatonal/vehicular para integración con semáforo/luz ESP32 (`/esp32/light` y `/api/esp32/person-status`).
- Arranque seguro para demo móvil con túnel HTTPS de Cloudflare y publicación automática de URL pública para QR.
- Certificado TLS autofirmado automático en contenedor backend, regenerado según IP LAN para facilitar pruebas móviles.

## Librerías Backend (línea por línea)

Dependencias de runtime (`backend_py/requirements.txt`):

- `fastapi`: API REST y publicación de frontend estático.
- `python-socketio`: canal bidireccional en tiempo real para snapshots, objetos, estado, cerca y dispositivos.
- `uvicorn`: servidor ASGI para ejecución HTTPS del backend.
- `pydantic`: validación tipada y estricta del payload de ingesta.
- `paho-mqtt`: suscripción a tópicos MQTT para ingesta edge.
- `ultralytics`: motor YOLO para inferencia de visión en backend.
- `opencv-python-headless` y `numpy`: decodificación y preprocesamiento de frames.
- `reportlab`: generación de reporte PDF diario.
- `python-dotenv`: carga de configuración por entorno.

## Librerías Frontend (línea por línea)

Librerías cargadas en dashboard y visor (`frontend/index.html`, `frontend/viewer.html`, `frontend/js/dashboard.js`):

- `socket.io-client` (CDN): sincronización de estado, objetos, riesgos, cerca y presencia de dispositivos.
- `leaflet` (CDN): render de mapa base, marcadores, círculos de riesgo y capas de control.
- `leaflet.heat` (CDN): visualización de heatmap para concentración de eventos near-miss.
- `chart.js` (CDN): gráficas en vivo de tendencia y distribución vehicular.
- `qrcodejs` (CDN): generación de QR para onboarding móvil y activación de visor.
- Motor de visión en frontend: no aplica. La inferencia se ejecuta 100% en backend Python (YOLO).

Librerías del módulo `vision-rt` (`vision-rt/package.json` + `vision-rt/index.html`, legado opcional):

- `express`: servidor standalone opcional para la vista de visión.
- `socket.io`: emisión de `state_update` y `objects_update` al ecosistema en tiempo real.
- `tfjs + coco-ssd + handpose` (CDN): stack de visión del módulo de streaming y tracking.

## Funcionalidades Backend (línea por línea)

- `POST /api/vision/infer`: recibe frame base64, ejecuta YOLO en backend, actualiza tracking/riesgo y devuelve tracks + telemetría.
- `POST /api/ingest`: valida frame YOLO normalizado (externo), actualiza tracking, calcula riesgo, emite snapshot y persiste eventos altos/críticos.
- `POST /api/simulate/offline`: reproduce dataset offline para demo sin hardware.
- `GET /api/events`: devuelve histórico de eventos near-miss guardados.
- `GET /api/stats`: agrega métricas por periodo (`hour|day|week`) con conteo de riesgo y distribución horaria.
- `GET /api/report/traffic`: entrega conteo acumulado por clase y por cámara con tracks activos.
- `GET /api/export/csv`: descarga evidencia tabular para análisis o entrega institucional.
- `GET /api/export/pdf`: genera reporte diario resumido para presentación operativa.
- `GET /api/network-qr`: detecta IPs LAN y publica URL primaria para QR móvil.
- `GET /api/esp32/person-status`: expone estado peatonal/vehicular para integración hardware.
- `GET /esp32/light`: página semáforo web (verde/rojo/gris) con auto-refresh para ESP32/pantalla simple.
- Ingesta MQTT opcional: consume tópico configurado y procesa pipeline completo igual que HTTP.
- Tracking temporal: estimación de velocidad, heading a cebra, cruce en zona y trayectoria predicha 1-5s.
- Evaluación de riesgo: combina factores de contexto vial + TTC/PET + predicción futura de conflicto.
- Gestión de cerca invisible: sincroniza activación/desactivación multi-cliente con radio fijo de 50m.
- Registro de dispositivos conectados: dashboard/visor, metadatos de cliente y ubicación reportada.
- Servido unificado de activos: frontend principal, viewer, data de demo y módulo vision-rt desde un solo backend.

## Funcionalidades Frontend (línea por línea)

- Dashboard de control con KPIs en vivo para peatones, motos, autos y buses.
- Visualización cartográfica multicapa con riesgo acumulado, calor, demografía y siniestralidad histórica.
- Simulación de múltiples cámaras para narrativa de escalabilidad metropolitana.
- Modo demo offline con replay de frames sample sin necesidad de cámara ni edge real.
- Modo cámara PC con captura en navegador y detección centralizada en backend YOLO.
- Ciclo de inferencia servidor: detección, tracking temporal, cálculo TTC/PET y emisión socket de estado/objetos.
- Simplificación del cliente: renderiza overlays y métricas sin cargar modelos de IA en browser.
- Telemetría visual de riesgo (`TTC`, `PET`, `vRel`) y lista de objetos en seguimiento.
- Alertas multimodales (visual + beep + voz) ante riesgo crítico.
- Exportación directa de CSV/PDF desde botones del panel.
- Generación de QR de red con copia rápida de enlace y fallback gráfico.
- Sincronización de cerca invisible por QR y actualización continua de ubicación del dispositivo emisor.
- Viewer ciudadano móvil con GPS en tiempo real, geocerca local y alertas de riesgo cercano.
- Fallback de ubicación por IP/red cuando no se obtiene geolocalización precisa.
- Reintento automático de GPS por visibilidad/gesto para mejorar onboarding móvil.

## Arquitectura General

- **Edge AI**: modelo YOLO custom (v8/v11) para detección de actores viales por frame.
- **Backend Python 3.11 + FastAPI + Socket.IO**:
  - Ingesta por `MQTT` o `HTTP POST`.
  - Tracking por `track_id` (fallback básico por clase/índice).
  - Cálculo de riesgo con `TTC`, `PET` y predicción de conflicto a 1-5s.
  - Persistencia de near-miss en JSON local para demo competitiva.
  - Emisión en tiempo real a dashboard con `Socket.IO`.

### Clases YOLO soportadas (ingesta)

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

Esto permite integrar un pipeline YOLO especializado para: buses, bicicletas, gestos, estacionamiento, señalización de paso y ambulancias.
- **Frontend Smart-City**:
  - KPIs en vivo, alerta visual/sonora/voz.
  - Mapa Leaflet + OSM con capas de cámaras, heatmap, choropleth demográfico y riesgo acumulado.
  - Gráficas de tendencias y tipos vehiculares.

## Estructura

```text
proyecto-seguridad-vial/
├── backend_py/
│   ├── app/
│   │   ├── main.py
│   │   ├── vision_service.py
│   │   ├── tracker.py
│   │   ├── risk.py
│   │   └── ...
│   ├── requirements.txt
│   ├── Dockerfile
│   └── entrypoint.sh
├── frontend/
│   ├── index.html
│   ├── css/tailwind.css
│   ├── js/dashboard.js
│   ├── js/map.js
│   └── assets/
├── data/
│   ├── mock-near-miss-events.json
│   └── geojson-cartagena-manzanas-demografico-sample.json
├── docker-compose.yml
└── README.md
```

## Instalación (modo competencia en < 48h)

### 1) Requisitos

- Python 3.11+
- pip 24+
- (Opcional) broker MQTT local o Docker

### 2) Backend

```bash
cd backend_py
pip install -r requirements.txt
uvicorn backend_py.app.main:get_asgi_app --factory --host 0.0.0.0 --port 4000
```

> En Windows PowerShell, puedes ejecutar así:

```powershell
cd backend_py
python -m pip install -r requirements.txt
python -m uvicorn backend_py.app.main:get_asgi_app --factory --host 0.0.0.0 --port 4000
```

Servidor en red local (Docker): `https://192.168.2.245:4000`

### 3) Abrir Dashboard

Con backend encendido, abre:

- `https://192.168.2.245:4000`

> El frontend es servido directamente por FastAPI. Todo (mapa + cámara + inferencia YOLO backend + tracking + riesgo + telemetría) está integrado en esta única página.

## Arranque con Docker (recomendado para demo)

Desde la raíz del proyecto:

```bash
docker compose up --build -d
```

Con eso se levantan:

- Backend: `https://192.168.2.245:4000`
- MQTT broker (Mosquitto): `192.168.2.245:1883`

Para detener:

```bash
docker compose down
```

Ver estado:

```bash
docker compose ps
```

Ver logs del backend:

```bash
docker compose logs -f backend
```

### Obtener TU-IP-LOCAL automáticamente (Windows)

En PowerShell, usa:

```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -notlike '127.*' -and
  $_.IPAddress -notlike '169.254.*' -and
  $_.PrefixOrigin -ne 'WellKnown'
} | Select-Object -First 1 -ExpandProperty IPAddress)
```

Opcional (copiar al portapapeles):

```powershell
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -notlike '127.*' -and
  $_.IPAddress -notlike '169.254.*' -and
  $_.PrefixOrigin -ne 'WellKnown'
} | Select-Object -First 1 -ExpandProperty IPAddress)
$ip | Set-Clipboard
$ip
```

### Si Docker no carga (solución rápida)

En PowerShell, desde la raíz del proyecto:

```powershell
docker compose down --remove-orphans
docker compose rm -f
docker compose up --build
```

Esto limpia contenedores huérfanos y recrea la imagen del backend Python.

## Flujo de demo (sin hardware)

1. Inicia backend.
2. En el dashboard, clic en **Modo Demo Offline**.
3. El sistema procesa el archivo de muestra de detecciones ubicado en `data/`.
4. Observa:
   - KPIs en vivo
   - nivel de riesgo
   - alertas sonoras y de voz
   - puntos de riesgo en mapa
5. Exporta evidencia para jurado:
   - **CSV** (`/api/export/csv`)
   - **PDF diario** (`/api/export/pdf`)

## Modo Cámara del PC (detección en vivo)

1. Abre `https://192.168.2.245:4000`.
2. Clic en **Abrir cámara PC (IA)** y acepta permisos del navegador.
3. El sistema detecta en tiempo real en backend YOLO: `peaton`, `motocicleta`, `automovil`, `bus_transcaribe`, `bicicleta` y clases complementarias.
4. Cada ciclo envía frames al backend por `POST /api/vision/infer` y actualiza KPIs, riesgo y mapa.
5. Clic en **Reporte detecciones cámara** para descargar conteos acumulados por clase/cámara.

Notas:

- En modo producción, la detección oficial es YOLO (edge) y la ingesta backend usa ese esquema normalizado.
- Para `gesto`, `ambulancia`, `peaton_aereo` y `movimiento_peaton`, se recomienda mantener entrenamiento YOLO específico por clase para máxima precisión operacional.
- La app intenta usar la geolocalización actual del equipo para ubicar la cámara en el mapa.
- Si no hay permiso de ubicación, usa coordenadas de Cartagena por defecto.

### Robustez de detección (anti-flicker para demo)

La vista principal ahora incluye endurecimiento para que la detección no “flaquee” en vivo:

- Filtrado por confianza mínima y tamaño de caja para reducir ruido.
- Deduplicación por solapamiento (NMS) para evitar doble conteo del mismo objeto.
- Tracking temporal con tolerancia a frames perdidos (persistencia corta de tracks).
- Suavizado de score y trayectorias para reducir parpadeo visual.
- Recuperación automática del motor de IA si hay errores consecutivos del detector.

## QR multi-dispositivo para cerca invisible

La cerca invisible ahora se sincroniza por `Socket.io` para todos los clientes conectados (no solo un dispositivo), con radio fijo de **50 metros**.

Opciones de activación:

1. Botón **Simular QR (R)** en cualquier cliente conectado.
2. Escaneo de QR con URL:

```text
http://<IP-O-DOMINIO>:4000/viewer.html?qr=1
```

Cuando un dispositivo abre esa URL:

- activa la cerca invisible de 50m,
- el backend la comparte con todos los clientes,
- y la posición se actualiza en tiempo real con la geolocalización del dispositivo que la activó.

Importante para ubicación correcta en celular:

- El navegador del celular debe aceptar permiso de ubicación para `viewer.html`.
- Si el permiso es denegado, el sistema pide reintentar con **Usar mi ubicación**.
- En muchos móviles, la geolocalización precisa requiere `HTTPS` (o `localhost`).
- Si no hay GPS disponible, puedes fijar manualmente tocando el mapa.

### URL final configurada para red local

Se configuró la IP fija de la red local para acceso desde celular:

```text
https://192.168.2.245:4000/viewer.html?qr=1
```

La vista `viewer.html` muestra solo:

- mapa,
- cerca invisible (50m),
- riesgos cercanos a la ubicación del usuario.

### Opción recomendada para permiso GPS en celular (HTTPS)

Si el navegador móvil no pide ubicación usando IP local, abre un túnel HTTPS **sin password** con Cloudflare:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-secure-demo.ps1 -OpenBrowser
```

El script descarga `cloudflared` automáticamente si no está instalado, levanta Docker y genera una URL `https://xxx.trycloudflare.com` lista para usar en el celular **sin ninguna verificación ni contraseña**.

Flujo definitivo recomendado:

1. Ejecuta el script anterior.
2. Abre el **dashboard** desde la URL `https://xxx.trycloudflare.com` que aparece en la terminal.
3. Genera el QR desde ese dashboard HTTPS.
4. Escanea ese QR: se abrirá `viewer.html?qr=1` en HTTPS y el navegador móvil permitirá geolocalización directamente.

### Arranque seguro en 1 comando (recomendado)

Desde la raíz del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-secure-demo.ps1 -OpenBrowser
```

Comando directo (copiar y pegar desde cualquier ruta):

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\ayola\OneDrive\Desktop\Proyectoxspoiler\proyecto-seguridad-vial\scripts\start-secure-demo.ps1" -OpenBrowser
```

El script (Cloudflare, sin password):

- levanta Docker (`backend` + `mosquitto`),
- crea túnel HTTPS con Cloudflare Tunnel,
- imprime URL HTTPS de dashboard y viewer,
- y copia la URL del dashboard al portapapeles.

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
  - `MQTT_TOPIC=yolo/crosswalk/cam-001`

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
- `POST /api/vision/infer`
- `POST /api/ingest`
- `POST /api/simulate/offline`
- `GET /api/events`
- `GET /api/stats?period=hour|day|week`
- `GET /api/report/traffic`
- `GET /api/export/csv`
- `GET /api/export/pdf`

## Script generador de datos falsos

```bash
python backend_py/tools/generate_mock_data.py
```

Genera frames sintéticos en el archivo de muestra de detecciones dentro de `data/`.

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
