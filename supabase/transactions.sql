-- WashPro : Suivi des transactions par utilisateur
-- Exécuter dans Supabase → SQL Editor
-- Permet de voir l'activité de chaque utilisateur et de rembourser en cas d'erreur machine

-- 1. Table transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  emplacement_id uuid not null references public.emplacements(id) on delete cascade,
  amount decimal(10,2) default 0,
  payment_method text not null default 'promo',
  promo_code text,
  machine_command_id uuid,
  status text not null default 'completed',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  refunded_at timestamp with time zone,
  refund_reason text
);

create index if not exists idx_transactions_user on transactions(user_id);
create index if not exists idx_transactions_created on transactions(created_at desc);
create index if not exists idx_transactions_emplacement on transactions(emplacement_id);

-- 2. Ajouter user_id et transaction_id à machine_commands
alter table public.machine_commands add column if not exists user_id uuid references public.profiles(id);
alter table public.machine_commands add column if not exists transaction_id uuid references public.transactions(id);

-- 3. RLS : pas d’insert client anonyme ; board (authenticated) + RPC (SECURITY DEFINER)
alter table public.transactions enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.transactions to authenticated;

drop policy if exists "Allow all for service" on public.transactions;
drop policy if exists "Allow insert for anon" on public.transactions;
drop policy if exists "Allow select for anon" on public.transactions;
drop policy if exists "Allow update for anon" on public.transactions;
drop policy if exists "No direct access" on public.transactions;
drop policy if exists "transactions_authenticated_select" on public.transactions;
drop policy if exists "transactions_authenticated_insert" on public.transactions;
drop policy if exists "transactions_authenticated_update" on public.transactions;

create policy "transactions_authenticated_select"
  on public.transactions for select
  to authenticated
  using (true);

create policy "transactions_authenticated_insert"
  on public.transactions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "transactions_authenticated_update"
  on public.transactions for update
  to authenticated
  using (true)
  with check (true);

-- 4. RPC : créer une transaction + envoyer la commande machine (tout en un)
-- Migration #2 de l'audit (2026-07-06) : identité tirée de auth.uid(). Anciennes versions
-- (7, 8 arguments) supprimées.
drop function if exists public.create_transaction_and_start_machine(uuid, uuid, uuid, text, decimal, text, text);
drop function if exists public.create_transaction_and_start_machine(uuid, uuid, uuid, uuid, text, decimal, text, text);

create or replace function public.create_transaction_and_start_machine(
  p_machine_id uuid,
  p_emplacement_id uuid,
  p_esp32_id text,
  p_amount decimal default 0,
  p_payment_method text default 'promo',
  p_promo_code text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_transaction_id uuid;
  v_command_id uuid;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if not exists (
    select 1
    from public.machines m
    where m.id = p_machine_id
      and m.emplacement_id = p_emplacement_id
  ) then
    raise exception 'invalid_machine_or_emplacement';
  end if;

  if exists (
    select 1
    from public.machines m
    where m.id = p_machine_id
      and coalesce(m.hors_service, false) = true
  ) then
    raise exception 'machine_out_of_service';
  end if;

  -- Créer la transaction
  insert into transactions (user_id, machine_id, emplacement_id, amount, payment_method, promo_code, status)
  values (v_uid, p_machine_id, p_emplacement_id, p_amount, p_payment_method, p_promo_code, 'completed')
  returning id into v_transaction_id;

  -- Créer la commande machine (ESP32)
  insert into machine_commands (esp32_id, command, status, user_id, transaction_id)
  values (p_esp32_id, 'START', 'pending', v_uid, v_transaction_id)
  returning id into v_command_id;

  -- Lier la transaction à la commande
  update transactions set machine_command_id = v_command_id where id = v_transaction_id;

  -- Marquer immédiatement la machine occupée (indépendant du minuteur app)
  update public.machines
  set statut = 'occupe',
      estimated_end_time = null
  where id = p_machine_id;

  return json_build_object(
    'transaction_id', v_transaction_id,
    'machine_command_id', v_command_id
  );
end;
$$;

revoke all on function public.create_transaction_and_start_machine(uuid, uuid, text, decimal, text, text) from public;
grant execute on function public.create_transaction_and_start_machine(uuid, uuid, text, decimal, text, text) to authenticated;

-- 5. RPC : rembourser une transaction (depuis le dashboard Supabase ou une future interface admin)
create or replace function public.refund_transaction(
  p_transaction_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update transactions
  set status = 'refunded',
      refunded_at = now(),
      refund_reason = p_reason
  where id = p_transaction_id and status = 'completed';

  return found;
end;
$$;

revoke all on function public.refund_transaction(uuid, text) from public;
grant execute on function public.refund_transaction(uuid, text) to service_role;

-- 6. RPC get_user_transactions : NE PAS REJOUER une version à 1 argument (p_user_id) ici
-- sans vérification — c'était CRITIQUE #6 de l'audit (accessible à anon). Deux versions
-- légitimes existent désormais, définies ailleurs :
--   - get_user_transactions() sans argument, identité via auth.uid() (app mobile, ses
--     propres transactions) — dans refund-request-response-and-promo.sql.
--   - get_user_transactions(p_user_id uuid), réservée aux comptes board patron (fiche
--     client) — dans get-user-lookups-board.sql.
