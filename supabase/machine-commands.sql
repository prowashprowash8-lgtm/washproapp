-- WashPro : Table machine_commands (ESP32 poll + board « Lancer un cycle »)
-- Exécuter dans Supabase → SQL Editor
-- Pour corriger une base déjà déployée : voir machine-commands-rls-fix.sql

create table if not exists public.machine_commands (
  id uuid primary key default gen_random_uuid(),
  esp32_id text not null,
  command text not null default 'START',
  status text not null default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Après public.machines (voir emplacement-machines.sql)
alter table public.machine_commands
  add column if not exists machine_id uuid references public.machines (id) on delete set null;

alter table public.machine_commands enable row level security;

grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant select, insert, update on public.machine_commands to anon;
grant select, insert, update on public.machine_commands to authenticated;

drop policy if exists "Select machine_commands" on public.machine_commands;
drop policy if exists "Select_machine_commands" on public.machine_commands;
drop policy if exists "Insert_machine_commands_authenticated" on public.machine_commands;
drop policy if exists "Insert machine_commands" on public.machine_commands;
drop policy if exists "Update machine_commands" on public.machine_commands;
drop policy if exists "Update_machine_commands_anon" on public.machine_commands;

create policy "Select_machine_commands"
  on public.machine_commands for select
  using (status = 'pending' and command = 'START');

create policy "Insert_machine_commands_authenticated"
  on public.machine_commands for insert
  to authenticated
  with check (command = 'START' and status = 'pending');

create policy "Update_machine_commands_anon"
  on public.machine_commands for update
  to anon
  using (status = 'pending' and command = 'START')
  with check (status = 'done');
