-- WashPro : Table des utilisateurs connectés
-- Exécuter dans Supabase → SQL Editor

-- Table profils : tous les utilisateurs qui s'inscrivent
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  first_name text,
  last_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_login_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger : crée une ligne à chaque inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
