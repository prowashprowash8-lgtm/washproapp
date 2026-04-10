-- Permettre à l'app de lire esp32_heartbeat (pour isOnline)
-- Exécuter dans Supabase → SQL Editor

GRANT SELECT ON public.esp32_heartbeat TO anon;
