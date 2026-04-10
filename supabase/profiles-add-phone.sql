-- WashPro : Ajouter la colonne phone à la table profiles (migration pour bases existantes)
-- Exécuter dans Supabase → SQL Editor si vous avez déjà des utilisateurs

-- Ajouter la colonne phone si elle n'existe pas
alter table public.profiles add column if not exists phone text;

-- Mettre à jour la fonction sign_up pour accepter le téléphone
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

-- Mettre à jour sign_in pour retourner le phone
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
