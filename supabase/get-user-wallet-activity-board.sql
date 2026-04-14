-- Activité portefeuille (recharges, remboursements Stripe, débits machine) pour le board admin + app
-- Exécuter dans Supabase → SQL Editor (une fois)
-- Colonnes optionnelles : sans elles la fonction peut échouer à l’exécution sur certaines bases.

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS stripe_refund_id text;
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

DROP FUNCTION IF EXISTS public.get_user_wallet_activity(uuid);

CREATE OR REPLACE FUNCTION public.get_user_wallet_activity(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  activity_kind text,
  amount_centimes integer,
  created_at timestamptz,
  ref_hint text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wt.id,
    CASE wt.type
      WHEN 'recharge' THEN 'wallet_recharge'
      WHEN 'refund' THEN 'wallet_refund'
      WHEN 'machine_debit' THEN 'wallet_machine_debit'
      ELSE 'wallet_unknown'
    END AS activity_kind,
    wt.amount_centimes,
    wt.created_at,
    left(
      trim(
        coalesce(
          nullif(trim(wt.stripe_refund_id), ''),
          nullif(trim(wt.stripe_session_id), ''),
          nullif(trim(wt.stripe_payment_intent_id), ''),
          ''
        )
      ),
      64
    ) AS ref_hint
  FROM public.wallet_transactions wt
  WHERE wt.user_id = p_user_id
  ORDER BY wt.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_user_wallet_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_wallet_activity(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_wallet_activity(uuid) TO authenticated;
