/**
 * Solde portefeuille (centimes) — lecture via RPC sécurisée
 */

import { supabase } from '../lib/supabase';

/**
 * Migration #2 (audit) : l'identité vient de la session Supabase Auth (auth.uid()),
 * plus besoin de passer userId/sessionToken.
 * @returns {Promise<{ balanceCentimes: number, error: Error | null }>}
 */
export async function getWalletBalance() {
  if (!supabase) {
    return { balanceCentimes: 0, error: null };
  }
  const { data, error } = await supabase.rpc('get_wallet_balance');
  if (error) {
    return { balanceCentimes: 0, error };
  }
  return { balanceCentimes: Math.max(0, Number(data) || 0), error: null };
}

/**
 * Mouvements portefeuille (recharges, remboursements Stripe, débits cycle) — RPC get_user_wallet_activity
 * @returns {Promise<{ lines: Array<{ id: string, activity_kind: string, amount_centimes: number, created_at: string, ref_hint?: string }>, error: Error | null }>}
 */
export async function getWalletActivity() {
  if (!supabase) {
    return { lines: [], error: null };
  }
  const { data, error } = await supabase.rpc('get_user_wallet_activity');
  if (error) {
    return { lines: [], error };
  }
  const raw = Array.isArray(data) ? data : data != null ? [data] : [];
  const lines = raw.map((row) => ({
    id: String(row.id),
    activity_kind: String(row.activity_kind || ''),
    amount_centimes: Math.max(0, Number(row.amount_centimes) || 0),
    created_at: String(row.created_at || ''),
    ref_hint: row.ref_hint ? String(row.ref_hint) : '',
  }));
  return { lines, error: null };
}
