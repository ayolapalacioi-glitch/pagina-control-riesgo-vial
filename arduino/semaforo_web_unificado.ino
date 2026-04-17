#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>

// --- CONFIGURACION WIFI ---
const char* SSID = "@PHICOMM_7C";
const char* PASS = "12345678";
const char* HOSTNAME = "esp32-vial";

// --- PINES DEL SEMAFORO ---
const int R1 = 25;
const int Y1 = 19;
const int G1 = 26;
const int R2 = 4;
const int Y2 = 2;
const int G2 = 15;

// --- BOTON PEATONAL FISICO ---
const int BUTTON_PIN = 14;
const bool BUTTON_ACTIVE_LOW = true;
const unsigned long BUTTON_DEBOUNCE_MS = 45;

// --- TIEMPOS DE LA SECUENCIA PEATONAL ---
const unsigned long T_S1_YELLOW_MS = 2000;
const unsigned long T_S1_RED_WAIT_MS = 1000;
const unsigned long T_S2_GREEN_MS = 15000;
const unsigned long T_S2_YELLOW_MS = 2000;

WebServer server(80);

enum class LightColor : uint8_t {
  OFF,
  RED,
  YELLOW,
  GREEN
};

enum class PedestrianPhase : uint8_t {
  IDLE,
  S1_YELLOW,
  S1_RED_WAIT,
  S2_GREEN,
  S2_YELLOW
};

LightColor currentS1 = LightColor::OFF;
LightColor currentS2 = LightColor::OFF;

PedestrianPhase pedestrianPhase = PedestrianPhase::IDLE;
unsigned long phaseStartMs = 0;
String sequenceSource = "none";

bool rawButtonState = false;
bool stableButtonState = false;
unsigned long lastDebounceMs = 0;

const char* boolToJson(bool value) {
  return value ? "true" : "false";
}

const char* colorToText(LightColor color) {
  switch (color) {
    case LightColor::RED:
      return "RED";
    case LightColor::YELLOW:
      return "YELLOW";
    case LightColor::GREEN:
      return "GREEN";
    default:
      return "OFF";
  }
}

bool readButtonPressed() {
  int value = digitalRead(BUTTON_PIN);
  return BUTTON_ACTIVE_LOW ? (value == LOW) : (value == HIGH);
}

void writeTrafficLightPins(int redPin, int yellowPin, int greenPin, LightColor color) {
  digitalWrite(redPin, color == LightColor::RED ? HIGH : LOW);
  digitalWrite(yellowPin, color == LightColor::YELLOW ? HIGH : LOW);
  digitalWrite(greenPin, color == LightColor::GREEN ? HIGH : LOW);
}

void setS1(LightColor color) {
  currentS1 = color;
  writeTrafficLightPins(R1, Y1, G1, color);
}

void setS2(LightColor color) {
  currentS2 = color;
  writeTrafficLightPins(R2, Y2, G2, color);
}

void setNormalMode() {
  setS1(LightColor::GREEN);
  setS2(LightColor::RED);
}

bool isSequenceRunning() {
  return pedestrianPhase != PedestrianPhase::IDLE;
}

bool startPedestrianSequence(const char* source) {
  if (isSequenceRunning()) {
    return false;
  }

  sequenceSource = source;
  pedestrianPhase = PedestrianPhase::S1_YELLOW;
  phaseStartMs = millis();

  setS1(LightColor::YELLOW);
  setS2(LightColor::RED);

  Serial.print("Iniciando secuencia peatonal desde: ");
  Serial.println(sequenceSource);
  return true;
}

void updatePedestrianSequence() {
  if (!isSequenceRunning()) {
    return;
  }

  unsigned long elapsed = millis() - phaseStartMs;

  switch (pedestrianPhase) {
    case PedestrianPhase::S1_YELLOW:
      if (elapsed >= T_S1_YELLOW_MS) {
        setS1(LightColor::RED);
        pedestrianPhase = PedestrianPhase::S1_RED_WAIT;
        phaseStartMs = millis();
      }
      break;

    case PedestrianPhase::S1_RED_WAIT:
      if (elapsed >= T_S1_RED_WAIT_MS) {
        setS2(LightColor::GREEN);
        pedestrianPhase = PedestrianPhase::S2_GREEN;
        phaseStartMs = millis();
        Serial.println("Peatones cruzando...");
      }
      break;

    case PedestrianPhase::S2_GREEN:
      if (elapsed >= T_S2_GREEN_MS) {
        setS2(LightColor::YELLOW);
        pedestrianPhase = PedestrianPhase::S2_YELLOW;
        phaseStartMs = millis();
      }
      break;

    case PedestrianPhase::S2_YELLOW:
      if (elapsed >= T_S2_YELLOW_MS) {
        setNormalMode();
        pedestrianPhase = PedestrianPhase::IDLE;
        Serial.println("Secuencia peatonal finalizada. Regreso a modo normal.");
      }
      break;

    case PedestrianPhase::IDLE:
      break;
  }
}

LightColor parseColor(String colorText) {
  colorText.trim();
  colorText.toUpperCase();

  if (colorText == "RED") {
    return LightColor::RED;
  }
  if (colorText == "YELLOW") {
    return LightColor::YELLOW;
  }
  if (colorText == "GREEN") {
    return LightColor::GREEN;
  }

  return LightColor::OFF;
}

void sendStateJson(int statusCode = 200) {
  String json = String("{") +
                "\"s1\":\"" + colorToText(currentS1) + "\"," +
                "\"s2\":\"" + colorToText(currentS2) + "\"," +
                "\"buttonPressed\":" + boolToJson(stableButtonState) + "," +
                "\"sequenceRunning\":" + boolToJson(isSequenceRunning()) + "," +
                "\"sequenceSource\":\"" + sequenceSource + "\"" +
                "}";

  server.send(statusCode, "application/json", json);
}

void handleRoot() {
  const char* html = R"HTML(
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Control Semaforo ESP32</title>
  <style>
    :root {
      --bg1: #0d1b2a;
      --bg2: #1b263b;
      --card: #f4f1de;
      --text: #1d3557;
      --accent: #e63946;
      --ok: #2a9d8f;
      --warn: #f4a261;
      --line: #a8dadc;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      background: radial-gradient(circle at 15% 20%, #415a77 0%, var(--bg1) 40%),
                  linear-gradient(130deg, var(--bg1), var(--bg2));
      color: #fff;
      display: grid;
      place-items: center;
      padding: 16px;
    }

    .panel {
      width: min(920px, 100%);
      background: var(--card);
      color: var(--text);
      border-radius: 20px;
      padding: 18px;
      box-shadow: 0 24px 50px rgba(0, 0, 0, 0.35);
      border: 2px solid rgba(29, 53, 87, 0.12);
    }

    h1 {
      margin: 0 0 10px 0;
      font-size: clamp(1.2rem, 4vw, 2rem);
      letter-spacing: 0.04em;
    }

    .status {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }

    .status-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px;
      background: #fff;
    }

    .label {
      font-size: 0.82rem;
      text-transform: uppercase;
      opacity: 0.72;
      margin-bottom: 6px;
    }

    .value {
      font-size: 1.1rem;
      font-weight: 700;
    }

    .actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 8px;
    }

    .block {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      background: #fff;
    }

    .block h2 {
      margin: 0 0 10px;
      font-size: 1rem;
    }

    .btn-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      color: #fff;
      transition: transform 0.15s ease, filter 0.15s ease;
    }

    button:hover {
      transform: translateY(-1px);
      filter: brightness(1.05);
    }

    button:active {
      transform: translateY(0);
    }

    .primary { background: var(--accent); }
    .ok { background: var(--ok); }
    .warn { background: var(--warn); color: #222; }
    .neutral { background: #457b9d; }

    .footer {
      margin-top: 12px;
      font-size: 0.85rem;
      opacity: 0.75;
    }

    @media (max-width: 720px) {
      .status,
      .actions {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="panel">
    <h1>Control de Semaforo desde ESP32</h1>

    <section class="status">
      <article class="status-card">
        <div class="label">Semaforo 1</div>
        <div class="value" id="s1">-</div>
      </article>
      <article class="status-card">
        <div class="label">Semaforo 2</div>
        <div class="value" id="s2">-</div>
      </article>
      <article class="status-card">
        <div class="label">Boton fisico</div>
        <div class="value" id="button">-</div>
      </article>
      <article class="status-card">
        <div class="label">Secuencia peatonal</div>
        <div class="value" id="sequence">-</div>
      </article>
    </section>

    <section class="actions">
      <article class="block">
        <h2>Modos</h2>
        <div class="btn-row">
          <button class="ok" onclick="postCmd('/api/normal')">Modo normal</button>
          <button class="primary" onclick="postCmd('/api/pedestrian')">Cruce peatonal</button>
        </div>
      </article>

      <article class="block">
        <h2>Semaforo 1</h2>
        <div class="btn-row">
          <button class="primary" onclick="setColor('s1','RED')">Rojo</button>
          <button class="warn" onclick="setColor('s1','YELLOW')">Amarillo</button>
          <button class="ok" onclick="setColor('s1','GREEN')">Verde</button>
        </div>
      </article>

      <article class="block">
        <h2>Semaforo 2</h2>
        <div class="btn-row">
          <button class="primary" onclick="setColor('s2','RED')">Rojo</button>
          <button class="warn" onclick="setColor('s2','YELLOW')">Amarillo</button>
          <button class="ok" onclick="setColor('s2','GREEN')">Verde</button>
        </div>
      </article>

      <article class="block">
        <h2>Estado</h2>
        <div class="btn-row">
          <button class="neutral" onclick="loadState()">Actualizar ahora</button>
        </div>
        <div class="footer">La pantalla se refresca automaticamente cada 1 segundo.</div>
      </article>
    </section>
  </main>

  <script>
    async function postCmd(url) {
      try {
        const r = await fetch(url, { method: 'POST' });
        if (!r.ok) {
          const txt = await r.text();
          alert('Error: ' + txt);
        }
      } catch (e) {
        alert('No se pudo enviar el comando');
      }
      loadState();
    }

    async function setColor(target, color) {
      const params = new URLSearchParams({ target, color });
      await postCmd('/api/set?' + params.toString());
    }

    async function loadState() {
      try {
        const r = await fetch('/api/state');
        if (!r.ok) return;
        const s = await r.json();

        document.getElementById('s1').textContent = s.s1;
        document.getElementById('s2').textContent = s.s2;
        document.getElementById('button').textContent = s.buttonPressed ? 'PRESIONADO' : 'LIBERADO';
        document.getElementById('sequence').textContent = s.sequenceRunning ? ('EN CURSO (' + s.sequenceSource + ')') : 'INACTIVA';
      } catch (e) {
        // Ignorar errores temporales de red
      }
    }

    loadState();
    setInterval(loadState, 1000);
  </script>
</body>
</html>
)HTML";

  server.send(200, "text/html", html);
}

void handleGetState() {
  sendStateJson();
}

void handleSetNormal() {
  if (isSequenceRunning()) {
    server.send(409, "application/json", "{\"error\":\"Secuencia en curso\"}");
    return;
  }

  setNormalMode();
  sendStateJson();
}

void handleSetColor() {
  if (isSequenceRunning()) {
    server.send(409, "application/json", "{\"error\":\"Secuencia en curso\"}");
    return;
  }

  if (!server.hasArg("target") || !server.hasArg("color")) {
    server.send(400, "application/json", "{\"error\":\"Faltan parametros target/color\"}");
    return;
  }

  String target = server.arg("target");
  target.trim();
  target.toLowerCase();

  LightColor color = parseColor(server.arg("color"));
  if (color == LightColor::OFF) {
    server.send(400, "application/json", "{\"error\":\"Color invalido. Use RED, YELLOW o GREEN\"}");
    return;
  }

  if (target == "s1") {
    setS1(color);
  } else if (target == "s2") {
    setS2(color);
  } else {
    server.send(400, "application/json", "{\"error\":\"Target invalido. Use s1 o s2\"}");
    return;
  }

  sendStateJson();
}

void handleStartPedestrian() {
  bool started = startPedestrianSequence("web");
  if (!started) {
    server.send(409, "application/json", "{\"error\":\"Ya hay una secuencia en curso\"}");
    return;
  }

  sendStateJson(202);
}

void handleNotFound() {
  server.send(404, "text/plain", "Ruta no encontrada");
}

void setupWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.begin(SSID, PASS);

  Serial.print("Conectando a WiFi");
  const unsigned long wifiTimeoutMs = 30000;
  unsigned long startMs = millis();

  while (WiFi.status() != WL_CONNECTED && (millis() - startMs) < wifiTimeoutMs) {
    delay(400);
    Serial.print('.');
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("WiFi conectado. IP: ");
    Serial.println(WiFi.localIP());

    if (MDNS.begin(HOSTNAME)) {
      Serial.print("mDNS activo en http://");
      Serial.print(HOSTNAME);
      Serial.println(".local");
    }
  } else {
    Serial.println();
    Serial.println("No fue posible conectar a WiFi. El control web no estara disponible.");
  }
}

void setupWebServer() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/state", HTTP_GET, handleGetState);
  server.on("/api/normal", HTTP_POST, handleSetNormal);
  server.on("/api/set", HTTP_POST, handleSetColor);
  server.on("/api/pedestrian", HTTP_POST, handleStartPedestrian);
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("Servidor web iniciado");

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Abre en navegador: http://");
    Serial.println(WiFi.localIP());
  }
}

void setupPins() {
  pinMode(R1, OUTPUT);
  pinMode(Y1, OUTPUT);
  pinMode(G1, OUTPUT);
  pinMode(R2, OUTPUT);
  pinMode(Y2, OUTPUT);
  pinMode(G2, OUTPUT);

  pinMode(BUTTON_PIN, BUTTON_ACTIVE_LOW ? INPUT_PULLUP : INPUT_PULLDOWN);

  rawButtonState = readButtonPressed();
  stableButtonState = rawButtonState;
}

void pollPhysicalButton() {
  bool reading = readButtonPressed();

  if (reading != rawButtonState) {
    rawButtonState = reading;
    lastDebounceMs = millis();
  }

  if ((millis() - lastDebounceMs) < BUTTON_DEBOUNCE_MS) {
    return;
  }

  if (stableButtonState != reading) {
    stableButtonState = reading;

    if (stableButtonState) {
      bool started = startPedestrianSequence("boton");
      if (started) {
        Serial.println("Secuencia peatonal solicitada por boton fisico");
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(120);

  setupPins();
  setNormalMode();

  setupWifi();
  setupWebServer();

  Serial.println("Sistema listo");
}

void loop() {
  server.handleClient();
  pollPhysicalButton();
  updatePedestrianSequence();
}
