# Configuration ESP32 + Supabase pour WashPro

L'app envoie une commande dans Supabase. L'ESP32 poll la table `machine_commands` et active le relais quand il trouve une commande `START`.

## 1. Table machine_commands

Exécutez **`supabase/machine-commands.sql`** dans le SQL Editor de Supabase.

## 2. Configuration emplacements

Dans la table `emplacements`, ajoutez la colonne `esp32_id` et renseignez l'ID de l'ESP32 pour chaque laverie :

| id   | name           | address              | esp32_id     |
|------|----------------|----------------------|--------------|
| ...  | LAVERIE MORTIER | Rue de la Borde...   | WASH_PRO_001 |

## 3. Flux

1. L'utilisateur clique sur **Payé** dans l'app
2. L'app insère une ligne dans `machine_commands` : `{ esp32_id: "WASH_PRO_001", command: "START", status: "pending" }`
3. L'ESP32 poll Supabase toutes les secondes
4. L'ESP32 trouve la commande, active le relais 1 seconde, puis met `status: "done"`

## 4. Code Arduino (déjà fourni)

Votre code est compatible. Assurez-vous que :
- `ESP32_ID = "WASH_PRO_001"` correspond à `esp32_id` dans `emplacements`
- La table `machine_commands` existe avec les colonnes : id, esp32_id, command, status

## 5. Alternative : variable d'environnement

Si vous ne voulez pas utiliser Supabase pour l'ID, ajoutez dans `.env` :

```
EXPO_PUBLIC_ESP32_ID=WASH_PRO_001
```

L'app utilisera cette valeur par défaut si `esp32_id` est vide dans l'emplacement.

## 6. Optocoupleur (état réel machine → « Disponible » dans l’app)

Si la machine **s’arrête** avant la fin du temps affiché (ou à la fin du cycle), l’ESP peut l’indiquer pour que la base repasse la machine en **disponible** sans attendre le compte à rebours.

1. Exécutez **`supabase/esp32-optocoupler-machine-state.sql`** dans le SQL Editor.
2. Chaque ligne **`machines`** doit avoir un **`relay_id`** (1, 2, …) aligné avec le relais sur la box.
3. Depuis le firmware, appelez la RPC **`report_machine_run_state`** en HTTP (REST) :

- **POST** `https://<PROJECT>.supabase.co/rest/v1/rpc/report_machine_run_state`
- Headers : `apikey` et `Authorization: Bearer <ANON_KEY>`, `Content-Type: application/json`
- Corps JSON : `{ "p_esp32_id": "WASH_PRO_001", "p_relay_id": 1, "p_running": false }`

Quand **`p_running`** est **`false`**, Supabase met `statut = disponible` et efface `estimated_end_time` pour cette machine. L’app recharge déjà les machines en continu : l’utilisateur voit la machine libre.

Le sketch **`firmware/washpro-esp32/washpro-esp32.ino`** envoie **dès que l’état change** (surtout marche → arrêt), plus un **secours** toutes les 30 s. Tant que **`p_running` est `true`**, la RPC ne remet pas la machine en dispo côté arrêt opto (l’occupation vient du paiement dans l’app).

### Comment obtenir le « retour d’état » (chaîne complète)

1. **Câblage** : sortie de l’optocoupleur → une **entrée GPIO** de l’ESP (avec le bon niveau 3,3 V / masse selon ta carte). Tu dois savoir, après essai au multimètre ou moniteur série, si **niveau HAUT** = machine en marche ou l’inverse.
2. **Dans le `loop()`** : `bool running = digitalRead(PIN_OPTO) == NIVEAU_QUI_SIGNIFIE_MARCHE;` (éventuellement filtre temporel si le signal tremble).
3. **Envoi vers Supabase** : même principe que le **heartbeat** (WiFi + `HTTPClient` + POST JSON), mais vers **`/rest/v1/rpc/report_machine_run_state`** avec le corps ci‑dessous. Répète toutes les **10 s** ou seulement quand `running` **change** (pour limiter le trafic).
4. **Valeurs** : `p_esp32_id` = ton `ESP32_ID` (identique à `emplacements.esp32_id`) ; `p_relay_id` = le **`relay_id`** de cette machine dans la table **`machines`** (1 pour la 1re machine, etc.).
5. **Vérification** : après un arrêt, dans Supabase → **Table Editor** → **`machines`**, la ligne doit repasser en **`disponible`**. L’app suit au prochain rafraîchissement.

### Exemple Arduino (ESP32, à adapter)

Remplace `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ESP32_ID`, `RELAY_ID_MACHINE_1`, `PIN_OPTO`. Ajuste la logique `running` selon ton câblage.

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "...";
const char* WIFI_PASS = "...";
const char* SUPABASE_URL = "https://xxxx.supabase.co";  // sans slash final
const char* SUPABASE_ANON_KEY = "eyJ...";               // Settings → API → anon public
const char* ESP32_ID = "WASH_PRO_001";
const int RELAY_ID_MACHINE_1 = 1;
const int PIN_OPTO = 4;

unsigned long lastReport = 0;

void reportMachineState(bool running) {
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/rpc/report_machine_run_state";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);

  String body = "{\"p_esp32_id\":\"" + String(ESP32_ID) + "\",\"p_relay_id\":"
    + String(RELAY_ID_MACHINE_1) + ",\"p_running\":" + (running ? "true" : "false") + "}";

  int code = http.POST(body);
  Serial.printf("[WashPro] report_machine_run_state HTTP %d\n", code);
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_OPTO, INPUT_PULLUP);  // ou INPUT selon ton montage
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi OK");
}

void loop() {
  // Exemple : HIGH = tambour / machine vue comme « en marche » (à inverser si besoin)
  bool running = digitalRead(PIN_OPTO) == HIGH;

  if (millis() - lastReport > 10000) {
    lastReport = millis();
    reportMachineState(running);
  }
}
```

Test rapide sans ESP : **curl** (remplace URL et clé) :

```bash
curl -s -X POST 'https://xxxx.supabase.co/rest/v1/rpc/report_machine_run_state' \
  -H "apikey: ANON_KEY" -H "Authorization: Bearer ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_esp32_id":"WASH_PRO_001","p_relay_id":1,"p_running":false}'
```

Réponse **200** et la ligne **`machines`** mise à jour = le retour d’état fonctionne ; il ne reste plus qu’à affiner la lecture GPIO sur la vraie machine.
