/**
 * Service pour valider les codes promo (optionnellement par type de machine : lavage / séchage).
 */

import { supabase } from '../lib/supabase';

/**
 * @param {string} code
 * @param {string} [machineId] - UUID machine (obligatoire pour la validation en base)
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'invalid' | 'wrong_machine_type' }>}
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
    const { data, error } = await supabase.rpc('use_promo_code', {
      p_code: trimmed,
      p_machine_id: machineId,
    });
    if (error) throw error;

    if (data && typeof data === 'object' && data.success === true) {
      return { ok: true };
    }
    if (data?.error === 'wrong_machine_type') {
      return { ok: false, reason: 'wrong_machine_type' };
    }
    return { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
