-- WashPro : RLS machine_commands — ESP32 (anon) + Board web (authenticated)
-- À exécuter dans Supabase → SQL Editor (une fois, ou après changement de policies).
--
-- Corrige :
--   - PATCH done refusé pour l'ESP (clé anon)
--   - INSERT refusé sur le board « Lancer un cycle » : "new row violates row-level security policy"

grant usage on schema public to anon;
grant usage on schema public to authenticated;

-- Colonne optionnelle utilisée par washprobox-board (MachineDetail.tsx)
alter table public.machine_commands
  add column if not exists machine_id uuid references public.machines (id) on delete set null;

grant select, insert, update on public.machine_commands to anon;
grant select, insert, update on public.machine_commands to authenticated;

-- ─── Policies : tout recréer proprement ─────────────────────────────────────
--
-- HAUTE #7 de l'audit (corrigé le 2026-07-02) : deux policies "Insert_machine_commands_anon"
-- et "Update_machine_commands_anon" totalement ouvertes (with check true) avaient été créées
-- directement en base à un moment donné — absentes de ce fichier, donc invisibles ici tant
-- qu'on ne comparait pas avec l'état réel de la base. N'importe qui avec la clé anon pouvait
-- insérer une fausse commande START, ou marquer "done" la commande payée d'un autre client
-- avant que son ESP32 ne la traite. L'ESP32 ne fait plus aucun accès direct à cette table
-- (uniquement via claim_pending_start_command, SECURITY DEFINER, non soumis à RLS) — il n'a
-- donc besoin d'aucune policy anon en écriture.

drop policy if exists "Select machine_commands" on public.machine_commands;
drop policy if exists "Select_machine_commands" on public.machine_commands;
drop policy if exists "Insert_machine_commands_authenticated" on public.machine_commands;
drop policy if exists "Insert machine_commands" on public.machine_commands;
drop policy if exists "Insert_machine_commands_anon" on public.machine_commands;
drop policy if exists "Update machine_commands" on public.machine_commands;
drop policy if exists "Update_machine_commands_anon" on public.machine_commands;

-- Lecture : lignes pending + START (board ; l'app mobile ne lit pas cette table directement)
create policy "Select_machine_commands"
  on public.machine_commands for select
  using (status = 'pending' and command = 'START');

-- Board connecté (authenticated) : insérer une commande manuelle (MachineDetail.tsx,
-- "lancer un cycle"), uniquement liée à une vraie transaction déjà créée.
create policy "Insert_machine_commands_authenticated"
  on public.machine_commands for insert
  to authenticated
  with check (command = 'START' and status = 'pending' and transaction_id is not null);

-- Pas de policy UPDATE pour anon ni authenticated : la seule voie pour marquer une commande
-- "done" est claim_pending_start_command (SECURITY DEFINER, vérifie le device_secret ESP32).
