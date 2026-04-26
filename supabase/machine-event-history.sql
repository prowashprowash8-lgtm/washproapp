-- WashPro - Historique événements machine (board only)
-- Objectif: tracer start/ack/changements d'état pour aider les remboursements.
-- Safe: basé sur triggers, sans modifier les RPC critiques existantes.

create table if not exists public.machine_event_history (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete set null,
  machine_id uuid references public.machines(id) on delete set null,
  machine_command_id uuid references public.machine_commands(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  esp32_id text,
  event_type text not null,
  source text not null default 'system',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_machine_event_history_created_at
  on public.machine_event_history(created_at desc);
create index if not exists idx_machine_event_history_transaction
  on public.machine_event_history(transaction_id, created_at desc);
create index if not exists idx_machine_event_history_machine
  on public.machine_event_history(machine_id, created_at desc);

alter table public.machine_event_history enable row level security;

drop policy if exists "machine_event_history_patron_read" on public.machine_event_history;
drop policy if exists "machine_event_history_board_read" on public.machine_event_history;
create policy "machine_event_history_board_read"
  on public.machine_event_history for select
  to authenticated
  using (
    exists (
      select 1
      from public.board_account_roles bar
      where bar.user_id = auth.uid()
    )
  );

-- Trigger 1: commande START créée/acquittée
create or replace function public.log_machine_command_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.machine_event_history (
      transaction_id, machine_id, machine_command_id, user_id, esp32_id, event_type, source, payload
    ) values (
      new.transaction_id, new.machine_id, new.id, new.user_id, new.esp32_id,
      'command_created', 'machine_commands',
      jsonb_build_object('status', new.status, 'command', new.command)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status, '') <> coalesce(new.status, '') then
    insert into public.machine_event_history (
      transaction_id, machine_id, machine_command_id, user_id, esp32_id, event_type, source, payload
    ) values (
      new.transaction_id, new.machine_id, new.id, new.user_id, new.esp32_id,
      case when new.status = 'done' then 'command_ack' else 'command_status_changed' end,
      'machine_commands',
      jsonb_build_object('old_status', old.status, 'new_status', new.status, 'command', new.command)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_machine_command_event on public.machine_commands;
create trigger trg_log_machine_command_event
after insert or update of status on public.machine_commands
for each row execute function public.log_machine_command_event();

-- Trigger 2: changement de statut machine (occupe/disponible)
create or replace function public.log_machine_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.statut, '') <> coalesce(new.statut, '') then
    insert into public.machine_event_history (
      transaction_id, machine_id, esp32_id, event_type, source, payload
    ) values (
      (
        select t.id
        from public.transactions t
        where t.machine_id = new.id
        order by t.created_at desc
        limit 1
      ),
      new.id, new.esp32_id,
      'machine_status_changed', 'machines',
      jsonb_build_object('old_status', old.statut, 'new_status', new.statut)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_machine_status_event on public.machines;
create trigger trg_log_machine_status_event
after update of statut on public.machines
for each row execute function public.log_machine_status_event();

