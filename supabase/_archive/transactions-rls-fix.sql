-- WashPro : RLS public.transactions — board web (authenticated) + RPC inchangés
-- À exécuter dans Supabase → SQL Editor.
--
-- Corrige : « new row violates row-level security policy for table "transactions" »
-- lors du bouton « Lancer un cycle (test) » (insert direct depuis washprobox-board).
--
-- Les fonctions SECURITY DEFINER (create_transaction_and_start_machine, wallet, etc.)
-- contournent déjà la RLS ; ce script débloque uniquement les accès directs authentifiés.

grant usage on schema public to authenticated;
grant select, insert, update on public.transactions to authenticated;

drop policy if exists "No direct access" on public.transactions;
drop policy if exists "transactions_authenticated_select" on public.transactions;
drop policy if exists "transactions_authenticated_insert" on public.transactions;
drop policy if exists "transactions_authenticated_update" on public.transactions;
drop policy if exists "Authenticated can insert transactions" on public.transactions;
drop policy if exists "Authenticated can read transactions" on public.transactions;
drop policy if exists "Authenticated can update transactions" on public.transactions;

-- Tableau de bord : lecture de toutes les lignes (comptes board déjà restreints côté auth)
create policy "transactions_authenticated_select"
  on public.transactions for select
  to authenticated
  using (true);

-- Insert : uniquement si la ligne porte l’utilisateur connecté (ex. cycle test board)
create policy "transactions_authenticated_insert"
  on public.transactions for insert
  to authenticated
  with check (user_id = auth.uid());

-- Remboursements / mises à jour depuis le board (profil client, etc.)
create policy "transactions_authenticated_update"
  on public.transactions for update
  to authenticated
  using (true)
  with check (true);
