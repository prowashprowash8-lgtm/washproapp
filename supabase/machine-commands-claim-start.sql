-- WashPro : claim atomique d'une commande START pour ESP32
-- Evite les commandes "pending" fantomes au reboot et le double lancement.
-- Exécuter dans Supabase -> SQL Editor.
--
-- Fenêtre `created_at` : si elle est trop courte, un ESP autonome qui met du temps
-- à joindre le WiFi (boot + reconnexion) rate la commande alors que le paiement est OK.
-- Fenêtre large : une ligne peut rester pending si l’ESP était hors ligne ou si le claim était bloqué.
-- 24 h évite les commandes « mortes » tout en limitant les reprises très anciennes.
--
-- CRITIQUE #14 de l'audit : cette fonction identifiait l'ESP32 par un simple texte prévisible
-- (ex: "WASH_PRO_001"), sans secret propre à l'appareil. Comme elle est accessible avec la clé
-- anon, n'importe qui pouvait deviner les ID et "consommer" à distance des commandes de
-- démarrage déjà payées par de vrais clients, sans avoir de machine physique. Le secret vit
-- dans esp32_heartbeat.device_secret (une ligne par ESP32, provisionnée manuellement).

alter table public.esp32_heartbeat add column if not exists device_secret text;

drop function if exists public.claim_pending_start_command(text);

create or replace function public.claim_pending_start_command(
  p_esp32_id text,
  p_device_secret text
)
returns text
language plpgsql
security definer
set search_path = public
as $q$
declare
  v_id uuid;
begin
  if p_esp32_id is null or trim(p_esp32_id) = '' then
    return null;
  end if;

  if not exists (
    select 1 from public.esp32_heartbeat h
    where h.esp32_id = trim(p_esp32_id)
      and h.device_secret is not null
      and h.device_secret = p_device_secret
  ) then
    return null;
  end if;

  with candidate as (
    select mc.id
    from public.machine_commands mc
    join public.transactions t on t.id = mc.transaction_id
    where lower(trim(coalesce(mc.esp32_id, ''))) = lower(trim(p_esp32_id))
      and mc.command = 'START'
      and mc.status = 'pending'
      and mc.transaction_id is not null
      and lower(coalesce(t.payment_method, '')) <> 'test'
      and mc.created_at >= now() - interval '24 hours'
    order by mc.created_at desc
    limit 1
    for update skip locked
  )
  update public.machine_commands mc
  set status = 'done'
  from candidate c
  where mc.id = c.id
  returning mc.id into v_id;

  if v_id is null then
    return null;
  end if;
  return v_id::text;
end;
$q$;

revoke all on function public.claim_pending_start_command(text, text) from public;
grant execute on function public.claim_pending_start_command(text, text) to anon;
grant execute on function public.claim_pending_start_command(text, text) to authenticated;
