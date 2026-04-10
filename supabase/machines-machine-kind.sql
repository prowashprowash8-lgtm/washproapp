-- WashPro : type de machine explicite pour le board + codes promo
-- À exécuter dans Supabase → SQL Editor AVANT (ou avec) promo-codes-machine-type.sql
--
-- Table Editor → machines : colonne machine_kind = lavage | sechage (obligatoire après remplissage)
-- Table Editor → promo_codes : applies_to = both | lavage | sechage

alter table public.machines
  add column if not exists machine_kind text default 'lavage';

-- Rétro-remplissage depuis l’ancien champ libre "type"
update public.machines
set machine_kind = 'sechage'
where machine_kind is null or machine_kind = 'lavage'
  and (
    lower(coalesce(type, '')) like '%sechage%'
    or lower(coalesce(type, '')) like '%dryer%'
    or lower(coalesce(type, '')) like '%sèche%'
    or lower(coalesce(type, '')) like '%seche%'
  );

update public.machines
set machine_kind = 'lavage'
where machine_kind is null;

alter table public.machines
  drop constraint if exists machines_machine_kind_check;

alter table public.machines
  add constraint machines_machine_kind_check
  check (machine_kind in ('lavage', 'sechage'));

comment on column public.machines.machine_kind is
  'lavage = lave-linge, sechage = sèche-linge — utilisé pour prix à l’heure et codes promo.';

comment on column public.machines.type is
  'Libellé affichable (ex. lavage, sechage) ; machine_kind pilote la logique métier.';
