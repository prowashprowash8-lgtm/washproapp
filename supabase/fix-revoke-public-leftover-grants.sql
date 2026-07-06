-- Trouvé via le CSV exporté du dashboard Supabase (2026-07-06) : Postgres accorde EXECUTE
-- à PUBLIC par défaut à la création d'une fonction. Plusieurs fonctions n'avaient jamais eu
-- ce grant par défaut explicitement retiré, restant donc exécutables par n'importe qui, sans
-- connexion (anon), même après avoir été migrées vers auth.uid()/authenticated.

-- ---------- Fonctions migrées aujourd'hui (#2) : doivent être authenticated uniquement ----------
revoke all on function public.create_transaction_and_pay_with_wallet(uuid, uuid, text, numeric, integer) from public, anon;
revoke all on function public.create_transaction_and_start_machine(uuid, uuid, text, numeric, text, text) from public, anon;
revoke all on function public.get_user_available_promo_codes() from public, anon;
revoke all on function public.get_user_transactions() from public, anon;
revoke all on function public.get_user_transactions(uuid) from public, anon;
revoke all on function public.get_user_wallet_activity() from public, anon;
revoke all on function public.get_user_wallet_activity(uuid) from public, anon;
revoke all on function public.get_wallet_balance() from public, anon;
revoke all on function public.update_profile(text, text, text, text) from public, anon;
grant execute on function public.create_transaction_and_pay_with_wallet(uuid, uuid, text, numeric, integer) to authenticated;
grant execute on function public.create_transaction_and_start_machine(uuid, uuid, text, numeric, text, text) to authenticated;
grant execute on function public.get_user_available_promo_codes() to authenticated;
grant execute on function public.get_user_transactions() to authenticated;
grant execute on function public.get_user_transactions(uuid) to authenticated;
grant execute on function public.get_user_wallet_activity() to authenticated;
grant execute on function public.get_user_wallet_activity(uuid) to authenticated;
grant execute on function public.get_wallet_balance() to authenticated;
grant execute on function public.update_profile(text, text, text, text) to authenticated;

-- ---------- Sensibles : accès interne uniquement (service_role), jamais anon/authenticated ----------
revoke all on function public.apply_wallet_recharge(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.apply_wallet_recharge(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.apply_wallet_recharge(uuid, integer, text) to service_role;
grant execute on function public.apply_wallet_recharge(uuid, integer, text, text) to service_role;

revoke all on function public.provision_esp32_device(text) from public, anon, authenticated;
grant execute on function public.provision_esp32_device(text) to service_role;

-- ---------- Internes board : authenticated uniquement, pas anon ----------
revoke all on function public.ensure_crm_link_for_emplacement(uuid) from public, anon;
grant execute on function public.ensure_crm_link_for_emplacement(uuid) to authenticated;

revoke all on function public.get_active_machines(uuid) from public, anon;
grant execute on function public.get_active_machines(uuid) to authenticated;

revoke all on function public.get_overdue_machines(uuid) from public, anon;
grant execute on function public.get_overdue_machines(uuid) to authenticated;

revoke all on function public.mark_overdue_occupancies() from public, anon;
grant execute on function public.mark_overdue_occupancies() to authenticated;

revoke all on function public.release_expired_machines() from public, anon;
grant execute on function public.release_expired_machines() to authenticated;

revoke all on function public.set_machine_available_by_id(uuid) from public, anon;
grant execute on function public.set_machine_available_by_id(uuid) to authenticated;

revoke all on function public.set_transaction_duration(uuid, integer) from public, anon;
grant execute on function public.set_transaction_duration(uuid, integer) to authenticated;

revoke all on function public.request_pickup_reminder(uuid, uuid) from public, anon;
grant execute on function public.request_pickup_reminder(uuid, uuid) to authenticated;

revoke all on function public.count_unseen_refund_responses(uuid) from public, anon;
grant execute on function public.count_unseen_refund_responses(uuid) to authenticated;

revoke all on function public.mark_refund_responses_seen(uuid) from public, anon;
grant execute on function public.mark_refund_responses_seen(uuid) to authenticated;

revoke all on function public.end_machine_occupancy(uuid, uuid) from public, anon;
grant execute on function public.end_machine_occupancy(uuid, uuid) to authenticated;

revoke all on function public.send_occupancy_reminder(uuid, uuid) from public, anon;
grant execute on function public.send_occupancy_reminder(uuid, uuid) to authenticated;

revoke all on function public.start_machine_occupancy(uuid, uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.start_machine_occupancy(uuid, uuid, uuid, uuid, integer) to authenticated;

-- ---------- Fonctions déclencheurs (trigger) : jamais censées être appelées via RPC direct,
-- pas de raison de les laisser exécutables par qui que ce soit en dehors du trigger lui-même ----------
revoke all on function public.handle_new_auth_user_to_profile() from public, anon, authenticated;
revoke all on function public.log_machine_command_event() from public, anon, authenticated;
revoke all on function public.log_machine_status_event() from public, anon, authenticated;
revoke all on function public.log_transaction_finished_on_machine_available() from public, anon, authenticated;
revoke all on function public.trg_crm_laverie_update_sync_board() from public, anon, authenticated;
revoke all on function public.trg_emplacement_delete_sync_crm() from public, anon, authenticated;
revoke all on function public.trg_emplacement_insert_sync_crm() from public, anon, authenticated;
revoke all on function public.trg_emplacement_update_sync_crm() from public, anon, authenticated;
