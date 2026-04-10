-- WashPro : libérer les machines dont estimated_end_time est dépassé
--
-- L’éditeur SQL du dashboard Supabase gère mal les guillemets dollar ($$ / $fn$).
-- Ici : corps de fonction en chaîne entre apostrophes (chaque ' interne est doublé '').
--
-- Si ça bloque encore : exécutez chaque instruction séparément (ALTER, DROP, CREATE, GRANT).

alter table public.machines add column if not exists estimated_end_time timestamptz;

drop function if exists public.release_expired_machines() cascade;

create or replace function public.release_expired_machines()
returns void
language sql
security definer
set search_path = public
as 'UPDATE public.machines SET statut = ''disponible'', estimated_end_time = NULL WHERE lower(statut) IN (''occupe'', ''occupied'') AND estimated_end_time IS NOT NULL AND estimated_end_time <= now();';

revoke all on function public.release_expired_machines() from public;
grant execute on function public.release_expired_machines() to service_role;
