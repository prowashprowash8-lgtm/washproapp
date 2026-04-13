-- Remboursement Stripe d'une recharge portefeuille : synchroniser le solde interne
-- Appelée par l’Edge Function stripe-webhook sur l’événement refund.created
-- Exécuter dans Supabase → SQL Editor (une fois)

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS stripe_refund_id text;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_stripe_refund_id_key
  ON public.wallet_transactions (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_wallet_stripe_refund(
  p_user_id uuid,
  p_amount_centimes integer,
  p_stripe_refund_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_stripe_refund_id IS NULL OR length(trim(p_stripe_refund_id)) < 8 THEN
    RAISE EXCEPTION 'invalid_refund_id';
  END IF;
  IF p_amount_centimes IS NULL OR p_amount_centimes <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount_centimes, type, stripe_refund_id)
  VALUES (p_user_id, p_amount_centimes, 'refund', trim(p_stripe_refund_id));

  UPDATE public.profiles
  SET wallet_balance = GREATEST(0, coalesce(wallet_balance, 0) - p_amount_centimes)
  WHERE id = p_user_id;
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_stripe_refund(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_wallet_stripe_refund(uuid, integer, text) TO service_role;
