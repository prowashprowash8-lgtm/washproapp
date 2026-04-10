/**
 * Solde portefeuille (centimes) — lecture via RPC sécurisée
 */

import { supabase } from '../lib/supabase';

/**
 * @param {string} userId
 * @returns {Promise<{ balanceCentimes: number, error: Error | null }>}
 */
export async function getWalletBalance(userId) {
  if (!supabase || !userId) {
    return { balanceCentimes: 0, error: null };
  }
  const { data, error } = await supabase.rpc('get_wallet_balance', {
    p_user_id: userId,
  });
  if (error) {
    return { balanceCentimes: 0, error };
  }
  return { balanceCentimes: Math.max(0, Number(data) || 0), error: null };
}
