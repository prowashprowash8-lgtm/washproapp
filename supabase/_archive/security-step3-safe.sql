-- WashPro - Security hardening step 3 (safe)
-- Cible: table public.transactions
-- Règle: accès = propriétaire (auth.uid = user_id) OU patron board.
-- Ce script garde le flux board si les comptes board ont bien un rôle patron.

begin;

-- Nettoyage policies existantes
drop policy if exists "transactions_authenticated_select" on public.transactions;
drop policy if exists "transactions_authenticated_insert" on public.transactions;
drop policy if exists "transactions_authenticated_update" on public.transactions;
drop policy if exists "Authenticated can insert transactions" on public.transactions;
drop policy if exists "Authenticated can read transactions" on public.transactions;
drop policy if exists "Authenticated can update transactions" on public.transactions;

-- SELECT: propriétaire OU patron board
create policy "transactions_authenticated_select"
  on public.transactions for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.board_account_roles bar
      where bar.user_id = auth.uid()
        and bar.role = 'patron'
    )
  );

-- INSERT:
-- - app/client: user_id = auth.uid()
-- - board patron: peut insérer pour un client (tests/support)
create policy "transactions_authenticated_insert"
  on public.transactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.board_account_roles bar
      where bar.user_id = auth.uid()
        and bar.role = 'patron'
    )
  );

-- UPDATE: propriétaire OU patron board
create policy "transactions_authenticated_update"
  on public.transactions for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.board_account_roles bar
      where bar.user_id = auth.uid()
        and bar.role = 'patron'
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.board_account_roles bar
      where bar.user_id = auth.uid()
        and bar.role = 'patron'
    )
  );

commit;

