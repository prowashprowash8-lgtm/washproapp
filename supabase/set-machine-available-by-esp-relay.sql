-- WashPro : libère automatiquement une machine via ESP32 + relay
-- Utilisé par le firmware en fallback STOP (optocoupleur).
-- Exécuter une fois dans Supabase -> SQL Editor.

create or replace function public.set_machine_available_by_esp_relay(
  p_esp32_id text,
  p_relay_id integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $q$
declare
  n int := 0;
begin
  if p_esp32_id is null or trim(p_esp32_id) = '' then
    return 0;
  end if;

  -- Match exact : esp32 + relay
  update public.machines m
  set statut = 'disponible', estimated_end_time = null
  from public.emplacements e
  where e.id = m.emplacement_id
    and (
      lower(trim(coalesce(e.esp32_id, ''))) = lower(trim(p_esp32_id))
      or lower(trim(coalesce(m.esp32_id, ''))) = lower(trim(p_esp32_id))
    )
    and (
      (p_relay_id is not null and m.relay_id = p_relay_id)
      or (p_relay_id is null and m.relay_id is null)
    );
  get diagnostics n = row_count;

  -- Secours : une seule machine occupée pour cet ESP
  if n = 0 then
    update public.machines m
    set statut = 'disponible', estimated_end_time = null
    where m.id in (
      select x.id
      from public.machines x
      left join public.emplacements e on e.id = x.emplacement_id
      where lower(coalesce(x.statut, '')) in ('occupe', 'occupied')
        and (
          lower(trim(coalesce(e.esp32_id, ''))) = lower(trim(p_esp32_id))
          or lower(trim(coalesce(x.esp32_id, ''))) = lower(trim(p_esp32_id))
        )
      limit 1
    );
    get diagnostics n = row_count;
  end if;

  return n;
end;
$q$;

revoke all on function public.set_machine_available_by_esp_relay(text, integer) from public;
grant execute on function public.set_machine_available_by_esp_relay(text, integer) to anon;
grant execute on function public.set_machine_available_by_esp_relay(text, integer) to authenticated;

