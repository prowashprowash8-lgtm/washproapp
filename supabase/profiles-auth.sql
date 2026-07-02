-- WashPro : Authentification via la table profiles (hash côté serveur avec pgcrypto)
-- Exécuter dans Supabase → SQL Editor
-- Nécessite l'extension pgcrypto

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

-- CRITIQUE #5/#6 de l'audit : jeton de session maison (l'app mobile n'a pas de vraie
-- session Supabase Auth). Exigé en plus de p_user_id par toutes les RPC sensibles
-- (wallet, transactions, profil) pour prouver que l'appelant est bien cet utilisateur.
alter table public.profiles add column if not exists session_token uuid default gen_random_uuid();

-- drop nécessaire : Postgres refuse de renommer p_password_hash -> p_password via create or replace.
drop function if exists public.sign_up(text, text, text, text, text);
-- ancienne version à 1 seul paramètre : renvoyait le hash au client, on la retire.
drop function if exists public.sign_in(text);

-- Inscription : reçoit le mot de passe en clair et le hash côté serveur
create or replace function public.sign_up(
  p_email text,
  p_password text,
  p_first_name text default '',
  p_last_name text default '',
  p_phone text default ''
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user json;
  v_id uuid;
  v_password_hash text;
begin
  -- Hasher le mot de passe avec bcrypt (via pgcrypto)
  v_password_hash := crypt(p_password, gen_salt('bf'));
  
  insert into profiles (email, password_hash, first_name, last_name, phone)
  values (p_email, v_password_hash, p_first_name, p_last_name, p_phone)
  returning id into v_id;

  select json_build_object(
    'id', id,
    'email', email,
    'session_token', session_token,
    'first_name', first_name,
    'last_name', last_name,
    'phone', phone,
    'created_at', created_at
  ) into v_user
  from profiles where id = v_id;

  return v_user;
end;
$$;

-- Connexion : vérifie le mot de passe côté serveur et retourne l'utilisateur si valide
create or replace function public.sign_in(
  p_email text,
  p_password text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user json;
  v_stored_hash text;
begin
  -- Récupérer le hash stocké
  select password_hash into v_stored_hash
  from profiles
  where email = p_email;
  
  -- Vérifier si l'utilisateur existe
  if v_stored_hash is null then
    return null;
  end if;
  
  -- Vérifier le mot de passe avec crypt()
  if not (v_stored_hash = crypt(p_password, v_stored_hash)) then
    return null;
  end if;
  
  -- Mettre à jour last_login_at
  update profiles set last_login_at = now() where email = p_email;

  select json_build_object(
    'id', id,
    'email', email,
    'session_token', session_token,
    'first_name', first_name,
    'last_name', last_name,
    'phone', phone,
    'created_at', created_at,
    'last_login_at', last_login_at
  ) into v_user
  from profiles where email = p_email;

  return v_user;
end;
$$;

grant execute on function public.sign_up(text, text, text, text, text) to anon;
grant execute on function public.sign_in(text, text) to anon;

-- Changement de mot de passe : vérifie l'ancien mot de passe, exige le session_token
-- (preuve que l'appelant est bien p_user_id), et fait tourner le session_token
-- (défense en profondeur : un ancien jeton fuité devient inutile après un changement).
drop function if exists public.change_password(uuid, text, text);

create or replace function public.change_password(
  p_user_id uuid,
  p_session_token uuid,
  p_current_password text,
  p_new_password text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_stored_hash text;
  v_new_token uuid;
begin
  select password_hash into v_stored_hash
  from profiles
  where id = p_user_id and session_token = p_session_token;

  if v_stored_hash is null then
    return json_build_object('success', false, 'error', 'unauthorized');
  end if;

  if not (v_stored_hash = crypt(p_current_password, v_stored_hash)) then
    return json_build_object('success', false, 'error', 'wrong_password');
  end if;

  v_new_token := gen_random_uuid();

  update profiles
  set password_hash = crypt(p_new_password, gen_salt('bf')),
      session_token = v_new_token
  where id = p_user_id;

  return json_build_object('success', true, 'session_token', v_new_token);
end;
$$;

-- reset_password_with_code (vérification du code à 6 chiffres) vit dans password-reset.sql,
-- pas ici : ne pas la redéfinir dans ce fichier, une redéfinition avec la même signature
-- (text, text, text) écraserait silencieusement la vraie vérification du code.

grant execute on function public.change_password(uuid, uuid, text, text) to anon;
