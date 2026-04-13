-- 1) Lier chaque recharge au PaymentIntent Stripe (repli si les métadonnées PI sont vides au remboursement).
-- 2) RPC pour solder le portefeuille après un virement manuel (hors API Remboursement Stripe).
-- Exécuter dans Supabase → SQL Editor après les autres scripts wallet.

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_stripe_payment_intent_id_key
  ON public.wallet_transactions (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Ancienne signature à 3 arguments
DROP FUNCTION IF EXISTS public.apply_wallet_recharge(uuid, integer, text);

CREATE OR REPLACE FUNCTION public.apply_wallet_recharge(
  p_user_id uuid,
  p_amount_centimes integer,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pi text;
BEGIN
  IF p_stripe_session_id IS NULL OR length(trim(p_stripe_session_id)) < 8 THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;
  IF p_amount_centimes IS NULL OR p_amount_centimes <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  v_pi := NULLIF(trim(coalesce(p_stripe_payment_intent_id, '')), '');

  INSERT INTO public.wallet_transactions (user_id, amount_centimes, type, stripe_session_id, stripe_payment_intent_id)
  VALUES (p_user_id, p_amount_centimes, 'recharge', trim(p_stripe_session_id), v_pi);

  UPDATE public.profiles
  SET wallet_balance = coalesce(wallet_balance, 0) + p_amount_centimes
  WHERE id = p_user_id;
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_recharge(uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_wallet_recharge(uuid, integer, text, text) TO service_role;

-- Compat : anciens appels à 3 args (équivalent à pi NULL)
CREATE OR REPLACE FUNCTION public.apply_wallet_recharge(
  p_user_id uuid,
  p_amount_centimes integer,
  p_stripe_session_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.apply_wallet_recharge($1, $2, $3, NULL::text);
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_recharge(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_wallet_recharge(uuid, integer, text) TO service_role;

-- Solder tout ou partie du portefeuille quand le client a été remboursé par virement / autre (pas d’événement Stripe).
-- p_external_ref : identifiant unique par opération (ex. virement-2026-04-10-victor), stocké comme manual:…
CREATE OR REPLACE FUNCTION public.apply_wallet_manual_refund(
  p_user_id uuid,
  p_amount_centimes integer,
  p_external_ref text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
BEGIN
  IF p_external_ref IS NULL OR length(trim(p_external_ref)) < 4 THEN
    RAISE EXCEPTION 'invalid_external_ref';
  END IF;
  IF p_amount_centimes IS NULL OR p_amount_centimes <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  v_id := 'manual:' || trim(p_external_ref);

  INSERT INTO public.wallet_transactions (user_id, amount_centimes, type, stripe_refund_id)
  VALUES (p_user_id, p_amount_centimes, 'refund', v_id);

  UPDATE public.profiles
  SET wallet_balance = GREATEST(0, coalesce(wallet_balance, 0) - p_amount_centimes)
  WHERE id = p_user_id;
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_manual_refund(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_wallet_manual_refund(uuid, integer, text) TO service_role;
-- Éditeur SQL Supabase (superuser) peut aussi invoquer la fonction sans GRANT explicite.

-- Exemple (remplace l’UUID : récupère-le via Table Editor → profiles, ou en SQL) :
-- SELECT id, email FROM public.profiles WHERE email ILIKE '%mortier%';
-- puis :
-- SELECT public.apply_wallet_manual_refund(
--   'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,  -- JAMAIS un texte placeholder, uniquement l’UUID réel
--   250,
--   'virement-2026-04-10-victor'
-- );
