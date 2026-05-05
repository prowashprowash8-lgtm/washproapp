-- =====================================================================
-- Pickup reminders : permet à n'importe quel utilisateur de l'app de
-- prévenir le propriétaire du linge d'une machine occupée pour qu'il
-- vienne le récupérer.
--
-- Comportement :
--   - On cible l'utilisateur de la dernière transaction sur la machine
--     (dans une fenêtre de 6h pour éviter de notifier un ancien utilisateur).
--   - L'utilisateur ne peut pas se notifier lui-même.
--   - Cooldown : un seul rappel toutes les 5 minutes par machine.
--   - Toute tentative est tracée dans la table `pickup_reminders`.
--
-- L'envoi push réel est délégué à l'Edge Function `pickup-reminder`
-- (voir supabase/functions/pickup-reminder).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Table d'audit / cooldown
-- ---------------------------------------------------------------------
create table if not exists public.pickup_reminders (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  sender_user_id uuid references public.profiles(id) on delete set null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pickup_reminders_machine_idx
  on public.pickup_reminders (machine_id, created_at desc);

create index if not exists pickup_reminders_recipient_idx
  on public.pickup_reminders (recipient_user_id, created_at desc);

alter table public.pickup_reminders enable row level security;

-- Lecture : on permet aux utilisateurs authentifiés de relire l'historique
-- les concernant (utile pour debug / futur écran "qui m'a notifié").
drop policy if exists "pickup_reminders_select_self" on public.pickup_reminders;
create policy "pickup_reminders_select_self"
  on public.pickup_reminders for select
  to authenticated
  using (
    sender_user_id = auth.uid()
    or recipient_user_id = auth.uid()
  );

-- Pas d'INSERT direct depuis l'app : tout passe par la RPC SECURITY DEFINER.
revoke insert, update, delete on public.pickup_reminders from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) RPC : demander un rappel pour la dernière transaction d'une machine
-- ---------------------------------------------------------------------
-- Retourne :
--   ok                 : true si le rappel est autorisé et enregistré
--   reason             : code d'erreur si ok = false
--   recipient_user_id  : utilisateur cible (pour la fonction edge)
--   recipient_name     : prénom/nom à afficher dans la notif
--   machine_label      : nom machine pour le corps de la notif
--   emplacement_label  : nom emplacement pour le corps de la notif
--   reminder_id        : id de la ligne pickup_reminders insérée
--   expo_push_tokens   : tokens push Expo du destinataire
-- ---------------------------------------------------------------------
create or replace function public.request_pickup_reminder(
  p_machine_id uuid,
  p_sender_user_id uuid
)
returns table (
  ok boolean,
  reason text,
  recipient_user_id uuid,
  recipient_name text,
  machine_label text,
  emplacement_label text,
  reminder_id uuid,
  expo_push_tokens text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_machine record;
  v_emplacement_name text;
  v_last_tx record;
  v_recipient record;
  v_recent_count int;
  v_reminder_id uuid;
  v_tokens text[];
begin
  -- Sender obligatoire
  if p_sender_user_id is null then
    return query select false, 'no_sender'::text, null::uuid, null::text, null::text, null::text, null::uuid, null::text[];
    return;
  end if;

  -- Machine
  select id, esp32_id, statut, emplacement_id,
         name as label
  into v_machine
  from public.machines
  where id = p_machine_id;

  if not found then
    return query select false, 'machine_not_found'::text, null::uuid, null::text, null::text, null::text, null::uuid, null::text[];
    return;
  end if;

  -- Emplacement (label)
  select coalesce(name, nom) into v_emplacement_name
  from public.emplacements
  where id = v_machine.emplacement_id;

  -- Dernière transaction sur cette machine, dans une fenêtre raisonnable
  -- (6 heures) pour éviter de spammer un ancien utilisateur.
  select id, user_id, created_at
  into v_last_tx
  from public.transactions
  where machine_id = v_machine.id
    and created_at > now() - interval '6 hours'
  order by created_at desc
  limit 1;

  if not found or v_last_tx.user_id is null then
    return query select false, 'no_recent_transaction'::text, null::uuid, null::text, null::text, null::text, null::uuid, null::text[];
    return;
  end if;

  -- Anti auto-notification
  if v_last_tx.user_id = p_sender_user_id then
    return query select false, 'cannot_notify_self'::text, null::uuid, null::text, null::text, null::text, null::uuid, null::text[];
    return;
  end if;

  -- Cooldown : 1 rappel max / 5 min sur la même machine, tous expéditeurs confondus
  select count(*) into v_recent_count
  from public.pickup_reminders
  where machine_id = v_machine.id
    and created_at > now() - interval '5 minutes';

  if v_recent_count > 0 then
    return query select false, 'cooldown'::text, null::uuid, null::text, null::text, null::text, null::uuid, null::text[];
    return;
  end if;

  -- Profil destinataire (on s'appuie sur first_name qui est la colonne
  -- présente dans profiles ; fallback sur la partie locale de l'email).
  select id,
         coalesce(
           nullif(trim(coalesce(first_name, '')), ''),
           split_part(coalesce(email, ''), '@', 1),
           'Utilisateur'
         ) as display_name
  into v_recipient
  from public.profiles
  where id = v_last_tx.user_id;

  if not found then
    return query select false, 'recipient_not_found'::text, null::uuid, null::text, null::text, null::text, null::uuid, null::text[];
    return;
  end if;

  -- Tokens push Expo
  select coalesce(array_agg(distinct expo_push_token) filter (where expo_push_token is not null), '{}')
  into v_tokens
  from public.push_tokens
  where user_id = v_recipient.id;

  -- Insertion en audit
  insert into public.pickup_reminders (
    machine_id, transaction_id, sender_user_id, recipient_user_id
  ) values (
    v_machine.id, v_last_tx.id, p_sender_user_id, v_recipient.id
  )
  returning id into v_reminder_id;

  return query
    select true,
           null::text,
           v_recipient.id,
           v_recipient.display_name,
           v_machine.label,
           v_emplacement_name,
           v_reminder_id,
           coalesce(v_tokens, '{}'::text[]);
end;
$$;

-- L'app authentifiée peut exécuter la RPC. La fonction Edge utilise la
-- service_role key et y a déjà accès.
revoke all on function public.request_pickup_reminder(uuid, uuid) from public;
grant execute on function public.request_pickup_reminder(uuid, uuid) to authenticated, service_role;
