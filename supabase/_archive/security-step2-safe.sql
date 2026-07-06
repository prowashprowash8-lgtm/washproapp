-- WashPro - Security hardening step 2 (safe)
-- Objectif: retirer l'exécution client (anon/authenticated) des fonctions admin/ops.
-- Ne touche pas aux RPC critiques de lancement machine/app.
--
-- CE FICHIER A DÉJÀ ÉTÉ APPLIQUÉ (corrigé et exécuté le 2026-07-02) : les signatures
-- ci-dessous étaient fausses dans la version précédente de ce fichier (elles ne
-- correspondaient à aucune fonction réelle, donc ne faisaient rien), et la ligne
-- backfill_emplacements_to_crm aurait cassé le bouton d'import CRM du board en retirant
-- l'accès "authenticated" en plus de "anon". Conservé ici à titre de documentation ;
-- pas besoin de le rejouer sauf après une restauration de base depuis un ancien dump.

begin;

do $$
begin
  if to_regprocedure('public.apply_wallet_manual_refund(uuid,integer,text)') is not null then
    execute 'revoke execute on function public.apply_wallet_manual_refund(uuid, integer, text) from anon, authenticated';
    execute 'grant execute on function public.apply_wallet_manual_refund(uuid, integer, text) to service_role';
  end if;

  if to_regprocedure('public.apply_wallet_stripe_refund(uuid,integer,text)') is not null then
    execute 'revoke execute on function public.apply_wallet_stripe_refund(uuid, integer, text) from anon, authenticated';
    execute 'grant execute on function public.apply_wallet_stripe_refund(uuid, integer, text) to service_role';
  end if;

  -- approve_or_reject_refund_request : NE PAS révoquer "authenticated" ici (voir
  -- refund-request-response-and-promo.sql, CRITIQUE #4 — vérification du rôle patron
  -- déjà intégrée dans la fonction, "authenticated" doit rester accordé pour le board).

  -- backfill_emplacements_to_crm : NE PAS révoquer "authenticated" (bouton réel dans
  -- CrmLaveries.tsx). Verrouillée via vérification du rôle patron à l'intérieur de la
  -- fonction elle-même (voir esp32-provisioning... non, voir le correctif du 2026-07-02
  -- dans backfill_emplacements_to_crm : IF NOT EXISTS (... board_account_roles ... patron)).

  if to_regprocedure('public.enqueue_crm_emplacement_sync()') is not null then
    execute 'revoke execute on function public.enqueue_crm_emplacement_sync() from anon, authenticated';
  end if;

  if to_regprocedure('public.insert_crm_laverie_from_board(text,text)') is not null then
    execute 'revoke execute on function public.insert_crm_laverie_from_board(text,text) from anon, authenticated';
    execute 'grant execute on function public.insert_crm_laverie_from_board(text,text) to service_role';
  end if;

  if to_regprocedure('public.insert_crm_laverie_from_board(uuid,text,text)') is not null then
    execute 'revoke execute on function public.insert_crm_laverie_from_board(uuid,text,text) from anon, authenticated';
    execute 'grant execute on function public.insert_crm_laverie_from_board(uuid,text,text) to service_role';
  end if;

  if to_regprocedure('public.retry_failed_crm_laverie_links(integer)') is not null then
    execute 'revoke execute on function public.retry_failed_crm_laverie_links(integer) from anon, authenticated';
    execute 'grant execute on function public.retry_failed_crm_laverie_links(integer) to service_role';
  end if;

  if to_regprocedure('public.force_resync_all_emplacements_to_crm()') is not null then
    execute 'revoke execute on function public.force_resync_all_emplacements_to_crm() from anon, authenticated';
    execute 'grant execute on function public.force_resync_all_emplacements_to_crm() to service_role';
  end if;

  if to_regprocedure('public.refund_transaction(uuid,text)') is not null then
    execute 'revoke execute on function public.refund_transaction(uuid, text) from anon, authenticated';
    execute 'grant execute on function public.refund_transaction(uuid, text) to service_role';
  end if;

  if to_regprocedure('public.notify_mission_posted(uuid,uuid[],text)') is not null then
    execute 'revoke execute on function public.notify_mission_posted(uuid, uuid[], text) from anon, authenticated';
    execute 'grant execute on function public.notify_mission_posted(uuid, uuid[], text) to service_role';
  end if;
end $$;

-- -------------------------------------------------------------------
-- Supprimer les droits TRUNCATE client (jamais nécessaires en prod)
-- -------------------------------------------------------------------
revoke truncate on all tables in schema public from anon, authenticated;

commit;
