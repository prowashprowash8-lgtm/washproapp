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

drop policy if exists "Select machine_commands" on public.machine_commands;
drop policy if exists "Select_machine_commands" on public.machine_commands;
drop policy if exists "Insert_machine_commands_authenticated" on public.machine_commands;
drop policy if exists "Insert machine_commands" on public.machine_commands;
drop policy if exists "Update machine_commands" on public.machine_commands;
drop policy if exists "Update_machine_commands_anon" on public.machine_commands;

-- Lecture : lignes pending + START (ESP anon + board)
create policy "Select_machine_commands"
  on public.machine_commands for select
  using (status = 'pending' and command = 'START');

-- Board connecté : insérer une commande de test (START / pending)
create policy "Insert_machine_commands_authenticated"
  on public.machine_commands for insert
  to authenticated
  with check (command = 'START' and status = 'pending');

-- ESP32 (anon) : marquer done après impulsion relais
create policy "Update_machine_commands_anon"
  on public.machine_commands for update
  to anon
  using (status = 'pending' and command = 'START')
  with check (status = 'done');
