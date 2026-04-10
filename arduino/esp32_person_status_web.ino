#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ESPmDNS.h>

// --- CONFIGURACION WIFI ---
const char* SSID = "@PHICOMM_7C";
const char* PASS = "12345678";
const char* HOSTNAME = "esp32-vial";

// --- BACKEND (cambia por la IP LAN donde corre tu backend) ---
const char* BACKEND_HOST = "192.168.2.245";
const int BACKEND_PORT = 4000;

// true: consulta https://... (certificado autofirmado permitido)
// false: consulta http://...
const bool USE_HTTPS = true;

WebServer server(80);
bool personDetected = false;
bool vehicleOnlyDetected = false;
unsigned long lastPollMs = 0;

const char* wifiStatusText(wl_status_t status) {
  switch (status) {
    case WL_NO_SSID_AVAIL: return "WL_NO_SSID_AVAIL (SSID no encontrado)";
    case WL_CONNECT_FAILED: return "WL_CONNECT_FAILED (clave incorrecta o AP rechazo)";
    case WL_CONNECTION_LOST: return "WL_CONNECTION_LOST (conexion perdida)";
    case WL_DISCONNECTED: return "WL_DISCONNECTED (desconectado)";
    case WL_IDLE_STATUS: return "WL_IDLE_STATUS (intentando conectar)";
    default: return "Estado desconocido";
  }
}

void handleRoot() {
  String bg = "#2f2f2f";
  String txt = "SIN DETECCION";

  if (personDetected) {
    bg = "#00b050";
    txt = "PERSONA DETECTADA";
  } else if (vehicleOnlyDetected) {
    bg = "#d22222";
    txt = "AUTO DETECTADO";
  }

  String html =
    "<!doctype html><html><head>"
    "<meta charset='utf-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<meta http-equiv='refresh' content='1'>"
    "<title>ESP32 Estado</title>"
    "<style>"
    "html,body{margin:0;height:100%;font-family:Arial,sans-serif;background:" + bg + ";color:#fff;}"
    ".c{height:100%;display:grid;place-items:center;text-align:center;padding:12px;}"
    "h1{font-size:clamp(22px,8vw,44px);margin:0;letter-spacing:.05em;}"
    "p{margin-top:10px;font-size:14px;opacity:.9;}"
    "</style></head><body>"
    "<div class='c'><div><h1>" + txt + "</h1><p>Actualiza cada 1 segundo</p></div></div>"
    "</body></html>";

  server.send(200, "text/html", html);
}

void updatePresenceFromJson(const String& body) {
  // Espera JSON como: {"state":"GREEN|RED|GRAY","personDetected":true,"vehicleOnlyDetected":false,...}
  // 1) Ruta principal: estado discreto (mas estable ante cambios de orden del JSON)
  int stateKeyPos = body.indexOf("\"state\"");
  if (stateKeyPos >= 0) {
    int greenPos = body.indexOf("\"GREEN\"", stateKeyPos);
    int redPos = body.indexOf("\"RED\"", stateKeyPos);
    int grayPos = body.indexOf("\"GRAY\"", stateKeyPos);

    if (greenPos >= 0) {
      personDetected = true;
      vehicleOnlyDetected = false;
      return;
    }

    if (redPos >= 0) {
      personDetected = false;
      vehicleOnlyDetected = true;
      return;
    }

    if (grayPos >= 0) {
      personDetected = false;
      vehicleOnlyDetected = false;
      return;
    }
  }

  // 2) Respaldo: lectura por banderas booleanas
  int keyPos = body.indexOf("\"personDetected\"");
  if (keyPos < 0) return;

  int truePos = body.indexOf("true", keyPos);
  int falsePos = body.indexOf("false", keyPos);

  if (truePos >= 0 && (falsePos < 0 || truePos < falsePos)) {
    personDetected = true;
    return;
  }

  if (falsePos >= 0) {
    personDetected = false;
  }

  int vehicleOnlyKeyPos = body.indexOf("\"vehicleOnlyDetected\"");
  if (vehicleOnlyKeyPos >= 0) {
    int vehicleTruePos = body.indexOf("true", vehicleOnlyKeyPos);
    int vehicleFalsePos = body.indexOf("false", vehicleOnlyKeyPos);

    if (vehicleTruePos >= 0 && (vehicleFalsePos < 0 || vehicleTruePos < vehicleFalsePos)) {
      vehicleOnlyDetected = true;
      return;
    }

    if (vehicleFalsePos >= 0) {
      vehicleOnlyDetected = false;
    }
  }
}

void pollBackendStatus() {
  String url = String(USE_HTTPS ? "https://" : "http://") +
               BACKEND_HOST + ":" + String(BACKEND_PORT) +
               "/api/esp32/person-status";

  if (USE_HTTPS) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient https;
    https.setTimeout(1800);

    if (https.begin(client, url)) {
      int code = https.GET();
      if (code == 200) {
        updatePresenceFromJson(https.getString());
      }
      https.end();
    }
    return;
  }

  WiFiClient client;
  HTTPClient http;
  http.setTimeout(1800);
  if (http.begin(client, url)) {
    int code = http.GET();
    if (code == 200) {
      updatePresenceFromJson(http.getString());
    }
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);

  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.begin(SSID, PASS);
  Serial.print("Conectando a SSID: ");
  Serial.println(SSID);
  Serial.print("Conectando WiFi");
  const unsigned long wifiTimeoutMs = 30000;
  unsigned long wifiStartMs = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - wifiStartMs) < wifiTimeoutMs) {
    delay(400);
    Serial.print('.');
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println();
    Serial.println("No fue posible conectar al WiFi en 30s.");
    Serial.println(wifiStatusText(WiFi.status()));
    Serial.println("Revisa: red 2.4 GHz, SSID/clave y que no tenga portal cautivo.");
    return;
  }

  Serial.println();
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());

  if (MDNS.begin(HOSTNAME)) {
    Serial.print("MDNS activo: http://");
    Serial.print(HOSTNAME);
    Serial.println(".local");
  } else {
    Serial.println("MDNS no disponible, usa la IP mostrada arriba");
  }

  server.on("/", handleRoot);
  server.begin();
  Serial.println("Servidor web ESP32 iniciado");
  Serial.print("URL local: http://");
  Serial.println(WiFi.localIP());
}

void loop() {
  server.handleClient();

  if (millis() - lastPollMs >= 1000) {
    lastPollMs = millis();
    if (WiFi.status() == WL_CONNECTED) {
      pollBackendStatus();
    }
  }
}
