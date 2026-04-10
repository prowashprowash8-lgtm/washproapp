-- WashPro : optocoupleur → p_running false = machines en « disponible »
-- Retourne le NOMBRE de lignes mises à jour (0 = rien ne correspond : vérifie esp32_id / relay_id).
-- Ré-exécuter tout le script dans Supabase → SQL Editor.

alter table public.machines add column if not exists esp32_id text;
alter table public.machines add column if not exists relay_id integer;
alter table public.machines add column if not exists estimated_end_time timestamptz;
alter table public.emplacements add column if not exists esp32_id text;

revoke update on table public.machines from anon;

drop function if exists public.report_machine_run_state(text, integer, boolean) cascade;

create or replace function public.report_machine_run_state(
  p_esp32_id text,
  p_relay_id integer,
  p_running boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $q$
declare
  n int := 0;
begin
  if p_esp32_id is null or trim(p_esp32_id) = '' or p_relay_id is null then
    return 0;
  end if;

  if p_running then
    return 0;
  end if;

  -- 1) Cas général : esp32 sur emplacement ou sur la machine + (1 seule machine OU relay_id cohérent)
  update public.machines m
  set statut = 'disponible', estimated_end_time = null
  from public.emplacements e
  where e.id = m.emplacement_id
    and (
      lower(trim(coalesce(e.esp32_id, ''))) = lower(trim(p_esp32_id))
      or lower(trim(coalesce(m.esp32_id, ''))) = lower(trim(p_esp32_id))
    )
    and (
      (select count(*)::int from public.machines mx where mx.emplacement_id = e.id) = 1
      or m.relay_id = p_relay_id
      or (m.relay_id is null and p_relay_id = 1)
    );

  get diagnostics n = row_count;

  -- 2) Secours : une seule machine pour cet emplacement (relay mal renseigné)
  if n = 0 then
    update public.machines m
    set statut = 'disponible', estimated_end_time = null
    from public.emplacements e
    where e.id = m.emplacement_id
      and lower(trim(coalesce(e.esp32_id, ''))) = lower(trim(p_esp32_id))
      and (select count(*)::int from public.machines mx where mx.emplacement_id = e.id) = 1;
    get diagnostics n = row_count;
  end if;

  -- 3) Secours : esp32_id uniquement sur la ligne machine (emplacement vide)
  if n = 0 then
    update public.machines m
    set statut = 'disponible', estimated_end_time = null
    where lower(trim(coalesce(m.esp32_id, ''))) = lower(trim(p_esp32_id))
      and m.relay_id = p_relay_id;
    get diagnostics n = row_count;
  end if;

  -- 4) Fallback prudent :
  -- si aucun match sur le relais, mais qu'il n'y a qu'UNE machine "occupe"
  -- rattachée à cet ESP32, on la remet disponible.
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
    )
    and (
      select count(*)
      from public.machines x
      left join public.emplacements e on e.id = x.emplacement_id
      where lower(coalesce(x.statut, '')) in ('occupe', 'occupied')
        and (
          lower(trim(coalesce(e.esp32_id, ''))) = lower(trim(p_esp32_id))
          or lower(trim(coalesce(x.esp32_id, ''))) = lower(trim(p_esp32_id))
        )
    ) = 1;
    get diagnostics n = row_count;
  end if;

  return n;
end;
$q$;

grant execute on function public.report_machine_run_state(text, integer, boolean) to anon;
grant execute on function public.report_machine_run_state(text, integer, boolean) to authenticated;
