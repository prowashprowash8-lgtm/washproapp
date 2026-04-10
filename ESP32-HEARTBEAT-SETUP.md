# Détection ESP32 en ligne — Guide de dépannage

## Si l'app ne détecte pas l'ESP32 branché

### 1. Exécuter le script SQL dans Supabase

Dans **Supabase → SQL Editor**, exécuter le contenu de `supabase/esp32-heartbeat.sql` (ou `washprobox-board/supabase-esp32-heartbeat.sql`).

Cela crée la table `esp32_heartbeat` et les RPC `register_esp32_heartbeat` et `check_esp32_online`.

### 2. Vérifier que l'ESP32 envoie bien le heartbeat

Dans le firmware, **remplacez** les placeholders :
- `SUPABASE_ANON` = votre clé anon Supabase (`.env` → `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- `ESP32_ID` = l'ID de votre ESP32 (ex: `WASH_307`)

Ouvrez le **Moniteur Série** (115200 baud). Si le heartbeat échoue, vous verrez :
```
[WashPro] Heartbeat err: 401
```
→ Clé anon incorrecte ou manquante.

### 3. Vérifier que les IDs correspondent

L'`esp32_id` utilisé par l'app doit être **identique** à `ESP32_ID` dans le firmware.

- **Emplacement** : Dashboard → Emplacements → votre laverie → Paramètres → champ « ID ESP32 »
- **Machine** : chaque machine a un champ `esp32_id` dans le dashboard

L'app utilise d'abord l'`esp32_id` de l'emplacement, puis celui de la machine sélectionnée.

### 4. Vérifier dans Supabase

Dans **Supabase → Table Editor → esp32_heartbeat** :

- Si la table est vide → l'ESP32 n'envoie pas de heartbeat (firmware, WiFi ou clé anon)
- Si une ligne existe avec `last_seen` récent → l'ESP32 envoie bien ; le problème vient de l'`esp32_id` côté app

### 5. Correspondance des IDs

| Où | Valeur |
|----|--------|
| Firmware `ESP32_ID` | ex: `WASH_307` |
| Machine `esp32_id` (dashboard) | ex: `WASH_307` |
| Emplacement `esp32_id` (dashboard) | ex: `WASH_307` |

Ces valeurs doivent être **exactement identiques** (casse incluse).

### 6. Contourner temporairement (dépannage)

Dans `.env` de l'app, ajouter :
```
EXPO_PUBLIC_SKIP_ESP32_CHECK=true
```
L'app autorisera le paiement sans vérifier l'ESP32. À retirer une fois le problème résolu.
