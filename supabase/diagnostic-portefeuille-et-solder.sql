-- =============================================================================
-- 1) DIAGNOSTIC : voir le solde réel en base (c’est ce que lisent l’app et le board)
-- Remplace l’email par celui du compte (même compte que la connexion à l’app).
-- =============================================================================
SELECT id,
       email,
       wallet_balance AS solde_centimes,
       (wallet_balance / 100.0) AS solde_euros
FROM public.profiles
WHERE email ILIKE '%remplace-partie-email%'
ORDER BY created_at DESC
LIMIT 5;

-- Historique portefeuille pour un user (remplace l’UUID après la requête ci-dessus)
-- SELECT type, amount_centimes, stripe_session_id, stripe_refund_id, stripe_payment_intent_id, created_at
-- FROM public.wallet_transactions
-- WHERE user_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid
-- ORDER BY created_at DESC;

-- =============================================================================
-- 2) SOLDER 2,50 € : à lancer UNE FOIS (pas le gros fichier de migration !)
-- Un seul email doit correspondre ; sinon adapte la clause WHERE.
-- Le 3e texte doit être unique par opération ; si tu relances la même ligne, rien ne change (idempotent).
-- =============================================================================
-- Décommente et mets le bon email :
/*
SELECT public.apply_wallet_manual_refund(
  (SELECT id FROM public.profiles WHERE lower(trim(email)) = lower(trim('client@exemple.com')) LIMIT 1),
  250,
  'solder-manuel-2026-04-10-unique-1'
);
*/

-- Vérifier juste après :
/*
SELECT wallet_balance FROM public.profiles WHERE lower(trim(email)) = lower(trim('client@exemple.com'));
*/
