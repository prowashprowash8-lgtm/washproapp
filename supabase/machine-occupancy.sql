-- WashPro - Machine Occupancy Tracking
-- Table pour suivre l'occupation des machines et gérer les rappels

-- Supprimer l'ancienne table si elle existe
drop table if exists public.machine_occupancy cascade;

-- Table machine_occupancy
create table public.machine_occupancy (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  emplacement_id uuid not null references public.emplacements(id) on delete cascade,
  
  -- Chronologie
  start_time timestamp with time zone default timezone('utc'::text, now()) not null,
  expected_end_time timestamp with time zone not null,
  actual_end_time timestamp with time zone,
  
  -- États
  status text not null default 'active' check (status in ('active', 'completed', 'overdue', 'cancelled')),
  
  -- Notifications
  reminder_sent_at timestamp with time zone,
  final_sent_at timestamp with time zone,
  
  -- Métadonnées
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 180),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index pour les performances
create index if not exists idx_machine_occupancy_machine on machine_occupancy(machine_id);
create index if not exists idx_machine_occupancy_user on machine_occupancy(user_id);
create index if not exists idx_machine_occupancy_status on machine_occupancy(status);
create index if not exists idx_machine_occupancy_emplacement on machine_occupancy(emplacement_id);
create index if not exists idx_machine_occupancy_expected_end on machine_occupancy(expected_end_time);

-- Fonction pour updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Trigger pour updated_at
create trigger handle_machine_occupancy_updated_at
  before update on public.machine_occupancy
  for each row
  execute procedure public.handle_updated_at();

-- RLS (Row Level Security)
alter table public.machine_occupancy enable row level security;

-- Politiques RLS
-- 1. Tout le monde peut voir les occupations actives/overdue (pour le rappel)
create policy "machine_occupancy_select_active_overdue"
  on public.machine_occupancy for select
  to authenticated
  using (status in ('active', 'overdue'));

-- 2. Seul le propriétaire peut voir toutes ses occupations
create policy "machine_occupancy_select_owner"
  on public.machine_occupancy for select
  to authenticated
  using (user_id = auth.uid());

-- 3. Insert via RPC uniquement (SECURITY DEFINER)
create policy "machine_occupancy_no_direct_insert"
  on public.machine_occupancy for insert
  to authenticated
  with check (false);

-- 4. Update via RPC uniquement (SECURITY DEFINER)
create policy "machine_occupancy_no_direct_update"
  on public.machine_occupancy for update
  to authenticated
  using (false);

-- 5. Delete via RPC uniquement (SECURITY DEFINER)
create policy "machine_occupancy_no_direct_delete"
  on public.machine_occupancy for delete
  to authenticated
  using (false);

-- Fonctions RPC (SECURITY DEFINER)

-- Démarrer une occupation
create or replace function public.start_machine_occupancy(
  p_machine_id uuid,
  p_user_id uuid,
  p_transaction_id uuid,
  p_emplacement_id uuid,
  p_duration_minutes integer
)
returns table (
  success boolean,
  occupancy_id uuid,
  error text
)
language plpgsql
security definer
as $$
declare
  v_occupancy_id uuid;
  v_existing_active uuid;
begin
  -- Vérifier qu'il n'y a pas déjà une occupation active sur cette machine
  select id into v_existing_active
  from public.machine_occupancy
  where machine_id = p_machine_id
    and status in ('active', 'overdue')
  limit 1;
  
  if v_existing_active is not null then
    return query select false, null, 'Machine déjà occupée';
    return;
  end if;
  
  -- Créer l'occupation
  insert into public.machine_occupancy (
    machine_id, user_id, transaction_id, emplacement_id,
    expected_end_time, duration_minutes, status
  )
  values (
    p_machine_id, p_user_id, p_transaction_id, p_emplacement_id,
    timezone('utc'::text, now()) + (p_duration_minutes || ' minutes')::interval,
    p_duration_minutes, 'active'
  )
  returning id into v_occupancy_id;
  
  return query select true, v_occupancy_id, null::text;
end;
$$;

-- Terminer une occupation
create or replace function public.end_machine_occupancy(
  p_occupancy_id uuid,
  p_user_id uuid
)
returns table (
  success boolean,
  error text
)
language plpgsql
security definer
as $$
begin
  -- Vérifier que l'utilisateur est bien le propriétaire
  if not exists (
    select 1 from public.machine_occupancy
    where id = p_occupancy_id
      and user_id = p_user_id
      and status in ('active', 'overdue')
  ) then
    return query select false, 'Occupation non trouvée ou accès non autorisé';
    return;
  end if;
  
  -- Mettre à jour l'occupation
  update public.machine_occupancy
  set status = 'completed',
      actual_end_time = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  where id = p_occupancy_id;
  
  return query select true, null::text;
end;
$$;

-- Obtenir les machines actives (occupées) pour un emplacement
create or replace function public.get_active_machines(
  p_emplacement_id uuid
)
returns table (
  occupancy_id uuid,
  machine_id uuid,
  machine_name text,
  user_id uuid,
  user_first_name text,
  user_email text,
  start_time timestamp with time zone,
  expected_end_time timestamp with time zone,
  elapsed_minutes integer,
  is_overdue boolean,
  overdue_minutes integer
)
language plpgsql
security definer
as $$
declare
  v_now timestamp with time zone := timezone('utc'::text, now());
begin
  return query
  select 
    mo.id,
    mo.machine_id,
    m.name,
    mo.user_id,
    p.first_name,
    p.email,
    mo.start_time,
    mo.expected_end_time,
    extract(epoch from (v_now - mo.start_time))/60 as elapsed_minutes,
    (v_now > mo.expected_end_time + interval '10 minutes') as is_overdue,
    case 
      when v_now > mo.expected_end_time + interval '10 minutes' 
      then extract(epoch from (v_now - mo.expected_end_time - interval '10 minutes'))/60
      else 0 
    end as overdue_minutes
  from public.machine_occupancy mo
  join public.machines m on m.id = mo.machine_id
  join public.profiles p on p.id = mo.user_id
  where mo.emplacement_id = p_emplacement_id
    and mo.status = 'active'
  order by elapsed_minutes desc;
end;
$$;

-- Envoyer une notification de rappel
create or replace function public.send_occupancy_reminder(
  p_occupancy_id uuid,
  p_sender_user_id uuid
)
returns table (
  success boolean,
  error text
)
language plpgsql
security definer
as $$
declare
  v_owner_user_id uuid;
  v_machine_name text;
begin
  -- Récupérer les infos de l'occupation
  select 
    mo.user_id,
    m.name
  into v_owner_user_id, v_machine_name
  from public.machine_occupancy mo
  join public.machines m on m.id = mo.machine_id
  where mo.id = p_occupancy_id
    and mo.status = 'active';
  
  if v_owner_user_id is null then
    return query select false, 'Occupation non trouvée';
    return;
  end if;
  
  -- Empêcher l'auto-notification
  if v_owner_user_id = p_sender_user_id then
    return query select false, 'Vous ne pouvez pas vous envoyer un rappel';
    return;
  end if;
  
  -- Marquer que la notification a été envoyée
  update public.machine_occupancy
  set reminder_sent_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  where id = p_occupancy_id;
  
  -- TODO: Appeler le service de notification push ici
  -- Pour l'instant, on considère que c'est un succès
  
  return query select true, null::text;
end;
$$;

comment on table public.machine_occupancy is 'Suivi des occupations de machines pour gérer les rappels de retrait de linge';
comment on column public.machine_occupancy.status is 'active: en cours, completed: terminée, overdue: en retard, cancelled: annulée';
comment on column public.machine_occupancy.expected_end_time is 'Heure de fin prévue basée sur la durée choisie par l''utilisateur';
