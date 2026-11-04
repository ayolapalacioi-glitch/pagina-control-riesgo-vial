# Especificaciones y Requerimientos de Producto Mínimo Viable (MVP)
## Safe-Crossing — Sistema Inteligente de Control y Prevención de Riesgo Vial

> **Versión:** 1.0.0-MVP  
> **Fecha:** Octubre 2026  
> **Estado:** Aprobado para desarrollo inicial / Prototipado rápido  
> **Ubicación:** `docs/REQUERIMIENTOS-MVP.md`  

---

## 1. Propósito y Definición del MVP

### 1.1 Objetivo del MVP
El propósito de este **Producto Mínimo Viable (MVP)** es validar de forma rápida, económica y funcional la hipótesis central del proyecto **Safe-Crossing**: 
> *"Es viable capturar video de un cruce vial en tiempo real, detectar actores vulnerables (peatones, ciclistas) frente a vehículos mediante IA ligera en backend, estimar un indicador de riesgo básico y activar una señalización activa inteligente (dispositivo ESP32 con balizas luminosas) junto a un panel de control operativo sin requerir infraestructura cloud costosa."*

### 1.2 Criterios de Éxito del MVP
1. **Flujo E2E Funcional:** Una cámara (Webcam de laptop o cámara IP local) transmite video al servidor backend.
2. **Detección Confiable:** Detección de peatones y vehículos a un mínimo de **8 a 10 FPS** en CPU convencional con `yolov8n.pt`.
3. **Decisión de Señalización Activa Automática:** El dispositivo de señalización (físico ESP32 o panel visual web) conmuta a señal de paso (**VERDE**) al detectar un peatón o pulsar el botón, y a advertencia (**ROJO**) cuando transitan vehículos.
4. **Dashboard Intuitivo:** Una interfaz web en `http://localhost:4000` donde el evaluador observa en vivo el video con cajas de detección, el mapa con el cruce y el estado de la señalización activa.
5. **Despliegue Cero Fricción:** Puesta en marcha en entorno local mediante un único script (`start-run.ps1` o `docker-compose up`).

---

## 2. Alcance Funcional del MVP (Core Features)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ALCANCE ESENCIAL (MVP)                          │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 1. VISIÓN ARTIFICIAL│ 2. CONTROL IOT     │ 3. DASHBOARD Y MONITOREO     │
│  - YOLOv8n local   │  - ESP32 vía Wi-Fi │  - Video con Bounding Boxes  │
│  - Clases viales   │  - 3 Estados (G/R/G│  - Mapa interactivo Leaflet  │
│  - Tracking centro │  - Pulsador peatón │  - KPIs y señalización activa│
│  - TTC simplificado│  - Anti-rebote     │  - Exporte básico en CSV     │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

### 2.1 Módulo 1: Ingesta de Video
- **RF-01 (Webcam Local Directa):** Captura directa de video desde el navegador mediante `navigator.mediaDevices.getUserMedia` bajo contexto local (localhost/HTTPS) enviando fotogramas en JPEG base64 al backend.
- **RF-02 (Cámara IP RTSP Local - Modo Alternativo):** Opción de conectar una cámara IP local o VTA+ mediante enlace RTSP directo (`cv2.VideoCapture`) redimensionado a 720p/480p para estabilidad.
- **RF-03 (Fallback con Video de Demostración):** Modo simulación/demostración con un archivo de video vial pregrabado en bucle para pruebas sin cámara física disponible.

### 2.2 Módulo 2: Detección, Tracking y Evaluación de Riesgo
- **RF-04 (Inferencia YOLOv8 Nano):** Procesamiento de imágenes en backend usando `ultralytics` con el modelo ligero `yolov8n.pt` optimizado para CPU.
- **RF-05 (Clasificación de Dominio Vial):** Normalización de clases COCO a dominio de tránsito urbano:
  - `person` $\rightarrow$ `peaton`
  - `car`, `truck` $\rightarrow$ `automovil`
  - `bus` $\rightarrow$ `bus`
  - `motorcycle` $\rightarrow$ `motocicleta`
  - `bicycle` $\rightarrow$ `bicicleta`
- **RF-06 (Tracking por Centroides e IoU):** Seguimiento básico de objetos entre fotogramas consecutivos con asignación de identificadores únicos (`T0001`, `T0002`) y cálculo de vector de movimiento lineal.
- **RF-07 (Cálculo de Conflicto y Riesgo Simplificado):**
  - Estimación de tiempo a colisión (**TTC**) aproximado basado en la tasa de aproximación de centroides entre vehículos y peatones dentro de la zona de cruce.
  - Clasificación discreta de riesgo:
    - 🟢 `BAJO`: Sin conflictos ni proximidad crítica.
    - 🟡 `MEDIO`: Peatón y vehículo presentes en la escena pero con trayectoria no convergente.
    - 🔴 `ALTO`: Peatón en calzada/cruce con vehículo en aproximación (TTC < 2.5 s).

### 2.3 Módulo 3: Controlador Semafórico Inteligente (IoT ESP32)
- **RF-08 (Tres Estados Semafóricos):**
  - 🟢 `GREEN` (Paso Peatonal): Habilitado cuando se detecta peatón o se presiona el botón de cruce.
  - 🔴 `RED` (Paso Vehicular / Peligro Peatonal): Forzado cuando solo hay flujo vehicular o riesgo alto.
  - ⚪ `GRAY` (Reposo): Estado neutro cuando no hay presencia de actores.
- **RF-09 (Integración Físico-Virtual con ESP32):**
  - Comunicación bidireccional vía HTTP/REST o WebSockets entre backend y ESP32.
  - Endpoint de consulta rápida para el microcontrolador: `GET /api/esp32/status`.
  - Reporte de pulsador de cruce: `POST /api/esp32/button`.
- **RF-10 (Lógica de Tiempos y Anti-rebote):**
  - Retención mínima en Verde Peatonal: mínimo **5 segundos** garantizados para el cruce.
  - Filtro anti-rebote (debounce) para pulsadores físicos: 150 ms.
  - Temporizador de solicitud (TTL): 15 a 20 segundos antes de retornar a reposo.

### 2.4 Módulo 4: Dashboard y Visualización de Operaciones
- **RF-11 (Panel Central Unificado):** Single-page application servida en `http://localhost:4000` con Tailwind CSS.
- **RF-12 (Monitor de Video en Vivo):** Renderizado de bounding boxes, ID de seguimiento y etiqueta de clase en overlay sobre el feed de video.
- **RF-13 (Mini-Mapa de Ubicación):** Mapa Leaflet georreferenciado que proyecta el cruce vial y la densidad de actores en tiempo real.
- **RF-14 (Panel de Señalización Activa y Override Manual):**
  - Widget visual que replica el estado de las balizas e indicadores luminosos.
  - Botón de cruce peatonal virtual.
  - Selector de anulación manual: `AUTO`, `FORZAR VERDE`, `FORZAR ROJO`.
- **RF-15 (Exportación Rápida de Datos):** Botón para descargar registro de detecciones y eventos de riesgo en formato **CSV** (`/api/export/csv`).

---

## 3. Matriz MoSCoW: Alcance del MVP vs. Fases Posteriores

Para garantizar que el MVP se desarrolle en un tiempo récord y sin desviaciones, se delimita estrictamente qué entra y qué queda pospuesto:

| Característica / Funcionalidad | Prioridad | Estado en el MVP | Justificación técnica |
|---|:---:|:---:|---|
| **Detección YOLOv8n (Peatón, Auto, Moto, Bici)** | **Must Have** | ✅ Incluido | Pilar central de la detección de actores. |
| **Tracking básico por centroides e IoU** | **Must Have** | ✅ Incluido | Requerido para persistencia de IDs y vector de velocidad. |
| **Estimación de TTC y Nivel de Riesgo (Bajo/Medio/Alto)** | **Must Have** | ✅ Incluido | Núcleo de la conflictometría vial. |
| **Controlador de Señalización Activa ESP32 (Balizas Verde/Roja/Reposo)** | **Must Have** | ✅ Incluido | Validación de la actuación física en hardware. |
| **Dashboard web con video, mapa y telemetría en vivo** | **Must Have** | ✅ Incluido | Interfaz de supervisión obligatoria. |
| **Ingesta por Webcam y archivo de prueba local** | **Must Have** | ✅ Incluido | Garantiza que el sistema funcione en cualquier PC sin cámara externa. |
| **Soporte Cámara IP RTSP directa** | **Should Have** | ⚡ Simplificado | Conexión directa OpenCV; sin balanceador complejo ni re-streaming go2rtc. |
| **Exporte de auditoría en CSV** | **Should Have** | ✅ Incluido | Simple, rápido y sin dependencias pesadas. |
| **Reportes en PDF con ReportLab** | **Could Have** | ⏳ Fase 2 | Requiere plantillas de maquetación; el CSV cubre la necesidad analítica del MVP. |
| **Visor Móvil Ciudadano por QR (`viewer.html`)** | **Could Have** | ⏳ Fase 2 | Complementario; no bloquea la validación del cruce inteligente. |
| **Geocercas GPS móviles dinámicas de 50m** | **Could Have** | ⏳ Fase 2 | Depende de enlace móvil y GPS con precisión variable. |
| **Soporte Tuya Cloud OpenAPI / TinyTuya** | **Won't Have (MVP)**| ❌ Excluido | Requiere claves de desarrollador en la nube y configuración de cuentas de pago. |
| **Túneles Tailscale / Tailscale Funnel** | **Won't Have (MVP)**| ❌ Excluido | Infraestructura de red remota opcional para la etapa inicial. |
| **Homografía métrica 3x3 (velocidad real en km/h)** | **Won't Have (MVP)**| ❌ Excluido | Alta complejidad de calibración milimétrica por cámara. |
| **Re-Identificación Multicámara (ReID)** | **Won't Have (MVP)**| ❌ Excluido | Excede el objetivo de validar un cruce específico. |

---

## 4. Requerimientos No Funcionales del MVP

### 4.1 Rendimiento y Tiempos de Respuesta
- **RNF-01 (Tasa de Cuadros):** Inferencia sostenida de **8 a 15 FPS** en procesadores Intel Core i5/Ryzen 5 (8va gen o superior) sin tarjeta gráfica dedicada (GPU).
- **RNF-02 (Latencia de Control IoT):** El dispositivo de señalización ESP32 debe responder a un evento de detección peatonal o pulsación en menos de **400 ms** sobre la red Wi-Fi local.
- **RNF-03 (Latencia de WebSocket):** Actualización de telemetría hacia el dashboard con retraso inferior a **100 ms**.

### 4.2 Facilidad de Instalación y Portabilidad
- **RNF-04 (Pila Tecnológica Ligera):** Backend escrito 100% en Python 3.10+ (FastAPI + Socket.IO + Ultralytics).
- **RNF-05 (Zero-Build Frontend):** Frontend en HTML5 estándar, Tailwind CSS (vía CDN o pre-compilado estático) y JavaScript Vanilla, sin necesidad de herramientas pesadas de compilación (Webpack/Vite/Node).
- **RNF-06 (Configuración por Variables de Entorno):** Archivo `.env` simple con no más de 8 variables esenciales.

### 4.3 Confiabilidad y Seguridad Local
- **RNF-07 (Degradación Elegante):** Si la cámara IP se desconecta, el sistema debe alertar en el dashboard y permitir conmutar a la cámara web o video de prueba sin congelar el backend.
- **RNF-08 (Aislamiento de Errores en ESP32):** Si el ESP32 pierde conexión Wi-Fi, el sistema web debe continuar operando normalmente y marcar el dispositivo en estado *Offline*.
- **RNF-09 (Seguridad Web Local):** Soporte de Localhost sin restricciones de CORS para pruebas directas en el navegador.

---

## 5. Arquitectura Simplificada del MVP

### 5.1 Diagrama de Bloques Funcional

```
+─────────────────────────────────────────────────────────────+
|                    ENTRADAS DE VIDEO                        |
|  [ Webcam Integrada ]   O   [ Cámara RTSP Local ]           |
+──────────────────────────────┬──────────────────────────────+
                               │ Frames JPEG (Base64 / BGR)
                               ▼
+─────────────────────────────────────────────────────────────+
|            BACKEND PYTHON (FastAPI + Socket.IO)             |
|                                                             |
|   1. Vision Service       -->  YOLOv8n (Inferencia CPU)     |
|   2. Tracker & Risk       -->  IoU + TTC + Nivel de Riesgo  |
|   3. Traffic State        -->  Aforos y Conteos en Memoria  |
|   4. Signal Controller    -->  Lógica de Decisión (G/R/G)   |
|   5. Event Store          -->  Historial temporal / CSV     |
+──────────────┬──────────────────────────────┬───────────────+
               │ Eventos Socket.IO            │ REST / Polling
               ▼                              ▼
+─────────────────────────────+  +────────────────────────────+
|   DASHBOARD WEB (Frontend)  |  |   CONTROLADOR IOT (ESP32)  |
| - Overlay con Bounding Boxes|  | - Luces LED (Verde / Roja) |
| - Mapa Leaflet              |  | - Pulsador Peatonal Físico |
| - Indicador de Riesgo / KPIs|  | - Servidor Web o Polling   |
| - Control Señalización      |  +────────────────────────────+
+─────────────────────────────+
```

### 5.2 Estructura de Archivos Recomendada para el MVP

```text
pagina-control-riesgo-vial/
├── docs/
│   ├── ESPECIFICACIONES-TECNICAS.md      # Documento técnico maestro
│   └── REQUERIMIENTOS-MVP.md             # Este documento (Alcance MVP)
├── backend_py/
│   ├── app/
│   │   ├── main.py                       # FastAPI + Socket.IO server
│   │   ├── vision_service.py             # Inferencia YOLOv8n y Bounding Boxes
│   │   ├── tracker.py                    # Tracking de centroides e IoU
│   │   ├── risk_service.py               # Estimación de TTC y riesgo
│   │   ├── esp32_service.py              # Lógica y estado de la señalización activa
│   │   └── models.py                     # Esquemas Pydantic
│   ├── requirements.txt                  # Dependencias mínimas
│   └── yolov8n.pt                        # Pesos del modelo YOLOv8 Nano
├── frontend/
│   ├── index.html                        # Dashboard de visualización
│   ├── js/
│   │   ├── dashboard.js                  # Lógica de renderizado y WebSockets
│   │   └── map.js                        # Capa del mapa Leaflet
│   └── css/
│       └── tailwind.css                  # Estilos visuales
├── arduino/
│   └── esp32_person_status_web.ino       # Firmware de señalización ESP32
├── .env.example                          # Variables mínimas requeridas
└── README.md                             # Guía de inicio rápido del MVP
```

---

## 6. Contratos de Comunicación del MVP

### 6.1 Endpoints REST Esenciales

| Método | Endpoint | Descripción | Payload / Respuesta |
|---|---|---|---|
| `POST` | `/api/vision/infer` | Envía un fotograma desde el frontend y retorna detecciones | **Req:** `{ "image": "data:image/jpeg;base64,..." }`<br>**Res:** `{ "objects": [...], "risk": "ALTO", "ttc": 1.8 }` |
| `GET` | `/api/esp32/status` | Consulta de estado de señalización por parte del ESP32 | **Res:** `{ "state": "GREEN", "reason": "PEATON", "holdRemainingMs": 4200 }` |
| `POST` | `/api/esp32/button` | Notificación de pulsación de botón de cruce | **Req:** `{ "pressed": true }`<br>**Res:** `{ "status": "REQUEST_REGISTERED" }` |
| `POST` | `/api/esp32/override`| Forzar estado manual desde el dashboard | **Req:** `{ "state": "GREEN" }` (`AUTO`, `GREEN`, `RED`, `GRAY`) |
| `GET` | `/api/export/csv` | Descarga de registro de aforo y eventos en CSV | Retorna archivo `eventos_trafico.csv` |

### 6.2 Eventos de Socket.IO Reducidos para el MVP

#### Emitidos por el Backend:
1. **`state_update`:** Enviado en cada ciclo de inferencia (~100 ms).
```json
{
  "timestamp": "2026-10-16T20:30:00.000Z",
  "risk": "ALTO",
  "ttc": 2.1,
  "counts": {
    "peatones": 2,
    "vehiculos": 3,
    "motos": 1,
    "bicicletas": 0
  },
  "signalState": "GREEN"
}
```

2. **`objects_update`:** Detecciones georreferenciadas con trazas para el canvas y mapa.
```json
{
  "objects": [
    {
      "id": "T0001",
      "classType": "peaton",
      "score": 0.89,
      "bbox": { "x": 320, "y": 240, "w": 45, "h": 110 },
      "riskStatus": "CRITICAL"
    }
  ]
}
```

3. **`esp32_signal_update`:** Notificación instantánea de cambio de estado en la señalización activa.
```json
{
  "state": "GREEN",
  "decisionReason": "PEATON_DETECTADO",
  "updatedAt": "2026-10-16T20:30:01.000Z"
}
```

---

## 7. Variables de Entorno Mínimas (`.env`)

Para simplificar la configuración durante el MVP, el sistema se reduce a los siguientes parámetros:

```env
# Configuración del Servidor
PORT=4000
HOST=0.0.0.0

# Fuente de Video Inicial (webcam | rtsp | mock_video)
VIDEO_SOURCE_MODE=webcam
RTSP_URL=rtsp://admin:clave@192.168.1.18:554/live/ch0

# Parámetros del Modelo YOLO
YOLO_MODEL=yolov8n.pt
CONFIDENCE_THRESHOLD=0.45

# Lógica de Señalización Activa ESP32
GREEN_MIN_HOLD_SECONDS=5
BUTTON_REQUEST_TTL_SECONDS=15
```

---

## 8. Plan de Validación y Criterios de Aceptación (Testing Checklist)

Para declarar el **MVP completado y listo para demo**, se deben cumplir las siguientes pruebas en entorno local:

- [ ] **TC-01 (Detección de Peatón):** Poner una persona frente a la cámara; el sistema debe detectarla como `peaton` con una certeza $> 50\%$ y dibujarle una caja verde/amarilla.
- [ ] **TC-02 (Detección de Vehículo):** Apuntar la cámara a la calle o reproducir video vial; los vehículos deben clasificarse como `automovil` o `motocicleta`.
- [ ] **TC-03 (Activación Automática de Señalización):** Al aparecer un peatón en la zona del cruce, la señalización activa debe pasar a `GREEN` en menos de 1 segundo.
- [ ] **TC-04 (Pulsador Peatonal):** Presionar el botón físico en el ESP32 o el botón virtual en el Dashboard; la señalización debe conmutar a `GREEN` y mantenerse al menos 5 segundos.
- [ ] **TC-05 (Retorno a Reposo):** Tras desaparecer el peatón y expirar el tiempo de retención, la señalización debe pasar a `RED` o `GRAY`.
- [ ] **TC-06 (Visualización en Dashboard):** El video con detecciones, el indicador de riesgo vial y el mapa deben actualizarse en tiempo real de forma fluida.
- [ ] **TC-07 (Descarga de Datos):** Hacer clic en "Exportar CSV" y comprobar que el archivo descargado contenga las marcas de tiempo, clase de objeto y nivel de riesgo registrado.

---

## 9. Roadmap de Transición: Del MVP a Fase Productiva

```
  [ MVP Actual ] ──────────────► [ Fase 2: Robustez ] ────────► [ Fase 3: Escala Urbana ]
  - Detección YOLOv8n             - Reportes PDF avanzados       - Homografía métrica km/h
  - ESP32 local Wi-Fi             - Visor móvil con QR           - Multi-cámara ReID
  - Dashboard reactivo            - Geocercas ciudadanas GPS     - Integración con redes de señalización NTCIP
  - Exportación CSV               - Túnel seguro Tailscale       - Edge computing (Jetson Nano)
```

Este documento constituye la línea base técnica y funcional para la construcción, prueba y entrega de la primera iteración operativa del sistema **Safe-Crossing**.

---

## 10. Presupuesto Estimado y Costos de Adquisición del Prototipo

A continuación se presenta el presupuesto comercial estimado para la adquisición de los componentes de hardware e infraestructura requeridos para el prototipo ciberfísico, discriminando los elementos por adquirir de los recursos propios:

| Ítem | Componente / Material | Cant. | Estado / Fuente | Costo Unit. (COP) | Costo Total (COP) |
|:---:|---|:---:|:---:|---:|---:|
| **1** | Placa Raspberry Pi 5 (4GB / 8GB RAM) | 1 | Por adquirir / Inversión | $420.000 | $420.000 |
| **2** | Fuente Oficial USB-C 27W (5.1V / 5A) RPi 5 | 1 | Por adquirir / Inversión | $75.000 | $75.000 |
| **3** | Cooler Activo Oficial (Disipador + Fan) RPi 5 | 1 | Por adquirir / Inversión | $35.000 | $35.000 |
| **4** | Tarjeta MicroSD 64GB Clase 10 / A2 | 1 | Por adquirir / Inversión | $38.000 | $38.000 |
| **5** | Módulo Cámara Raspberry Pi (Cable Flex CSI) | 1 | Por adquirir / Inversión | $78.000 | $78.000 |
| **6** | Tarjeta Microcontrolador ESP32 (NodeMCU) | 1 | Por adquirir / Inversión | $32.000 | $32.000 |
| **7** | Protoboard estándar (400 / 830 puntos) | 1 | Por adquirir / Inversión | $14.000 | $14.000 |
| **8** | Kit Diodos LED (Verdes, Rojos, Amarillos) | 8 | Por adquirir / Inversión | $500 | $4.000 |
| **9** | Resistencias de carbón 220Ω / 330Ω (1/4W) | 8 | Por adquirir / Inversión | $200 | $1.600 |
| **10** | Pulsador / Botón táctil de 4 pines | 2 | Por adquirir / Inversión | $1.500 | $3.000 |
| **11** | Kit Cables Jumpers (pack x40 M-M y M-H) | 1 | Por adquirir / Inversión | $9.500 | $9.500 |
| **12** | Materiales de Maqueta (Base rígida, foami) | 1 lote | Por adquirir / Inversión | $18.000 | $18.000 |
| **13** | Actores a escala (Figura peatón y carrito) | 1 lote | Por adquirir / Inversión | $12.000 | $12.000 |
| **14** | **Servicio de Hosting Web (Alojamiento y Servidor en Nube)** | **1 suscripción** | **Por adquirir / Inversión** | **$130.000** | **$130.000** |
| **15** | Laptop de Desarrollo (Intel Core i5 / Ryzen) | 1 | Recurso Propio (Disponible) | $0 | $0 |
| **16** | Monitor / Pantalla externa para visualización | 1 | Recurso Propio (Disponible) | $0 | $0 |
| **17** | Cable micro-HDMI a HDMI para RPi 5 | 1 | Recurso Propio (Disponible) | $0 | $0 |
| | **TOTAL PRESUPUESTO ESTIMADO:** | | | | **$870.100 COP** |

