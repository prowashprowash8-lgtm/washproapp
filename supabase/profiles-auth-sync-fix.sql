-- WashPro : synchroniser auth.users -> public.profiles (backfill + trigger)
-- À exécuter dans Supabase → SQL Editor.
--
-- Corrige les FK du type :
--   transactions_user_id_fkey (user_id absent dans public.profiles)

-- 1) Garantir la table profiles attendue par les FK métier
create table if not exists public.profiles (
  id uuid primary key,
  email text unique not null,
  password_hash text not null default '__AUTH_MANAGED__',
  first_name text,
  last_name text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_login_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "No direct access" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- 2) Backfill : créer les profils manquants pour les utilisateurs déjà existants
insert into public.profiles (id, email, password_hash, first_name, last_name, phone)
select
  u.id,
  coalesce(u.email, ''),
  '__AUTH_MANAGED__',
  u.raw_user_meta_data->>'first_name',
  u.raw_user_meta_data->>'last_name',
  null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and u.email is not null
on conflict (id) do update
set email = excluded.email;

-- 3) Trigger : à chaque nouvel utilisateur auth, créer/mettre à jour profiles
create or replace function public.handle_new_auth_user_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, password_hash, first_name, last_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    '__AUTH_MANAGED__',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    null
  )
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user_to_profile();
