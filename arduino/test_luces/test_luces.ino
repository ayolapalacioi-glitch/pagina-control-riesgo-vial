/*
  PRUEBA MAESTRA: ENCENDIDO TOTAL
  Este codigo encendera ABSOLUTAMENTE TODAS las luces al mismo tiempo.
  Sirve para descartar si algun LED o Pin esta dañado.
*/

// --- PINES CONFIGURADOS ---
const int R1 = 25; const int Y1 = 5;  const int G1 = 17; // Vehicular 1
const int R2 = 19;  const int Y2 = 2;  const int G2 = 15; // Peatonal
const int R3 = 26; const int Y3 = 12; const int G3 = 13; // Vehicular 2

void setup() {
  Serial.begin(115200);
  Serial.println(">>> INICIANDO PRUEBA DE ENCENDIDO TOTAL <<<");

  // Configurar todos como SALIDA
  pinMode(R1, OUTPUT); pinMode(Y1, OUTPUT); pinMode(G1, OUTPUT);
  pinMode(R2, OUTPUT); pinMode(Y2, OUTPUT); pinMode(G2, OUTPUT);
  pinMode(R3, OUTPUT); pinMode(Y3, OUTPUT); pinMode(G3, OUTPUT);

  // Forzar encendido de TODO
  digitalWrite(R1, HIGH);
  digitalWrite(Y1, HIGH);
  digitalWrite(G1, HIGH);
  
  digitalWrite(R2, HIGH);
  digitalWrite(Y2, HIGH);
  digitalWrite(G2, HIGH);
  
  digitalWrite(R3, HIGH);
  digitalWrite(Y3, HIGH);
  digitalWrite(G3, HIGH);

  Serial.println("ESTADO: Todos los pines en HIGH.");
  Serial.println("Si alguna luz no enciende, revisa el cable o el LED.");
}

void loop() {
  // Mantener encendido y enviar mensaje cada 5 segundos
  Serial.println("Luces activas...");
  delay(5000);
}
