-- WashPro : Authentification via la table profiles (hash côté client avec bcryptjs)
-- Exécuter dans Supabase → SQL Editor
-- Pas besoin de pgcrypto : le hash est fait dans l'app avec bcryptjs

-- Supprimer l'ancienne config si elle existe
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.sign_up(text, text, text, text, text);
drop function if exists public.sign_up(text, text, text, text);
drop function if exists public.sign_in(text);
drop table if exists public.profiles cascade;

-- Table profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  first_name text,
  last_name text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_login_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS
alter table public.profiles enable row level security;

create policy "No direct access"
  on public.profiles for all
  using (false)
  with check (false);

-- Inscription : reçoit le mot de passe DÉJÀ HASHÉ par l'app (bcryptjs)
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

-- Connexion : retourne l'utilisateur si l'email existe (la vérification du mot de passe se fait dans l'app)
create or replace function public.sign_in(p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user json;
begin
  update profiles set last_login_at = now() where email = p_email;

  select json_build_object(
    'id', id,
    'email', email,
    'first_name', first_name,
    'last_name', last_name,
    'phone', phone,
    'password_hash', password_hash,
    'created_at', created_at,
    'last_login_at', last_login_at
  ) into v_user
  from profiles where email = p_email;

  return v_user;
end;
$$;

grant execute on function public.sign_up(text, text, text, text, text) to anon;
grant execute on function public.sign_in(text) to anon;
