-- Durcissement (Advisor Supabase) : fixe search_path sur les 12 fonctions qui ne l'avaient
-- pas (bonne pratique, pas une faille active exploitée ici puisque toutes qualifient déjà
-- leurs tables avec "public." explicitement).

create or replace function public.board_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.esp32_heartbeat_set_last_seen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.last_seen := now();
  return new;
end;
$$;

create or replace function public.update_residence_messages_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.end_machine_occupancy(p_occupancy_id uuid, p_user_id uuid)
returns table(success boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.machine_occupancy
    where id = p_occupancy_id
      and user_id = p_user_id
      and status in ('active', 'overdue')
  ) then
    return query select false, 'Occupation non trouvée ou accès non autorisé';
    return;
  end if;

  update public.machine_occupancy
  set status = 'completed',
      actual_end_time = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  where id = p_occupancy_id;

  return query select true, null::text;
end;
$$;

create or replace function public.get_active_machines(p_emplacement_id uuid)
returns table(occupancy_id uuid, machine_id uuid, machine_name text, user_id uuid, user_first_name text, user_email text, start_time timestamp with time zone, expected_end_time timestamp with time zone, elapsed_minutes integer, is_overdue boolean, overdue_minutes integer)
language plpgsql
security definer
set search_path = public
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

create or replace function public.get_overdue_machines(p_emplacement_id uuid)
returns table(occupancy_id uuid, machine_id uuid, machine_name text, user_id uuid, user_first_name text, user_email text, start_time timestamp with time zone, expected_end_time timestamp with time zone, overdue_minutes integer)
language plpgsql
security definer
set search_path = public
as $$
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
    extract(epoch from (timezone('utc'::text, now()) - mo.expected_end_time))/60 as overdue_minutes
  from public.machine_occupancy mo
  join public.machines m on m.id = mo.machine_id
  join public.profiles p on p.id = mo.user_id
  where mo.emplacement_id = p_emplacement_id
    and mo.status = 'overdue'
    and mo.expected_end_time < timezone('utc'::text, now())
  order by overdue_minutes desc;
end;
$$;

create or replace function public.mark_overdue_occupancies()
returns table(marked_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.machine_occupancy
  set status = 'overdue',
      updated_at = timezone('utc'::text, now())
  where status = 'active'
    and expected_end_time < timezone('utc'::text, now()) - interval '10 minutes';

  v_count := found;

  return query select v_count;
end;
$$;

create or replace function public.notify_mission_posted(p_mission_id uuid, p_emplacement_ids uuid[], p_titre text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ids uuid[];
begin
  select array_agg(distinct user_id) into v_user_ids
  from public.transactions
  where emplacement_id = any(p_emplacement_ids)
    and user_id is not null;

  return jsonb_build_object(
    'mission_id', p_mission_id,
    'titre', p_titre,
    'user_ids', coalesce(v_user_ids, array[]::uuid[])
  );
end;
$$;

create or replace function public.send_occupancy_reminder(p_occupancy_id uuid, p_sender_user_id uuid)
returns table(success boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_machine_name text;
begin
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

  if v_owner_user_id = p_sender_user_id then
    return query select false, 'Vous ne pouvez pas vous envoyer un rappel';
    return;
  end if;

  update public.machine_occupancy
  set reminder_sent_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  where id = p_occupancy_id;

  return query select true, null::text;
end;
$$;

create or replace function public.start_machine_occupancy(p_machine_id uuid, p_user_id uuid, p_transaction_id uuid, p_emplacement_id uuid, p_duration_minutes integer)
returns table(success boolean, occupancy_id uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occupancy_id uuid;
  v_existing_active uuid;
begin
  select id into v_existing_active
  from public.machine_occupancy
  where machine_id = p_machine_id
    and status in ('active', 'overdue')
  limit 1;

  if v_existing_active is not null then
    return query select false, null, 'Machine déjà occupée';
    return;
  end if;

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

-- Durcissement (Advisor Supabase) : buckets publics (mission-photos, laveries-photos)
-- n'ont pas besoin de policy SELECT large sur storage.objects pour que la lecture d'un
-- fichier connu fonctionne (getPublicUrl() contourne RLS pour un bucket public) — ces
-- policies ne servaient qu'à permettre de LISTER tous les fichiers.
-- mission-photos : aucun .list()/.download() nulle part dans le code (vérifié), retire
-- toute lecture directe (anon + authenticated).
drop policy if exists "mission-photos read" on storage.objects;
drop policy if exists "mission-photos read authenticated" on storage.objects;
-- laveries-photos : CrmLaverieDetail.tsx (board) utilise .list(laverieId) en authenticated
-- -> on garde cette policy. anon n'en a pas besoin, et "read public" est redondante et
-- trop large (accordée au pseudo-rôle public = tout le monde).
drop policy if exists "laveries-photos select anon" on storage.objects;
drop policy if exists "laveries photos read public" on storage.objects;
