/**
 * WashPro ESP32 — firmware de référence
 *
 * - Heartbeat → register_esp32_heartbeat
 * - Commande payée → claim_pending_start_command puis impulsion relais (broche 2.3 « impulsion payée » côté machine)
 * - Optocoupleur → report_machine_run_state (p_running) + secours set_machine_available_by_esp_relay à l’arrêt
 *
 * Supabase : déployer esp32-optocoupler-machine-state-auto-fix.sql + machine-commands-claim-start.sql
 */

#include <WiFi.h>
#include <HTTPClient.h>

// ---------------------------------------------------------------------------
// CONFIG — à adapter
// ---------------------------------------------------------------------------

const char* WIFI_SSID = "link";
const char* WIFI_PASSWORD = "123456789";

const char* SUPABASE_URL = "https://ftechtqyocgdabfkmclm.supabase.co";
const char* SUPABASE_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0ZWNodHF5b2NnZGFiZmttY2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODIwNjIsImV4cCI6MjA4ODM1ODA2Mn0.JJ3XgrH5u1nfUH9HADiEAd_KOfcDyNQHt_D_MykS3k4";

const char* ESP32_ID = "WASH_PRO_001";
const int MACHINE_RELAY_ID = 1;

/** Optionnel : UUID Supabase de la ligne machines (32+ car.) pour PATCH / RPC secours si besoin */
const char* MACHINE_TABLE_UUID = "";

const int PIN_RELAY = 4;
const int PIN_OPTO = 5;

/** Relais : true = actif niveau HIGH, false = actif LOW.
 * Observation matérielle validée : en false, le relais clique au boot.
 * On garde donc true pour que le relais reste au repos au démarrage.
 */
const bool RELAY_ACTIVE_HIGH = true;

/** Opto : true = HIGH = machine en marche ; false = LOW = en marche */
const bool OPTO_HIGH_MEANS_RUNNING = false;

const unsigned long HEARTBEAT_MS = 5000;
const unsigned long RELAY_PULSE_MS = 5000;
/** Ne pas appeler claim_pending_start_command avant ce délai (sinon la RPC marque done sans relais). */
const unsigned long BOOT_GRACE_MS = 12000;
/** Anti-rebond arrêt : échantillons « arrêt » consécutifs avant de croire l’arrêt */
const uint8_t OPTO_STOP_COUNT = 10;
const unsigned long RESEND_STOPPED_MS = 2500;
const unsigned long BACKUP_RUNNING_MS = 30000;
const unsigned long WIFI_RECONNECT_TIMEOUT_MS = 20000;

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------

unsigned long msBoot = 0;
unsigned long msLastHb = 0;
unsigned long msLastMachineState = 0;
unsigned long msLastStoppedResend = 0;
unsigned long msLastDebug = 0;

bool filteredRunning = false;
bool sentRunning = false;
uint8_t stopStreak = 0;

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

void addHeaders(HTTPClient& http) {
  http.addHeader("apikey", SUPABASE_ANON);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON));
  http.addHeader("Content-Type", "application/json");
}

void postHeartbeat() {
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/rpc/register_esp32_heartbeat");
  http.setTimeout(10000);
  addHeaders(http);
  http.POST("{\"p_esp32_id\":\"" + String(ESP32_ID) + "\"}");
  http.end();
}

void patchMachineDisponibleByUuid() {
  if (MACHINE_TABLE_UUID == nullptr || strlen(MACHINE_TABLE_UUID) < 32) return;
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/machines?id=eq." + String(MACHINE_TABLE_UUID));
  http.setTimeout(8000);
  addHeaders(http);
  http.addHeader("Prefer", "return=minimal");
  http.PATCH("{\"statut\":\"disponible\",\"estimated_end_time\":null}");
  http.end();
}

bool rpcSetAvailableById() {
  if (MACHINE_TABLE_UUID == nullptr || strlen(MACHINE_TABLE_UUID) < 32) return false;
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/rpc/set_machine_available_by_id");
  http.setTimeout(8000);
  addHeaders(http);
  int code = http.POST("{\"p_machine_id\":\"" + String(MACHINE_TABLE_UUID) + "\"}");
  http.getString();
  http.end();
  return code >= 200 && code < 300;
}

bool rpcSetAvailableByEspRelay() {
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/rpc/set_machine_available_by_esp_relay");
  http.setTimeout(8000);
  addHeaders(http);
  String body = "{\"p_esp32_id\":\"" + String(ESP32_ID) + "\",\"p_relay_id\":" + String(MACHINE_RELAY_ID) + "}";
  int code = http.POST(body);
  http.getString();
  http.end();
  return code >= 200 && code < 300;
}

void reportRunState(bool running) {
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/rpc/report_machine_run_state");
  http.setTimeout(8000);
  addHeaders(http);
  String body = "{\"p_esp32_id\":\"" + String(ESP32_ID) + "\",\"p_relay_id\":" + String(MACHINE_RELAY_ID) +
                ",\"p_running\":" + String(running ? "true" : "false") + "}";
  int code = http.POST(body);
  String resp = http.getString();
  resp.trim();
  int rows = resp.toInt();
  Serial.printf("[WashPro] report_machine_run_state HTTP %d running=%s rows=%d\n", code, running ? "1" : "0", rows);
  http.end();

  if (!running) {
    if (!rpcSetAvailableByEspRelay()) {
      if (!rpcSetAvailableById() && (code != 200 || rows == 0)) patchMachineDisponibleByUuid();
    }
  }
}

bool claimStartCommand(String& outUuid) {
  outUuid = "";
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/rpc/claim_pending_start_command");
  http.setTimeout(8000);
  addHeaders(http);
  int code = http.POST("{\"p_esp32_id\":\"" + String(ESP32_ID) + "\"}");
  String payload = http.getString();
  http.end();
  if (code != 200) {
    if (code != -1) Serial.printf("[WashPro] claim HTTP %d\n", code);
    return false;
  }
  payload.trim();
  if (payload == "null" || payload.length() < 6) return false;
  if (payload.startsWith("\"") && payload.endsWith("\"") && payload.length() > 2) {
    outUuid = payload.substring(1, payload.length() - 1);
  } else {
    outUuid = payload;
  }
  outUuid.trim();
  return outUuid.length() >= 8;
}

// ---------------------------------------------------------------------------
// Relais & opto
// ---------------------------------------------------------------------------

void relayIdle() {
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_HIGH ? LOW : HIGH);
}

void relayPulse() {
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_HIGH ? HIGH : LOW);
  delay(RELAY_PULSE_MS);
  relayIdle();
}

bool sampleOptoRaw() {
  int hi = 0;
  for (int i = 0; i < 12; i++) {
    bool on = OPTO_HIGH_MEANS_RUNNING ? (digitalRead(PIN_OPTO) == HIGH) : (digitalRead(PIN_OPTO) == LOW);
    if (on) hi++;
    delay(6);
  }
  return hi > 6;
}

bool applyHysteresis(bool raw) {
  if (raw) {
    stopStreak = 0;
    return true;
  }
  if (!filteredRunning) {
    stopStreak = 0;
    return false;
  }
  stopStreak++;
  return stopStreak >= OPTO_STOP_COUNT ? false : true;
}

bool wifiEnsureConnected() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.println("[WiFi] reconnexion…");
  WiFi.reconnect();
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < WIFI_RECONNECT_TIMEOUT_MS) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  return WiFi.status() == WL_CONNECTED;
}

// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);
  msBoot = millis();

  // Mettre la sortie relais au repos immédiatement pour éviter un clic parasite au boot.
  pinMode(PIN_RELAY, OUTPUT);
  relayIdle();
  delay(50);
  pinMode(PIN_OPTO, INPUT_PULLUP);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println(" OK");

  postHeartbeat();
  msLastHb = millis();

  stopStreak = 0;
  bool raw = sampleOptoRaw();
  filteredRunning = applyHysteresis(raw);
  sentRunning = filteredRunning;
  reportRunState(sentRunning);
  msLastMachineState = msLastStoppedResend = millis();

  Serial.println("[WashPro] prêt.");
}

void loop() {
  unsigned long now = millis();

  if (now - msLastHb >= HEARTBEAT_MS) {
    if (wifiEnsureConnected()) postHeartbeat();
    msLastHb = millis();
  }

  if (!wifiEnsureConnected()) {
    delay(300);
    return;
  }

  // Un seul échantillonnage opto / hystérésis par tour de boucle
  bool raw = sampleOptoRaw();
  bool running = applyHysteresis(raw);
  filteredRunning = running;

  // --- Commande START (paiement déjà validé côté serveur) ---
  // Ne pas bloquer le claim sur l'hystérésis opto : si elle reste à « marche » à tort,
  // la ligne resterait pending. Après un claim réussi, on pulse toujours (paiement = autorisation).
  if (now - msBoot >= BOOT_GRACE_MS) {
    String cmd;
    if (claimStartCommand(cmd)) {
      Serial.println("[WashPro] START — impulsion relais");
      relayPulse();

      stopStreak = 0;
      raw = sampleOptoRaw();
      running = applyHysteresis(raw);
      filteredRunning = running;
      sentRunning = running;
      if (running) reportRunState(true);
      msLastMachineState = msLastStoppedResend = millis();
      delay(50);
      return;
    }
  }

  // --- Suivi opto continu ---

  if (running != sentRunning) {
    Serial.println(running ? "[Opto] MARCHE" : "[Opto] ARRÊT");
    reportRunState(running);
    sentRunning = running;
    msLastMachineState = msLastStoppedResend = millis();
  } else if (!running) {
    if (now - msLastStoppedResend >= RESEND_STOPPED_MS) {
      reportRunState(false);
      msLastStoppedResend = millis();
    }
  } else if (now - msLastMachineState >= BACKUP_RUNNING_MS) {
    reportRunState(true);
    msLastMachineState = millis();
  }

  if (now - msLastDebug >= 5000) {
    msLastDebug = millis();
    Serial.printf("[Opto] pin=%d running~=%d\n", digitalRead(PIN_OPTO), running ? 1 : 0);
  }

  delay(80);
}
