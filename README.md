# 🚸 AI-SafeCrossing (S.I.P.V.A.) — Plataforma de Seguridad Vial Inteligente

**Sistema Inteligente de Protección Vial Activa (*Edge-to-Cloud*)** diseñado para mitigar la siniestralidad vial y proteger a los actores viales vulnerables en pasos peatonales críticos, alineado con el **Plan Nacional de Seguridad Vial 2022–2031**, el enfoque de **Sistema Seguro (ANSV)** y la estrategia global **Visión Cero**.

---

## 1. Descripción General

**AI-SafeCrossing (S.I.P.V.A.)** articula visión por computadora de alta velocidad, modelado cinemático predictivo e infraestructura IoT semafórica para anticipar y prevenir conflictos peatonales-vehiculares en tiempo real. El procesamiento local en el borde garantiza tiempos de inferencia neuronal de **~5 ms**, transmisión fluida a **30.0 FPS** y una latencia integral de actuación inferior a **100 ms**.

### Capacidades Centrales de la Plataforma

- **Captura y Streaming RTSP de Ultrabaja Latencia (30 FPS)**: Integración nativa con cámara IP/WiFi **VTA-84920 ORBIT (Tuya Smart Life)** mediante protocolo RTSP/ONVIF (puerto 554), contenedor proxy **go2rtc** (`rtsp://go2rtc:8554/vta_camera`), endpoint MJPEG directo (`/api/camera/stream.mjpg`) y soporte adicional para cámara local WebRTC, DroidCam IP y simulación offline.
- **Inferencia Neuronal YOLOv8 y Calibración Dinámica (`BILLBOARD_MODE`)**: Arquitectura multihilo desacoplada (`ThreadedFrameGrabber` + `AsyncVisionWorker`) con modelo **Ultralytics YOLOv8 (`yolov8n.pt`)**, trazado de *hitboxes* en `0.05 ms` y detección automática del polígono cuadrilátero de cruce peatonal mediante visión clásica adaptativa.
- **Seguimiento Motorizado PTZ (`Motion Tracking`)**: Control automático del servomecanismo de la cámara a través de **Tuya Cloud API (`tinytuya`)** para el seguimiento activo de peatones y vehículos en la zona de conflicto.
- **Motor Cinemático Predictivo (`TTC`, `PET`, `vRel`)**: Seguimiento multiobjeto por **Distancia Euclidiana + IoU**, estimación de velocidad vectorial, predicción lineal de trayectoria de **1 a 5 segundos** y clasificación multicriterio de severidad en cuatro niveles: **`BAJO`**, **`MEDIO`**, **`ALTO`** y **`CRITICO`**.
- **Controlador Semafórico Físico ESP32 y Gemelo Digital Web**: Máquina de Estados Finitos (FSM) con modo **FAIL-SAFE** para gobernar tres grupos semafóricos (**S1 Vehicular Ida**, **S2 Peatonal**, **S3 Vehicular Venida**) y pulsador peatonal físico con filtrado anti-rebote (`debounce`), supervisión por *heartbeat*, servidor web embebido y gemelo digital interactivo en el dashboard.
- **Centro de Mando Unificado y Cartografía Multicapa**: Interfaz operativa dividida en 7 módulos con mapas interactivos **Leaflet**, capas de vulnerabilidad demográfica por manzanas, siniestralidad histórica DATT Cartagena, mapas de calor (*heatmaps*) de eventos *near-miss* y gráficas **Chart.js** en tiempo real.
- **Visor Ciudadano Móvil QR y Geocerca Sincronizada (50 m)**: Vinculación inmediata de teléfonos móviles mediante código QR y túneles HTTPS (**Cloudflare Tunnel / TLS local**), activando una cerca virtual georreferenciada de 50 metros sincronizada por `Socket.IO`.
- **Auditoría y Reportería Institucional**: Persistencia automática de eventos de riesgo y exportación directa de evidencia técnica en formatos **PDF diario (`ReportLab`)** y **CSV**.

---

## 2. Arquitectura Tecnológica

| Capa del Sistema | Tecnologías Implementadas | Función Principal |
|---|---|---|
| **Captura y Proxy Multimedia** | Cámara VTA-84920 (RTSP :554) + `go2rtc` (:8554/:1984) + Tuya Cloud API + WebRTC/DroidCam | Streaming H.264 sobre TCP sin buffer a 30 FPS, asignación de stream en la nube y control motorizado PTZ. |
| **Visión Computacional** | Ultralytics YOLOv8 (`yolov8n.pt`) + OpenCV Headless + NumPy + `BILLBOARD_MODE` | Detección multiclase en ~5 ms, dibujo de *hitboxes* en 0.05 ms y calibración automática de cebra. |
| **Backend y Motor de Riesgo** | Python 3.11 + FastAPI + Uvicorn ASGI + Socket.IO 4.8 + Pydantic + Paho-MQTT | API REST, tracking espaciotemporal, cálculo de TTC/PET/vRel y difusión asíncrona en tiempo real. |
| **Control IoT Semafórico** | Microcontrolador ESP32 + Servidor Web Embebido + Grupos S1/S2/S3 + Pulsador Físico | Secuencias semafóricas temporizadas, monitoreo *heartbeat*, filtros anti-parpadeo y gemelo digital. |
| **Frontend y Visor Móvil** | Dashboard (7 Módulos) + Leaflet + `leaflet.heat` + Chart.js + QRCode.js | Visualización táctica, analítica modal, telemetría HUD y geocerca móvil ciudadana de 50 m. |
| **Infraestructura y Reportes** | Docker + Docker Compose + Eclipse Mosquitto + Cloudflare Tunnels + ReportLab PDF / CSV | Despliegue reproducible en contenedores, seguridad HTTPS/TLS y generación de informes operativos. |

### Taxonomía de Clases Soportadas en el Dominio Vial

El motor de visión clasifica y normaliza los siguientes actores y elementos de contexto:
- **Actores viales vulnerables**: `peaton`, `peaton_aereo`, `movimiento_peaton`, `bicicleta`, `ciclista`, `gesto`.
- **Flota vehicular y emergencias**: `motocicleta`, `automovil`, `bus_transcaribe`, `ambulancia`.
- **Contexto e infraestructura**: `senal_paso`, `aparcamiento`.

---

## 3. Estructura del Proyecto

```text
proyecto-seguridad-vial/
├── arduino/
│   ├── esp32_person_status_web.ino          # Firmware ESP32 sincronizado con Backend HTTPS/HTTP
│   ├── semaforo_web_unificado/              # Firmware ESP32 con servidor web autónomo S1/S2/S3
│   └── test_luces/                          # Rutinas de verificación de hardware óptico
├── backend_py/
│   ├── app/
│   │   ├── main.py                          # Servidor FastAPI + Socket.IO + Rutas API y WebSockets
│   │   ├── rtsp_camera.py                   # Gestor RTSP multihilo (30 FPS) + Tuya Cloud + go2rtc
│   │   ├── vision_service.py                # Motor YOLOv8, dibujo de hitboxes y Billboard Mode
│   │   ├── tracker.py                       # Seguimiento multiobjeto y predicción lineal (1–5 s)
│   │   ├── prediction.py                    # Cálculo matemático de TTC, PET y conflictos futuros
│   │   ├── risk.py                          # Ponderación multicriterio y clasificación de severidad
│   │   ├── presence_signal.py               # Ventana temporal de presencia peatonal/vehicular
│   │   ├── report_service.py                # Exportación de reportes operativos en PDF y CSV
│   │   └── ...                              # Modelos Pydantic, geometría, estadísticas y MQTT
│   ├── Dockerfile                           # Imagen de contenedor Python 3.11 + OpenCV + YOLO
│   ├── entrypoint.sh                        # Inicialización ASGI con soporte TLS
│   └── requirements.txt                     # Dependencias del backend
├── certs/                                   # Certificados TLS autofirmados (server.crt, server.key)
├── data/                                    # Capas GeoJSON, historial near-miss y reportes generados
├── docs/
│   └── ESPECIFICACIONES-TECNICAS.md         # Especificación técnica detallada del sistema
├── frontend/
│   ├── index.html                           # Centro de Mando Principal (7 módulos operativos)
│   ├── viewer.html                          # Visor Ciudadano Móvil con geocerca de 50 m
│   ├── css/tailwind.css                     # Sistema de diseño visual de alto contraste
│   └── js/                                  # Módulos JS (dashboard, mapa, adaptador geo, visor)
├── scripts/
│   ├── start-secure-demo.ps1                # Despliegue automatizado con túnel HTTPS Cloudflare
│   └── test_vta_rtsp.py                     # Diagnóstico directo CLI para cámara RTSP + YOLOv8
├── AISafeCrossing_SIPVA_Documentacion_v2.pdf  # Documento Técnico Unificado (Edición Ejecutiva PDF)
├── AISafeCrossing_SIPVA_Documentacion_v2.docx # Documento Técnico Unificado (Edición Editable Word)
├── README_CONFIGURACION_CAMARA.md           # Guía específica de conexión RTSP VTA-84920 y go2rtc
├── docker-compose.yml                       # Orquestación de servicios (backend, mosquitto, go2rtc)
├── go2rtc.yaml                              # Configuración del proxy multimedia RTSP/FFmpeg
├── start-run.ps1                            # Script de encendido rápido, autodetección IP y QR
├── off-server.ps1                           # Script de apagado limpio de contenedores
└── yolov8n.pt                               # Pesos del modelo neuronal YOLOv8 Nano
```

---

## 4. Despliegue y Puesta en Marcha

### 4.1 Inicio Rápido con Docker (Recomendado)

Desde PowerShell en la raíz del proyecto, ejecuta el script automatizado que detecta la dirección IP LAN, actualiza la configuración, levanta los contenedores (`backend`, `go2rtc`, `mosquitto`) y genera el código QR local:

```powershell
.\start-run.ps1
```

- **Para reconstruir imágenes tras cambios en dependencias**:
  ```powershell
  .\start-run.ps1 -Rebuild
  ```
- **Para detener todos los servicios de forma segura**:
  ```powershell
  .\off-server.ps1
  ```

### 4.2 Inicio con Túnel Público HTTPS (Cloudflare Tunnel para Geolocalización Móvil)

Para habilitar permisos de GPS en navegadores móviles desde cualquier red sin advertencias de certificado local:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-secure-demo.ps1 -OpenBrowser
```

### 4.3 Ejecución Manual en Entorno Python Local

```powershell
cd backend_py
python -m pip install -r requirements.txt
python -m uvicorn backend_py.app.main:get_asgi_app --factory --host 0.0.0.0 --port 4000
```

---

## 5. Integración del Ecosistema IoT (Semáforo ESP32)

### 5.1 Parámetros de Sincronización
- La placa **ESP32** se conecta por Wi-Fi (2.4 GHz) y sincroniza su estado mediante los endpoints `/api/esp32/person-status`, `/api/esp32/button` y `/api/esp32/heartbeat`, o bien expone su servidor web embebido (`/api/state`, `/api/normal`, `/api/pedestrian`, `/api/set`).
- Desde el módulo **Semáforo ESP32 IoT** del dashboard es posible visualizar el **Gemelo Digital (S1, S2, S3, Pulsador y Secuencia)**, accionar cruces peatonales, realizar pruebas manuales por color y ajustar en caliente:
  - `request_ttl_ms` (TTL de solicitud activa, por defecto `20000 ms`)
  - `button_debounce_ms` (filtro anti-rebote en servidor, por defecto `140 ms`)
  - `min_hold_green_ms`, `min_hold_red_ms`, `min_hold_gray_ms` (retención mínima anti-parpadeo)
  - `heartbeat_timeout_ms` (umbral de supervisión online/offline, por defecto `12000 ms`)
  - `manual_override_state` (`AUTO`, `GREEN`, `RED`, `GRAY`)

---

## 6. Catálogo de Endpoints Principales

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado de salud del servidor backend. |
| `POST` | `/api/vision/infer` | Inferencia YOLOv8 + `BILLBOARD_MODE` sobre fotograma Base64. |
| `POST` | `/api/ingest` | Ingesta externa de detecciones normalizadas (HTTP / MQTT). |
| `POST` | `/api/simulate/offline` | Reproducción del dataset offline de validación. |
| `GET` | `/api/camera/stream.mjpg` | Stream nativo MJPEG a 30 FPS con *hitboxes* superpuestos. |
| `GET` | `/api/camera/rtsp/status` | Diagnóstico en vivo del flujo RTSP VTA-84920 (`FPS`, estado, URL). |
| `POST` | `/api/camera/rtsp/config` | Reconfiguración en caliente de dirección IP y credenciales RTSP/Tuya. |
| `POST` | `/api/camera/motion-tracking` | Activación/desactivación de seguimiento motorizado PTZ vía Tuya Cloud. |
| `GET` | `/api/esp32/runtime` | Estado consolidado del controlador ESP32 (`signal`, `connection`, `config`). |
| `POST` | `/api/esp32/button` | Registro de pulsación del botón peatonal físico o virtual. |
| `POST` | `/api/esp32/config` | Actualización de parámetros temporales y modo del semáforo ESP32. |
| `GET` | `/api/events` | Histórico de conflictos viales (*near-misses*) registrados. |
| `GET` | `/api/stats?period=hour\|day\|week` | Analítica agregada de riesgo y distribución horaria. |
| `GET` | `/api/report/traffic` | Aforo acumulado por clase de actor vial y cámara. |
| `GET` | `/api/export/csv` | Descarga de evidencia histórica en formato tabular CSV. |
| `GET` | `/api/export/pdf` | Generación de informe ejecutivo diario en formato PDF. |
| `GET` | `/api/network-qr` | Obtención de URL HTTPS/LAN activa para código QR del visor ciudadano. |

---

## 7. Documentación Complementaria del Repositorio

- **Documento Técnico Unificado (PDF Ejecutivo)**: [`AISafeCrossing_SIPVA_Documentacion_v2.pdf`](file:///C:/Users/ayola/OneDrive/Desktop/SAFE-CROSSIN/proyecto-seguridad-vial/AISafeCrossing_SIPVA_Documentacion_v2.pdf)
- **Documento Técnico Unificado (Editable Word)**: [`AISafeCrossing_SIPVA_Documentacion_v2.docx`](file:///C:/Users/ayola/OneDrive/Desktop/SAFE-CROSSIN/proyecto-seguridad-vial/AISafeCrossing_SIPVA_Documentacion_v2.docx)
- **Especificaciones Técnicas Detalladas**: [`docs/ESPECIFICACIONES-TECNICAS.md`](file:///C:/Users/ayola/OneDrive/Desktop/SAFE-CROSSIN/proyecto-seguridad-vial/docs/ESPECIFICACIONES-TECNICAS.md)
- **Guía de Configuración de Cámara RTSP VTA-84920**: [`README_CONFIGURACION_CAMARA.md`](file:///C:/Users/ayola/OneDrive/Desktop/SAFE-CROSSIN/proyecto-seguridad-vial/README_CONFIGURACION_CAMARA.md)
