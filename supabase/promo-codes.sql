-- WashPro : Table des codes promo
-- Exécuter dans Supabase → SQL Editor

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  uses_remaining integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.promo_codes enable row level security;

create policy "Lecture publique promo_codes"
  on public.promo_codes for select using (true);

-- RPC pour valider et utiliser un code (décrémente uses_remaining)
create or replace function public.use_promo_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select * into v_row from promo_codes
  where upper(trim(code)) = upper(trim(p_code))
  and uses_remaining > 0
  for update;

  if not found then
    return false;
  end if;

  update promo_codes set uses_remaining = uses_remaining - 1 where id = v_row.id;
  return true;
end;
$$;

grant execute on function public.use_promo_code(text) to anon;

-- Exemple : insérer un code promo de test
-- insert into promo_codes (code, uses_remaining) values ('GRATUIT', 100);
