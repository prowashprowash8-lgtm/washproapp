-- Fix: infinite recursion sur board_account_roles
-- Cause: policy qui interroge board_account_roles depuis board_account_roles.
-- Ce script remplace les policies récursives par des versions non récursives.

begin;

alter table if exists public.board_account_roles enable row level security;
alter table if exists public.board_account_emplacements enable row level security;

-- -------------------------------
-- board_account_roles (NON récursif)
-- -------------------------------
drop policy if exists "board_roles_patron_manage" on public.board_account_roles;
drop policy if exists "board_roles_self_or_patron_read" on public.board_account_roles;
drop policy if exists "board_roles_self_manage" on public.board_account_roles;
drop policy if exists "board_roles_self_read" on public.board_account_roles;

-- Un utilisateur board lit uniquement sa propre ligne de rôle
create policy "board_roles_self_read"
  on public.board_account_roles for select
  to authenticated
  using (auth.uid() = user_id);

-- Pas d'insert/update/delete client direct sur cette table (gestion admin/service uniquement)
-- => on ne crée pas de policy write.

-- -------------------------------
-- board_account_emplacements
-- -------------------------------
drop policy if exists "board_emplacements_patron_manage" on public.board_account_emplacements;
drop policy if exists "board_emplacements_self_or_patron_read" on public.board_account_emplacements;
drop policy if exists "board_emplacements_self_read" on public.board_account_emplacements;
drop policy if exists "board_emplacements_self_manage" on public.board_account_emplacements;

-- Lecture de ses propres rattachements
create policy "board_emplacements_self_read"
  on public.board_account_emplacements for select
  to authenticated
  using (auth.uid() = user_id);

-- Gestion de ses propres rattachements (si ton app board en a besoin)
create policy "board_emplacements_self_manage"
  on public.board_account_emplacements for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;

