/**
 * Service pour valider les codes promo (optionnellement par type de machine : lavage / séchage).
 */

import { supabase } from '../lib/supabase';

/**
 * @param {string} code
 * @param {string} [machineId] - UUID machine (obligatoire pour la validation en base)
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'invalid' | 'wrong_machine_type' | 'too_many_attempts' }>}
 */
export async function validateAndUsePromoCode(code, machineId) {
  if (!code?.trim()) {
    return { ok: false, reason: 'invalid' };
  }

  const trimmed = code.trim().toUpperCase();

  const envCode = process.env.EXPO_PUBLIC_PROMO_CODE?.trim().toUpperCase();
  if (envCode && trimmed === envCode) {
    return { ok: true };
  }

  if (!supabase || !machineId) {
    return { ok: false, reason: 'invalid' };
  }

  try {
    // MOYENNE #9 de l'audit : passe par l'Edge Function (limite de tentatives par IP)
    // plutôt que d'appeler la RPC use_promo_code directement.
    const { data, error } = await supabase.functions.invoke('validate-promo-code', {
      body: { p_code: trimmed, p_machine_id: machineId },
    });
    if (error) throw error;

    if (data && typeof data === 'object' && data.success === true) {
      return { ok: true };
    }
    if (data?.error === 'wrong_machine_type') {
      return { ok: false, reason: 'wrong_machine_type' };
    }
    if (data?.error === 'too_many_attempts') {
      return { ok: false, reason: 'too_many_attempts' };
    }
    return { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/**
 * Codes promo liés aux remboursements acceptés, encore utilisables (côté utilisateur connecté).
 * @returns {Promise<{ data: Array<{ code: string, uses_remaining: number }>, error: Error | null }>}
 */
export async function getUserAvailablePromoCodes() {
  if (!supabase) {
    return { data: [], error: null };
  }
  const { data, error } = await supabase.rpc('get_user_available_promo_codes');
  return { data: data || [], error };
}
