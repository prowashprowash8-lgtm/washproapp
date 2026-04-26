-- WashPro - Security hardening step 2 (safe)
-- Objectif: retirer l'exécution client (anon/authenticated) des fonctions admin/ops.
-- Ne touche pas aux RPC critiques de lancement machine/app.

begin;

-- -------------------------------------------------------------------
-- Réduire la surface d'exécution des fonctions sensibles (admin/CRM)
-- -------------------------------------------------------------------
do $$
begin
  -- Supporte les bases où certaines fonctions n'existent pas.
  if to_regprocedure('public.apply_wallet_manual_refund(uuid,integer,text)') is not null then
    execute 'revoke execute on function public.apply_wallet_manual_refund(uuid, integer, text) from anon, authenticated';
    execute 'grant execute on function public.apply_wallet_manual_refund(uuid, integer, text) to service_role';
  end if;

  if to_regprocedure('public.apply_wallet_stripe_refund(uuid,integer,text)') is not null then
    execute 'revoke execute on function public.apply_wallet_stripe_refund(uuid, integer, text) from anon, authenticated';
    execute 'grant execute on function public.apply_wallet_stripe_refund(uuid, integer, text) to service_role';
  end if;

  if to_regprocedure('public.approve_or_reject_refund_request(uuid,text,text)') is not null then
    execute 'revoke execute on function public.approve_or_reject_refund_request(uuid, text, text) from anon, authenticated';
    execute 'grant execute on function public.approve_or_reject_refund_request(uuid, text, text) to service_role';
  end if;

  if to_regprocedure('public.backfill_emplacements_to_crm()') is not null then
    execute 'revoke execute on function public.backfill_emplacements_to_crm() from anon, authenticated';
    execute 'grant execute on function public.backfill_emplacements_to_crm() to service_role';
  end if;

  if to_regprocedure('public.enqueue_crm_emplacement_sync(uuid,text)') is not null then
    execute 'revoke execute on function public.enqueue_crm_emplacement_sync(uuid, text) from anon, authenticated';
    execute 'grant execute on function public.enqueue_crm_emplacement_sync(uuid, text) to service_role';
  end if;

  if to_regprocedure('public.insert_crm_laverie_from_board(uuid)') is not null then
    execute 'revoke execute on function public.insert_crm_laverie_from_board(uuid) from anon, authenticated';
    execute 'grant execute on function public.insert_crm_laverie_from_board(uuid) to service_role';
  end if;

  if to_regprocedure('public.retry_failed_crm_laverie_links(integer)') is not null then
    execute 'revoke execute on function public.retry_failed_crm_laverie_links(integer) from anon, authenticated';
    execute 'grant execute on function public.retry_failed_crm_laverie_links(integer) to service_role';
  end if;

  if to_regprocedure('public.refund_transaction(uuid,text)') is not null then
    execute 'revoke execute on function public.refund_transaction(uuid, text) from anon, authenticated';
    execute 'grant execute on function public.refund_transaction(uuid, text) to service_role';
  end if;

  if to_regprocedure('public.notify_mission_posted(uuid,text)') is not null then
    execute 'revoke execute on function public.notify_mission_posted(uuid, text) from anon, authenticated';
    execute 'grant execute on function public.notify_mission_posted(uuid, text) to service_role';
  end if;
end $$;

-- -------------------------------------------------------------------
-- Supprimer les droits TRUNCATE client (jamais nécessaires en prod)
-- -------------------------------------------------------------------
revoke truncate on all tables in schema public from anon, authenticated;

commit;

