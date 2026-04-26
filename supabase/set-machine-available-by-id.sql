-- Libère une machine (statut disponible) par id — utilisé par l’app si l’optocoupleur n’a pas encore mis à jour la base.
-- Exécuter une fois dans Supabase → SQL Editor.

create or replace function public.set_machine_available_by_id(p_machine_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $q$
begin
  if p_machine_id is null then
    return false;
  end if;

  update public.machines
  set statut = 'disponible', estimated_end_time = null
  where id = p_machine_id;
  return found;
end;
$q$;

revoke all on function public.set_machine_available_by_id(uuid) from public;
grant execute on function public.set_machine_available_by_id(uuid) to anon;
grant execute on function public.set_machine_available_by_id(uuid) to authenticated;
