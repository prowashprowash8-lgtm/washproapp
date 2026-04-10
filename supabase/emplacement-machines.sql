-- WashPro : Table machines (liée à votre table emplacements existante)
-- Exécuter dans Supabase → SQL Editor

-- Table machines - liée à emplacement
create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  emplacement_id uuid not null references public.emplacements(id) on delete cascade,
  name text not null,
  type text, -- 'lavage' (machine à laver) ou 'sechage' (sèche-linge)
  statut text default 'disponible', -- disponible, occupe, reserve
  price decimal(10,2) default 0, -- prix fixe (lavage)
  price_per_hour decimal(10,2) default 0, -- prix/heure (sechage)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Si la table existe déjà, ajouter les colonnes
alter table public.machines add column if not exists price decimal(10,2) default 0;
alter table public.machines add column if not exists price_per_hour decimal(10,2) default 0;
alter table public.machines add column if not exists relay_id integer; -- numéro du relais ESP32 (1, 2, 3...)

-- ID de l'ESP32 pour cet emplacement (ex: WASH_PRO_001) - l'ESP32 poll Supabase
alter table public.emplacements add column if not exists esp32_id text;

-- RLS : lecture publique pour machines
alter table public.machines enable row level security;

drop policy if exists "Lecture publique machines" on public.machines;
create policy "Lecture publique machines"
  on public.machines for select using (true);
