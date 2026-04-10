-- WashPro : mise à jour profil (prénom, nom, e-mail, téléphone) + changement de mot de passe
-- Exécuter dans Supabase → SQL Editor (après profiles-auth / profiles-ensure)

drop function if exists public.update_profile(uuid, text, text);

create or replace function public.update_profile(
  p_user_id uuid,
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
  if not exists (select 1 from profiles where id = p_user_id) then
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

grant execute on function public.update_profile(uuid, text, text, text, text) to anon;

create or replace function public.update_password_hash(
  p_user_id uuid,
  p_new_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set password_hash = p_new_password_hash
  where id = p_user_id;
  return found;
end;
$$;

grant execute on function public.update_password_hash(uuid, text) to anon;
