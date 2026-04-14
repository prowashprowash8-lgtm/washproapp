-- WashPro : purge des commandes START "pending" trop anciennes
-- But: éviter un démarrage involontaire lors d'un reboot ESP32.
-- Exécuter dans Supabase -> SQL Editor (production), puis à garder pour maintenance.

-- 1) Nettoyage one-shot (ex: commandes en attente depuis > 30s)
update public.machine_commands
set status = 'done'
where command = 'START'
  and status = 'pending'
  and created_at < now() - interval '30 seconds';

-- 2) Option diagnostic
-- select id, esp32_id, command, status, created_at
-- from public.machine_commands
-- where status = 'pending'
-- order by created_at desc;

