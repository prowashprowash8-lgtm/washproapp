-- WashPro : provisionnement d'un nouvel ESP32 (secret d'appareil, CRITIQUE #14 de l'audit)
-- Exécuter dans Supabase → SQL Editor (une fois, à chaque nouveau boîtier physique).
--
-- Usage : select public.provision_esp32_device('WASH_PRO_00X');
-- Le résultat donne directement les 2 lignes à coller dans washpro-esp32.ino
-- (ESP32_ID + DEVICE_SECRET), à la place des lignes existantes.
--
-- Rejouer avec un ESP32_ID déjà existant régénère (remplace) son secret — utile si un
-- boîtier est perdu/volé, mais il faudra alors reflasher ce boîtier avec le nouveau secret.

create or replace function public.provision_esp32_device(p_esp32_id text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_id text;
begin
  v_id := trim(p_esp32_id);
  if v_id is null or v_id = '' then
    raise exception 'esp32_id requis, ex: provision_esp32_device(''WASH_PRO_002'')';
  end if;

  v_secret := encode(gen_random_bytes(24), 'hex');

  insert into public.esp32_heartbeat (esp32_id, device_secret)
  values (v_id, v_secret)
  on conflict (esp32_id) do update set device_secret = excluded.device_secret;

  return
    'const char* ESP32_ID = "' || v_id || '";' || chr(10) ||
    'const char* DEVICE_SECRET = "' || v_secret || '";';
end;
$$;

-- Réservée à toi (via le SQL Editor / service_role) : jamais exposée à l'app ni au dashboard.
revoke all on function public.provision_esp32_device(text) from public;
grant execute on function public.provision_esp32_device(text) to service_role;
