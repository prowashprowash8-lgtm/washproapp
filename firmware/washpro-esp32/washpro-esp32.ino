/**
 * WashPro ESP32 — stable
 *
 * IMPORTANT côté Supabase : si PATCH "done" échoue (HTTP 401), exécute
 *   supabase/machine-commands-rls-fix.sql
 * Sinon l'ESP ne peut pas acquitter les commandes (file bloquée).
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "link";
const char* WIFI_PASSWORD = "123456789";

const char* SUPABASE_URL = "https://ftechtqyocgdabfkmclm.supabase.co";
const char* SUPABASE_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0ZWNodHF5b2NnZGFiZmttY2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODIwNjIsImV4cCI6MjA4ODM1ODA2Mn0.JJ3XgrH5u1nfUH9HADiEAd_KOfcDyNQHt_D_MykS3k4";

const char* ESP32_ID = "WASH_PRO_001";
const int MACHINE_RELAY_ID = 1;
const char* MACHINE_TABLE_UUID = "";

const int RELAIS_PIN = 4;
const int OPTO_PIN = 5;
const bool OPTO_HIGH_MEANS_RUNNING = false;

unsigned long lastHeartbeatMs = 0;
const unsigned long HEARTBEAT_INTERVAL_MS = 5000;
unsigned long lastMachineStateMs = 0;
const unsigned long MACHINE_STATE_BACKUP_RUNNING_MS = 30000;
unsigned long lastStoppedResendMs = 0;
const unsigned long RESEND_STOPPED_MS = 2000;
unsigned long lastStartOrderMs = 0;
// On n'applique plus de grâce fixe après START : si l'utilisateur annule vite,
// la machine doit pouvoir repasser disponible immédiatement.
const unsigned long GRACE_AFTER_START_MS = 0;
unsigned long lastDebugMs = 0;

bool lastFilteredRunning = false;
bool lastSentRunning = false;
bool runningSeenAfterStart = false;
uint8_t optoStopStreak = 0;
const uint8_t OPTO_STOP_STREAK_MIN = 12;

/** Dernière commande pour laquelle on a déjà fait l'impulsion relais (évite double pulse si PATCH échoue). */
String lastPulsedCommandId;

void headersHttp(HTTPClient& http) {
  http.addHeader("apikey", SUPABASE_ANON);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON));
  http.addHeader("Content-Type", "application/json");
}

void sendHeartbeat() {
  HTTPClient hb;
  hb.begin(String(SUPABASE_URL) + "/rest/v1/rpc/register_esp32_heartbeat");
  hb.setTimeout(10000);
  headersHttp(hb);
  hb.POST("{\"p_esp32_id\":\"" + String(ESP32_ID) + "\"}");
  hb.end();
}

void patchMachineDisponibleByUuid() {
  if (MACHINE_TABLE_UUID == nullptr || strlen(MACHINE_TABLE_UUID) < 32) return;
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/machines?id=eq." + String(MACHINE_TABLE_UUID));
  http.setTimeout(8000);
  headersHttp(http);
  http.addHeader("Prefer", "return=minimal");
  http.PATCH("{\"statut\":\"disponible\",\"estimated_end_time\":null}");
  http.end();
}

bool setMachineDisponibleByIdRpc() {
  if (MACHINE_TABLE_UUID == nullptr || strlen(MACHINE_TABLE_UUID) < 32) return false;
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/rpc/set_machine_available_by_id");
  http.setTimeout(8000);
  headersHttp(http);
  int code = http.POST("{\"p_machine_id\":\"" + String(MACHINE_TABLE_UUID) + "\"}");
  String resp = http.getString();
  Serial.printf("[WashPro] set_machine_available_by_id HTTP %d %s\n", code, resp.c_str());
  http.end();
  return code >= 200 && code < 300;
}

void sendMachineRunState(bool running) {
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/rpc/report_machine_run_state");
  http.setTimeout(8000);
  headersHttp(http);
  String body = "{\"p_esp32_id\":\"" + String(ESP32_ID) + "\",\"p_relay_id\":" + String(MACHINE_RELAY_ID) +
                ",\"p_running\":" + String(running ? "true" : "false") + "}";
  int code = http.POST(body);
  String resp = http.getString();
  resp.trim();
  int rows = resp.toInt();
  Serial.printf("[WashPro] report_machine_run_state HTTP %d p_running=%s | lignes=%d\n",
                code, running ? "true" : "false", rows);
  http.end();
  if (!running) {
    // Toujours forcer un fallback explicite au STOP pour garantir le retour "disponible"
    // même si le mapping report_machine_run_state ne match pas.
    bool ok = setMachineDisponibleByIdRpc();
    if (!ok && (code != 200 || rows == 0)) patchMachineDisponibleByUuid();
  }
}

bool inGraceAfterStart() {
  return lastStartOrderMs > 0 && (millis() - lastStartOrderMs) < GRACE_AFTER_START_MS;
}

void sendMachineRunStateFiltered(bool running) {
  // Le filtrage de l'opto + hystérésis suffit; on n'ignore plus les STOP précoces.
  sendMachineRunState(running);
}

bool updateCommandStatus(const char* id) {
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/machine_commands?id=eq." + String(id) + "&status=eq.pending");
  http.setTimeout(8000);
  headersHttp(http);
  http.addHeader("Prefer", "return=representation");
  int code = http.PATCH("{\"status\":\"done\"}");
  String resp = http.getString();
  Serial.printf("[WashPro] PATCH done id=%s HTTP %d %s\n", id, code, resp.c_str());
  http.end();
  return code >= 200 && code < 300;
}

bool readOptoRunningInstant() {
  int hi = 0;
  for (int i = 0; i < 15; i++) {
    bool bit = OPTO_HIGH_MEANS_RUNNING ? (digitalRead(OPTO_PIN) == HIGH) : (digitalRead(OPTO_PIN) == LOW);
    if (bit) hi++;
    delay(8);
  }
  return hi > 7;
}

bool filterRunningWithHysteresis(bool rawRunning) {
  if (rawRunning) {
    optoStopStreak = 0;
    return true;
  }
  if (!lastFilteredRunning) {
    optoStopStreak = 0;
    return false;
  }
  optoStopStreak++;
  return optoStopStreak >= OPTO_STOP_STREAK_MIN ? false : true;
}

bool fetchOnePendingStart(String& outId) {
  outId = "";
  HTTPClient http;
  String url = String(SUPABASE_URL) +
               "/rest/v1/machine_commands?esp32_id=eq." + String(ESP32_ID) +
               "&status=eq.pending&command=eq.START&select=id&order=created_at.desc&limit=1";
  http.begin(url);
  http.setTimeout(8000);
  headersHttp(http);
  int code = http.GET();
  String payload = http.getString();
  http.end();
  if (code != 200) {
    Serial.printf("[WashPro] GET machine_commands HTTP %d %s\n", code, payload.c_str());
    return false;
  }
  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, payload)) return false;
  JsonArray arr = doc.as<JsonArray>();
  if (arr.size() == 0) return false;
  const char* id = arr[0]["id"];
  if (!id) return false;
  outId = String(id);
  return true;
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAIS_PIN, OUTPUT);
  digitalWrite(RELAIS_PIN, LOW);
  pinMode(OPTO_PIN, INPUT_PULLUP);
  Serial.print("WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" OK");
  sendHeartbeat();
  lastHeartbeatMs = millis();
  optoStopStreak = 0;
  bool raw = readOptoRunningInstant();
  lastFilteredRunning = filterRunningWithHysteresis(raw);
  lastSentRunning = lastFilteredRunning;
  sendMachineRunState(lastSentRunning);
  lastMachineStateMs = millis();
  lastStoppedResendMs = millis();
  Serial.println("WashPro OK — si PATCH done = 401, exécute machine-commands-rls-fix.sql sur Supabase.");
}

void loop() {
  if (millis() - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeatMs = millis();
  }

  bool skipOpto = false;

  if (WiFi.status() == WL_CONNECTED) {
    String cmdId;
    if (fetchOnePendingStart(cmdId) && cmdId.length() > 0) {
      bool needPulse = (cmdId != lastPulsedCommandId);
      if (needPulse) {
        lastStartOrderMs = millis();
        runningSeenAfterStart = false;
        Serial.println(">>> START (paiement app) — relais <<<");
        digitalWrite(RELAIS_PIN, HIGH);
        delay(5000);
        digitalWrite(RELAIS_PIN, LOW);
        lastPulsedCommandId = cmdId;
      } else {
        Serial.println("[WashPro] même commande — pas de 2e relais, tentative PATCH done seulement");
      }

      if (updateCommandStatus(cmdId.c_str())) {
        lastPulsedCommandId = "";
        Serial.println("[WashPro] Commande acquittée.");
      } else {
        Serial.println("[WashPro] PATCH échoué — vérifie RLS (machine-commands-rls-fix.sql)");
      }

      optoStopStreak = 0;
      bool rawAfter = readOptoRunningInstant();
      lastFilteredRunning = filterRunningWithHysteresis(rawAfter);
      if (lastFilteredRunning) runningSeenAfterStart = true;
      lastSentRunning = lastFilteredRunning;
      if (lastFilteredRunning) sendMachineRunState(true);
      lastStoppedResendMs = millis();
      lastMachineStateMs = millis();
      skipOpto = true;
    }
  }

  if (skipOpto) {
    delay(80);
    return;
  }

  bool rawRunning = readOptoRunningInstant();
  bool running = filterRunningWithHysteresis(rawRunning);
  lastFilteredRunning = running;

  if (running != lastSentRunning) {
    Serial.println(running ? "[Opto] MARCHE" : "[Opto] ARRÊT");
    if (running) runningSeenAfterStart = true;
    sendMachineRunStateFiltered(running);
    lastSentRunning = running;
    lastMachineStateMs = millis();
    lastStoppedResendMs = millis();
  }

  if (!running) {
    if (!inGraceAfterStart() && millis() - lastStoppedResendMs >= RESEND_STOPPED_MS) {
      sendMachineRunStateFiltered(false);
      lastStoppedResendMs = millis();
    }
  } else if (millis() - lastMachineStateMs >= MACHINE_STATE_BACKUP_RUNNING_MS) {
    sendMachineRunState(true);
    lastMachineStateMs = millis();
  }

  if (millis() - lastDebugMs >= 4000) {
    lastDebugMs = millis();
    Serial.printf("[Opto] brut=%d filt=%d\n", digitalRead(OPTO_PIN), (int)running);
  }

  delay(80);
}
