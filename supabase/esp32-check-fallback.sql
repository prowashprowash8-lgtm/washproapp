-- WashPro : Fallback si heartbeat non reçu
-- Si esp32_heartbeat est vide, on vérifie machine_commands (commande récemment exécutée = ESP32 actif)
-- Exécuter dans Supabase → SQL Editor

CREATE OR REPLACE FUNCTION public.check_esp32_online(p_esp32_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
  v_recent_done boolean;
BEGIN
  IF p_esp32_id IS NULL OR trim(p_esp32_id) = '' THEN
    RETURN false;
  END IF;

  -- 1. Vérifier le heartbeat (priorité)
  SELECT last_seen INTO v_last
  FROM esp32_heartbeat
  WHERE esp32_id = trim(p_esp32_id);

  IF v_last IS NOT NULL AND (now() - v_last) < interval '15 seconds' THEN
    RETURN true;
  END IF;

  -- 2. Fallback : commande "done" créée récemment (ESP32 a traité une commande du board)
  SELECT EXISTS (
    SELECT 1 FROM machine_commands
    WHERE esp32_id = trim(p_esp32_id)
      AND status = 'done'
      AND created_at > now() - interval '5 minutes'
  ) INTO v_recent_done;

  RETURN v_recent_done;
END;
$$;
