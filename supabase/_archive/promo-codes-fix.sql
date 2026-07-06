-- Fix promo_codes : ajouter uses_remaining si votre table a type/value/max_uses
-- Exécuter dans Supabase → SQL Editor

-- Ajouter la colonne si elle n'existe pas
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS uses_remaining integer;

-- Migrer max_uses vers uses_remaining (si max_uses existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'promo_codes' AND column_name = 'max_uses'
  ) THEN
    UPDATE promo_codes SET uses_remaining = COALESCE(max_uses, 100) WHERE uses_remaining IS NULL;
  ELSE
    UPDATE promo_codes SET uses_remaining = 100 WHERE uses_remaining IS NULL;
  END IF;
END $$;

-- S'assurer qu'aucune ligne n'a uses_remaining NULL
UPDATE promo_codes SET uses_remaining = 1 WHERE uses_remaining IS NULL;

-- Recréer la fonction use_promo_code (compatible avec le schéma WashPro)
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
  and (uses_remaining is null or uses_remaining > 0)
  for update;

  if not found then
    return false;
  end if;

  update promo_codes set uses_remaining = coalesce(uses_remaining, 1) - 1 where id = v_row.id;
  return true;
end;
$$;

grant execute on function public.use_promo_code(text) to anon;
