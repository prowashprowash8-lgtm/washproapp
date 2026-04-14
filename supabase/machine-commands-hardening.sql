-- WashPro : hardening commandes START
-- Empêche les commandes START "hors paiement" d'être consommées par l'ESP.
-- Exécuter dans Supabase -> SQL Editor.

-- 1) Index utile pour la requête ESP (pending + transaction_id non null)
create index if not exists idx_machine_commands_esp32_pending_tx
  on public.machine_commands (esp32_id, created_at desc)
  where status = 'pending' and command = 'START' and transaction_id is not null;

-- 2) Nettoyage one-shot des pending START sans transaction (legacy / bruit)
update public.machine_commands
set status = 'done'
where command = 'START'
  and status = 'pending'
  and transaction_id is null;

-- 3) Optionnel (debug)
-- select id, esp32_id, command, status, transaction_id, created_at
-- from public.machine_commands
-- where status = 'pending'
-- order by created_at desc;

