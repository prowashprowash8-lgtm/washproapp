-- WashPro : mise à jour profil (prénom, nom, e-mail, téléphone) + changement de mot de passe
-- Exécuter dans Supabase → SQL Editor (après profiles-auth / profiles-ensure)

drop function if exists public.update_profile(uuid, text, text);
-- CRITIQUE #5 de l'audit : ancienne version (5 arguments) modifiable par n'importe qui
-- connaissant un UUID. Remplacée par la version à 6 arguments qui exige le session_token.
drop function if exists public.update_profile(uuid, text, text, text, text);

create or replace function public.update_profile(
  p_user_id uuid,
  p_session_token uuid,
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
begin
  if not exists (select 1 from profiles where id = p_user_id and session_token = p_session_token) then
    return null;
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  if exists (
    select 1 from profiles
    where lower(trim(email)) = lower(trim(p_email))
      and id <> p_user_id
  ) then
    raise exception 'EMAIL_TAKEN';
  end if;

  update profiles
  set
    first_name = nullif(trim(p_first_name), ''),
    last_name = nullif(trim(p_last_name), ''),
    email = trim(p_email),
    phone = nullif(trim(p_phone), '')
  where id = p_user_id;

  return (
    select json_build_object(
      'id', id,
      'email', email,
      'first_name', first_name,
      'last_name', last_name,
      'phone', phone
    )
    from profiles
    where id = p_user_id
  );
end;
$$;

grant execute on function public.update_profile(uuid, uuid, text, text, text, text) to anon;

-- update_password_hash a été retiré (CRITIQUE #1 de l'audit : accessible à anon sans
-- vérifier le mot de passe actuel). Remplacé par change_password (profiles-auth.sql),
-- qui exige le mot de passe actuel avant tout changement. Rien dans l'app ne l'appelle plus.
revoke all on function public.update_password_hash(uuid, text) from public, anon, authenticated;
drop function if exists public.update_password_hash(uuid, text);
