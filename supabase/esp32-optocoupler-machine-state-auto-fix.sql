-- WashPro : correctif auto libération machine via optocoupleur (robuste)
-- Objectif : quand l'ESP envoie p_running = false, remettre automatiquement en "disponible"
-- même si relay_id est mal renseigné ou si le mapping est partiel.
-- Exécuter dans Supabase -> SQL Editor (production).

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
  if p_esp32_id is null or trim(p_esp32_id) = '' then
    return 0;
  end if;

  -- Le statut "occupe" est posé par le paiement/commande start.
  -- Ici on ne traite que le retour optocoupleur "arrêt".
  if coalesce(p_running, false) then
    return 0;
  end if;

  -- 1) Match précis : esp32 + relay
  update public.machines m
  set statut = 'disponible', estimated_end_time = null
  from public.emplacements e
  where e.id = m.emplacement_id
    and (
      lower(trim(coalesce(e.esp32_id, ''))) = lower(trim(p_esp32_id))
      or lower(trim(coalesce(m.esp32_id, ''))) = lower(trim(p_esp32_id))
    )
    and (p_relay_id is not null and m.relay_id = p_relay_id)
    and lower(coalesce(m.statut, '')) in ('occupe', 'occupied');
  get diagnostics n = row_count;

  -- 2) Si aucun match relay : s'il n'y a qu'UNE machine occupée liée à cet ESP, on la libère.
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
      order by x.id desc
      limit 1
    );
    get diagnostics n = row_count;
  end if;

  -- 3) Dernier secours : si une seule machine existe pour cet ESP (même non occupée), la repasser dispo.
  if n = 0 then
    update public.machines m
    set statut = 'disponible', estimated_end_time = null
    where m.id in (
      select x.id
      from public.machines x
      left join public.emplacements e on e.id = x.emplacement_id
      where
        lower(trim(coalesce(e.esp32_id, ''))) = lower(trim(p_esp32_id))
        or lower(trim(coalesce(x.esp32_id, ''))) = lower(trim(p_esp32_id))
      limit 1
    );
    get diagnostics n = row_count;
  end if;

  return n;
end;
$q$;

grant execute on function public.report_machine_run_state(text, integer, boolean) to anon;
grant execute on function public.report_machine_run_state(text, integer, boolean) to authenticated;

