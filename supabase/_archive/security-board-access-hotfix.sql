-- WashPro - Hotfix accès board (gérants + patrons)
-- Corrige :
-- 1) Liste utilisateurs board bloquée
-- 2) Historique remboursements board bloqué
-- 3) Historique événements machine lisible par tous les rôles board

begin;

-- Accès profils: tout compte board (pas seulement patron)
drop policy if exists "Board admins can read profiles" on public.profiles;
drop policy if exists "board_read_profiles_patron" on public.profiles;
drop policy if exists "board_read_profiles_board_role" on public.profiles;
create policy "board_read_profiles_board_role"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.board_account_roles bar
      where bar.user_id = auth.uid()
    )
  );

-- Accès refund_requests: lecture + gestion par tout compte board
drop policy if exists "allow_all_refunds" on public.refund_requests;
drop policy if exists "refund_requests_patron_read" on public.refund_requests;
drop policy if exists "refund_requests_patron_manage" on public.refund_requests;
drop policy if exists "refund_requests_board_read" on public.refund_requests;
drop policy if exists "refund_requests_board_manage" on public.refund_requests;

create policy "refund_requests_board_read"
  on public.refund_requests for select
  to authenticated
  using (
    exists (
      select 1
      from public.board_account_roles bar
      where bar.user_id = auth.uid()
    )
  );

create policy "refund_requests_board_manage"
  on public.refund_requests for all
  to authenticated
  using (
    exists (
      select 1
      from public.board_account_roles bar
      where bar.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.board_account_roles bar
      where bar.user_id = auth.uid()
    )
  );

-- machine_event_history: lecture board (rôle board, pas seulement patron)
drop policy if exists "machine_event_history_patron_read" on public.machine_event_history;
drop policy if exists "machine_event_history_board_read" on public.machine_event_history;
create policy "machine_event_history_board_read"
  on public.machine_event_history for select
  to authenticated
  using (
    exists (
      select 1
      from public.board_account_roles bar
      where bar.user_id = auth.uid()
    )
  );

commit;

