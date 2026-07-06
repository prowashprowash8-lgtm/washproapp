-- Trouvé via l'Advisor de sécurité Supabase (2026-07-06) : plusieurs tables de gestion du
-- board avaient des policies "authenticated peut tout faire" (using(true)). Avant la
-- migration #2, seul le personnel du dashboard avait un vrai compte "authenticated" — donc
-- ça ne posait pas de problème en pratique. Depuis la migration de l'app mobile vers le vrai
-- Supabase Auth, TOUS les clients de l'app sont aussi "authenticated" : ils héritaient donc
-- de ces mêmes droits d'écriture sur des tables de gestion interne (machines, laveries,
-- crm_users, promo_codes...). Corrige en restreignant l'écriture aux comptes board
-- (board_account_roles), tout en gardant la lecture pour l'app quand elle en a besoin
-- (vérifié via grep sur washproapp/src : machines, emplacements, promo_codes, missions,
-- mission_emplacements en lecture seule ; mission_submissions en lecture + insertion propre ;
-- mission_alert_tokens en upsert).

-- ---------- machines : app lit, seul le board écrit ----------
drop policy if exists "Board can insert machines" on public.machines;
drop policy if exists "Board can update machines" on public.machines;
drop policy if exists "Board can delete machines" on public.machines;

create policy "board_insert_machines" on public.machines for insert to authenticated
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));
create policy "board_update_machines" on public.machines for update to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));
create policy "board_delete_machines" on public.machines for delete to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

-- ---------- laveries : app ne l'utilise pas, board only ----------
drop policy if exists "laveries_insert_authenticated" on public.laveries;
drop policy if exists "laveries_update_authenticated" on public.laveries;
drop policy if exists "laveries_delete_authenticated" on public.laveries;

create policy "board_insert_laveries" on public.laveries for insert to authenticated
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));
create policy "board_update_laveries" on public.laveries for update to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));
create policy "board_delete_laveries" on public.laveries for delete to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

-- ---------- emplacements : app lit, seul le board écrit ----------
drop policy if exists "Board can insert emplacements" on public.emplacements;
drop policy if exists "Board can update emplacements" on public.emplacements;
drop policy if exists "Board can delete emplacements" on public.emplacements;

create policy "board_insert_emplacements" on public.emplacements for insert to authenticated
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));
create policy "board_update_emplacements" on public.emplacements for update to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));
create policy "board_delete_emplacements" on public.emplacements for delete to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

-- ---------- historique / interventions / crm_laverie_links / crm_users : app ne les
-- utilise jamais (vérifié) -> board only, y compris en lecture ----------
drop policy if exists "historique_select_authenticated" on public.historique;
drop policy if exists "historique_insert_authenticated" on public.historique;
drop policy if exists "historique_update_authenticated" on public.historique;
drop policy if exists "historique_delete_authenticated" on public.historique;
create policy "board_all_historique" on public.historique for all to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

drop policy if exists "interventions_select_authenticated" on public.interventions;
drop policy if exists "interventions_insert_authenticated" on public.interventions;
drop policy if exists "interventions_update_authenticated" on public.interventions;
drop policy if exists "interventions_delete_authenticated" on public.interventions;
create policy "board_all_interventions" on public.interventions for all to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

drop policy if exists "crm_laverie_links_select_authenticated" on public.crm_laverie_links;
drop policy if exists "crm_laverie_links_insert_authenticated" on public.crm_laverie_links;
drop policy if exists "crm_laverie_links_update_authenticated" on public.crm_laverie_links;
drop policy if exists "crm_laverie_links_delete_authenticated" on public.crm_laverie_links;
create policy "board_all_crm_laverie_links" on public.crm_laverie_links for all to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

drop policy if exists "crm_users_select_authenticated" on public.crm_users;
drop policy if exists "crm_users_insert_authenticated" on public.crm_users;
drop policy if exists "crm_users_update_authenticated" on public.crm_users;
drop policy if exists "crm_users_delete_authenticated" on public.crm_users;
create policy "board_all_crm_users" on public.crm_users for all to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

-- ---------- promo_codes : app lit (code, uses_remaining), seul le board écrit ----------
drop policy if exists "Authenticated can manage promo_codes" on public.promo_codes;
create policy "authenticated_select_promo_codes" on public.promo_codes for select to authenticated
  using (true);
create policy "board_write_promo_codes" on public.promo_codes for all to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

-- ---------- missions / mission_emplacements : app lit, seul le board écrit ----------
drop policy if exists "Board missions" on public.missions;
create policy "authenticated_select_missions" on public.missions for select to authenticated using (true);
create policy "board_write_missions" on public.missions for all to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

drop policy if exists "Board mission_emplacements" on public.mission_emplacements;
create policy "authenticated_select_mission_emplacements" on public.mission_emplacements for select to authenticated using (true);
create policy "board_write_mission_emplacements" on public.mission_emplacements for all to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

-- ---------- mission_submissions : app lit + insère sa propre soumission, board gère tout ----------
drop policy if exists "Board mission_submissions" on public.mission_submissions;
create policy "authenticated_select_mission_submissions" on public.mission_submissions for select to authenticated using (true);
create policy "authenticated_insert_own_mission_submissions" on public.mission_submissions for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);
create policy "board_manage_mission_submissions" on public.mission_submissions for all to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));

-- ---------- mission_alert_tokens : app upsert son propre jeton push, board gère tout ----------
drop policy if exists "Board mission_alert_tokens" on public.mission_alert_tokens;
create policy "authenticated_upsert_mission_alert_tokens" on public.mission_alert_tokens for insert to authenticated
  with check (true);
create policy "authenticated_update_own_mission_alert_tokens" on public.mission_alert_tokens for update to authenticated
  using (true) with check (true);
create policy "board_manage_mission_alert_tokens" on public.mission_alert_tokens for all to authenticated
  using (exists (select 1 from public.board_account_roles where user_id = auth.uid()))
  with check (exists (select 1 from public.board_account_roles where user_id = auth.uid()));
