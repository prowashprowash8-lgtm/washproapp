-- WashPro - Security audit (read-only)
-- A exécuter dans Supabase SQL Editor. Ne modifie rien.

-- 1) Tables publiques avec RLS OFF
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by c.relname;

-- 2) Policies potentiellement trop larges
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    cmd = 'ALL'
    or coalesce(qual, '') ilike '%true%'
    or coalesce(with_check, '') ilike '%true%'
  )
order by tablename, policyname;

-- 3) Grants table pour anon/authenticated (vision globale)
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 4) Fonctions SECURITY DEFINER en public
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;

-- 5) Qui peut exécuter les fonctions (anon/authenticated)
select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and grantee in ('anon','authenticated')
order by routine_name, grantee;

