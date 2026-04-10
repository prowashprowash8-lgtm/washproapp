-- WashPro : Réinitialisation du mot de passe
-- Exécuter dans Supabase → SQL Editor
--
-- Le code est généré par `password_reset_issue_code` (réservé à service_role uniquement).
-- L’envoi d’e-mail est assuré par l’Edge Function `request-password-reset` (Resend).

create table if not exists public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_password_reset_email on password_reset_codes(email);
create index if not exists idx_password_reset_expires on password_reset_codes(expires_at);

alter table public.password_reset_codes enable row level security;
drop policy if exists "No direct access" on public.password_reset_codes;
create policy "No direct access" on public.password_reset_codes for all using (false) with check (false);

-- Ancienne RPC publique (ne doit plus exposer le code) : supprimée si présente
drop function if exists public.request_password_reset(text);

-- Réservée à service_role : appelée par l’Edge Function uniquement
create or replace function public.password_reset_issue_code(p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_expires timestamptz;
begin
  if not exists (select 1 from profiles where lower(trim(email)) = lower(trim(p_email))) then
    return json_build_object('success', true);
  end if;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  v_expires := now() + interval '15 minutes';

  insert into password_reset_codes (email, code, expires_at)
  values (trim(p_email), v_code, v_expires);

  return json_build_object('success', true, 'code', v_code);
end;
$$;

revoke all on function public.password_reset_issue_code(text) from public;
grant execute on function public.password_reset_issue_code(text) to service_role;

-- RPC : réinitialiser le mot de passe avec le code (inchangé pour l’app)
create or replace function public.reset_password_with_code(
  p_email text,
  p_code text,
  p_new_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select * into v_row from password_reset_codes
  where lower(trim(email)) = lower(trim(p_email))
    and trim(code) = trim(p_code)
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    return false;
  end if;

  update profiles
  set password_hash = p_new_password_hash
  where lower(trim(email)) = lower(trim(p_email));

  delete from password_reset_codes where id = v_row.id;
  return true;
end;
$$;

grant execute on function public.reset_password_with_code(text, text, text) to anon;
