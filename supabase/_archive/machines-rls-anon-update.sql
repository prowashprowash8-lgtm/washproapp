-- WashPro : hardening
-- Ne pas autoriser de PATCH direct de public.machines avec la clé anon.
-- Le passage à "disponible" doit se faire via RPC SECURITY DEFINER.

revoke update on table public.machines from anon;

alter table public.machines enable row level security;

drop policy if exists "anon patch machine disponible" on public.machines;
