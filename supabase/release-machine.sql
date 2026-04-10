-- RPC : libérer les machines liées à un ESP32
-- Exécuter dans Supabase → SQL Editor.
-- Utilisé en fallback par l'ESP32 quand report_machine_run_state ne trouve aucune ligne.

create or replace function public.release_machine(p_esp32_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_esp32_id is null or trim(p_esp32_id) = '' then
    return false;
  end if;

  update public.machines m
  set statut = 'disponible',
      estimated_end_time = null
  where lower(trim(coalesce(m.esp32_id, ''))) = lower(trim(p_esp32_id))
     or exists (
       select 1
       from public.emplacements e
       where e.id = m.emplacement_id
         and lower(trim(coalesce(e.esp32_id, ''))) = lower(trim(p_esp32_id))
     );

  return found;
end;
$$;

grant execute on function public.release_machine(text) to anon;
grant execute on function public.release_machine(text) to authenticated;
