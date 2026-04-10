-- WashPro : codes promo limités au lave-linge ou au sèche-linge
-- Prérequis : exécuter d’abord supabase/machines-machine-kind.sql (colonne machines.machine_kind).
-- Exécuter dans Supabase → SQL Editor (une fois).

alter table public.promo_codes
  add column if not exists applies_to text default 'both';

comment on column public.promo_codes.applies_to is
  'both = tous ; lavage = lave-linge uniquement ; sechage = sèche-linge uniquement (voir machines.machine_kind)';

-- Ancienne signature (1 param) → remplacée par (code + machine)
drop function if exists public.use_promo_code(text);

create or replace function public.use_promo_code(p_code text, p_machine_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_mk text;
  v_mt text;
  v_kind text;
  v_apply text;
begin
  if p_machine_id is null then
    return json_build_object('success', false, 'error', 'invalid');
  end if;

  select * into v_row from public.promo_codes
  where upper(trim(code)) = upper(trim(p_code))
    and (uses_remaining is null or uses_remaining > 0)
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'invalid');
  end if;

  select lower(trim(coalesce(machine_kind, ''))), lower(coalesce(type, ''))
    into v_mk, v_mt
  from public.machines
  where id = p_machine_id;

  if not found then
    return json_build_object('success', false, 'error', 'invalid');
  end if;

  -- Priorité : colonne machine_kind (board), sinon ancien champ type
  if v_mk in ('lavage', 'sechage') then
    v_kind := v_mk;
  else
    v_kind := case
      when v_mt like '%sechage%' or v_mt like '%dryer%' or v_mt like '%sèche%' or v_mt like '%seche%' then 'sechage'
      else 'lavage'
    end;
  end if;

  v_apply := lower(trim(coalesce(v_row.applies_to, 'both')));
  if v_apply not in ('both', 'lavage', 'sechage') then
    v_apply := 'both';
  end if;

  if v_apply = 'lavage' and v_kind <> 'lavage' then
    return json_build_object('success', false, 'error', 'wrong_machine_type');
  end if;

  if v_apply = 'sechage' and v_kind <> 'sechage' then
    return json_build_object('success', false, 'error', 'wrong_machine_type');
  end if;

  update public.promo_codes
  set uses_remaining = coalesce(uses_remaining, 1) - 1
  where id = v_row.id;

  return json_build_object('success', true);
end;
$$;

grant execute on function public.use_promo_code(text, uuid) to anon;
grant execute on function public.use_promo_code(text, uuid) to authenticated;

-- Exemples (décommenter et adapter les UUID si besoin) :
-- insert into public.promo_codes (code, uses_remaining, applies_to) values ('LAVE2026', 50, 'lavage');
-- insert into public.promo_codes (code, uses_remaining, applies_to) values ('SECHE2026', 30, 'sechage');
