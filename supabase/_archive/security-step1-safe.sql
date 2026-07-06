-- WashPro - Security hardening step 1 (safe/minimal)
-- Objectif: supprimer les policies "open bar" sans casser les flux app/ESP principaux.
-- A exécuter dans Supabase SQL Editor.

begin;

-- ------------------------------------------------------------
-- 1) MACHINES: supprimer les policies globales trop permissives
-- ------------------------------------------------------------
drop policy if exists "Allow all machines" on public.machines;
drop policy if exists "Allow all insert machines" on public.machines;
drop policy if exists "Allow all update machines" on public.machines;
drop policy if exists "Allow all read machines" on public.machines;
drop policy if exists "anon delete machines" on public.machines;
drop policy if exists "anon update machines" on public.machines;

-- Garder une lecture publique/anon pour l'app mobile
drop policy if exists "App can read machines" on public.machines;
drop policy if exists "anon read machines" on public.machines;
create policy "anon read machines"
  on public.machines for select
  to anon
  using (true);

-- Garder la lecture authenticated
drop policy if exists "Board can read machines" on public.machines;
create policy "Board can read machines"
  on public.machines for select
  to authenticated
  using (true);

-- ------------------------------------------------------------
-- 2) EMPLACEMENTS: retirer le ALL public
-- ------------------------------------------------------------
drop policy if exists "Allow all emplacements" on public.emplacements;

-- Conserver la lecture anonyme pour l'app
drop policy if exists "anon read emplacements" on public.emplacements;
create policy "anon read emplacements"
  on public.emplacements for select
  to anon
  using (true);

-- ------------------------------------------------------------
-- 3) PROMO_CODES: interdire les writes anon
-- ------------------------------------------------------------
drop policy if exists "Anon can insert promo_codes" on public.promo_codes;
drop policy if exists "Anon can update promo_codes" on public.promo_codes;
drop policy if exists "Anon can delete promo_codes" on public.promo_codes;

commit;

