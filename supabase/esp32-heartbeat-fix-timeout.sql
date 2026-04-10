-- WashPro : Réduire le délai de détection ESP32 hors ligne (60s → 15s)
-- Exécuter dans Supabase → SQL Editor

create or replace function public.check_esp32_online(p_esp32_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  if p_esp32_id is null or trim(p_esp32_id) = '' then
    return false;
  end if;

  select last_seen into v_last
  from esp32_heartbeat
  where esp32_id = trim(p_esp32_id);

  -- En ligne si last_seen < 15 secondes (ESP32 poll toutes les 5s)
  return v_last is not null and (now() - v_last) < interval '15 seconds';
end;
$$;
