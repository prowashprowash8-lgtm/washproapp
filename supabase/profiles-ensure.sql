-- WashPro : S'assurer que la table profiles existe et que sign_up fonctionne
-- Exécuter si vous avez déjà une table profil/profiles et voulez juste ajouter l'inscription

-- Créer la table si elle n'existe pas (sans supprimer les données)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  first_name text,
  last_name text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_login_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ajouter phone si la table existait déjà sans cette colonne
alter table public.profiles add column if not exists phone text;

-- RLS
alter table public.profiles enable row level security;

-- Supprimer l'ancienne policy si elle bloque tout
drop policy if exists "No direct access" on public.profiles;

-- Recréer la policy de blocage (accès uniquement via RPC)
create policy "No direct access"
  on public.profiles for all
  using (false)
  with check (false);

-- Fonction sign_up : insère le nouvel utilisateur dans profiles
create or replace function public.sign_up(
  p_email text,
  p_password_hash text,
  p_first_name text default '',
  p_last_name text default '',
  p_phone text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user json;
  v_id uuid;
begin
  insert into profiles (email, password_hash, first_name, last_name, phone)
  values (p_email, p_password_hash, p_first_name, p_last_name, p_phone)
  returning id into v_id;

  select json_build_object(
    'id', id,
    'email', email,
    'first_name', first_name,
    'last_name', last_name,
    'phone', phone,
    'created_at', created_at
  ) into v_user
  from profiles where id = v_id;

  return v_user;
end;
$$;

grant execute on function public.sign_up(text, text, text, text, text) to anon;
