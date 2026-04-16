-- WashPro : portefeuille (montants en centimes)
-- À exécuter dans Supabase → SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_balance integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_centimes integer NOT NULL CHECK (amount_centimes > 0),
  type text NOT NULL CHECK (type IN ('recharge', 'machine_debit', 'refund')),
  stripe_session_id text UNIQUE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON public.wallet_transactions(user_id, created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet anon all" ON public.wallet_transactions;
-- Aucune policy anon : lecture/écriture uniquement via RPC (SECURITY DEFINER) ou service_role (webhook)

-- Recharge uniquement depuis le webhook (service_role) — idempotence par session Stripe
CREATE OR REPLACE FUNCTION public.apply_wallet_recharge(
  p_user_id uuid,
  p_amount_centimes integer,
  p_stripe_session_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_stripe_session_id IS NULL OR length(trim(p_stripe_session_id)) < 8 THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;
  IF p_amount_centimes IS NULL OR p_amount_centimes <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount_centimes, type, stripe_session_id)
  VALUES (p_user_id, p_amount_centimes, 'recharge', p_stripe_session_id);

  UPDATE public.profiles
  SET wallet_balance = coalesce(wallet_balance, 0) + p_amount_centimes
  WHERE id = p_user_id;
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_recharge(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_wallet_recharge(uuid, integer, text) TO service_role;

-- Paiement machine depuis le solde (client app)
CREATE OR REPLACE FUNCTION public.create_transaction_and_pay_with_wallet(
  p_user_id uuid,
  p_machine_id uuid,
  p_emplacement_id uuid,
  p_esp32_id text,
  p_amount numeric,
  p_price_centimes integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row integer;
  v_transaction_id uuid;
  v_command_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'invalid_user');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.machines m
    WHERE m.id = p_machine_id
      AND m.emplacement_id = p_emplacement_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'invalid_machine_or_emplacement');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.machines m
    WHERE m.id = p_machine_id
      AND coalesce(m.hors_service, false) = true
  ) THEN
    RETURN json_build_object('success', false, 'error', 'machine_out_of_service');
  END IF;

  IF p_price_centimes IS NULL OR p_price_centimes <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_price_centimes
  WHERE id = p_user_id
    AND coalesce(wallet_balance, 0) >= p_price_centimes;

  GET DIAGNOSTICS v_row = ROW_COUNT;
  IF v_row = 0 THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount_centimes, type, machine_id)
  VALUES (p_user_id, p_price_centimes, 'machine_debit', p_machine_id);

  INSERT INTO public.transactions (user_id, machine_id, emplacement_id, amount, payment_method, promo_code, status)
  VALUES (p_user_id, p_machine_id, p_emplacement_id, p_amount, 'wallet', null, 'completed')
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.machine_commands (esp32_id, command, status, user_id, transaction_id)
  VALUES (p_esp32_id, 'START', 'pending', p_user_id, v_transaction_id)
  RETURNING id INTO v_command_id;

  UPDATE public.transactions SET machine_command_id = v_command_id WHERE id = v_transaction_id;

  -- Marquer immédiatement la machine occupée (indépendant du minuteur app)
  UPDATE public.machines
  SET statut = 'occupe',
      estimated_end_time = null
  WHERE id = p_machine_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'machine_command_id', v_command_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_transaction_and_pay_with_wallet(uuid, uuid, uuid, text, numeric, integer) TO anon;

CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(wallet_balance, 0) FROM public.profiles WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO anon;
