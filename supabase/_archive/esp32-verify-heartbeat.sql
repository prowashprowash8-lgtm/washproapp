-- Vérifier que l'ESP32 envoie bien des heartbeats
-- Exécuter dans Supabase → SQL Editor
-- Si la table est vide ou last_seen est ancien, l'ESP32 n'envoie pas de heartbeat

SELECT esp32_id, last_seen, 
       EXTRACT(EPOCH FROM (now() - last_seen))::int as secondes_depuis_dernier
FROM esp32_heartbeat
ORDER BY last_seen DESC;
