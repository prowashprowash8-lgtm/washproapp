-- WashPro : mise à jour profil (prénom, nom, e-mail, téléphone)
-- Exécuter dans Supabase → SQL Editor
--
-- Migration #2 de l'audit (2026-07-06) : identité tirée de la vraie session Supabase Auth
-- (auth.uid()) au lieu d'un p_user_id/p_session_token fournis par le client. Anciennes
-- versions (5, 6 arguments) supprimées.

drop function if exists public.update_profile(uuid, text, text);
drop function if exists public.update_profile(uuid, text, text, text, text);
drop function if exists public.update_profile(uuid, uuid, text, text, text, text);

create or replace function public.update_profile(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return null;
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  if exists (
    select 1 from profiles
    where lower(trim(email)) = lower(trim(p_email))
      and id <> v_uid
  ) then
    raise exception 'EMAIL_TAKEN';
  end if;

  update profiles
  set
    first_name = nullif(trim(p_first_name), ''),
    last_name = nullif(trim(p_last_name), ''),
    email = trim(p_email),
    phone = nullif(trim(p_phone), '')
  where id = v_uid;

  return (
    select json_build_object(
      'id', id,
      'email', email,
      'first_name', first_name,
      'last_name', last_name,
      'phone', phone
    )
    from profiles
    where id = v_uid
  );
end;
$$;

revoke all on function public.update_profile(text, text, text, text) from public;
grant execute on function public.update_profile(text, text, text, text) to authenticated;

-- update_password_hash et change_password (ancien système) ont été retirés — voir
-- profiles-auth.sql. Le changement de mot de passe passe désormais par
-- supabase.auth.updateUser().
