/**
 * Service pour les transactions par utilisateur
 * Enregistre chaque paiement/démarrage machine pour le suivi et les remboursements
 */

import { supabase } from '../lib/supabase';

function normalizeEsp32Id(value) {
  const raw = value == null ? '' : String(value);
  return raw.trim().toUpperCase();
}

/**
 * Crée une transaction et envoie la commande de démarrage à l'ESP32
 * @param {object} params
 * @param {string} params.userId - ID du profil utilisateur
 * @param {string} params.machineId - ID de la machine
 * @param {string} params.emplacementId - ID de l'emplacement
 * @param {string} params.esp32Id - ID de l'ESP32 (ex: WASH_PRO_001)
 * @param {number} params.amount - Montant payé
 * @param {string} params.paymentMethod - 'promo' ou 'card'
 * @param {string} [params.promoCode] - Code promo utilisé si applicable
 */
export async function createTransactionAndStartMachine({
  userId,
  machineId,
  emplacementId,
  esp32Id,
  amount = 0,
  paymentMethod = 'promo',
  promoCode = null,
}) {
  const normalizedEsp32Id = normalizeEsp32Id(esp32Id);
  if (!supabase || !userId || !machineId || !emplacementId || !normalizedEsp32Id) {
    return { success: false, error: 'Paramètres manquants' };
  }

  const { data, error } = await supabase.rpc('create_transaction_and_start_machine', {
    p_user_id: userId,
    p_machine_id: machineId,
    p_emplacement_id: emplacementId,
    p_esp32_id: normalizedEsp32Id,
    p_amount: amount,
    p_payment_method: paymentMethod,
    p_promo_code: promoCode,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, transactionId: data?.transaction_id };
}

/**
 * Débite le portefeuille puis crée la transaction + commande machine (RPC atomique)
 * @param {object} params
 * @param {number} params.priceCentimes - Montant à débiter (centimes)
 */
export async function createTransactionAndPayWithWallet({
  userId,
  machineId,
  emplacementId,
  esp32Id,
  amount,
  priceCentimes,
}) {
  const normalizedEsp32Id = normalizeEsp32Id(esp32Id);
  if (!supabase || !userId || !machineId || !emplacementId || !normalizedEsp32Id) {
    return { success: false, error: 'Paramètres manquants' };
  }

  const { data, error } = await supabase.rpc('create_transaction_and_pay_with_wallet', {
    p_user_id: userId,
    p_machine_id: machineId,
    p_emplacement_id: emplacementId,
    p_esp32_id: normalizedEsp32Id,
    p_amount: amount,
    p_price_centimes: priceCentimes,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data && typeof data === 'object' && data.success === false) {
    const err = data.error === 'insufficient_balance' ? 'insufficient_balance' : (data.error || 'error');
    return { success: false, error: err };
  }

  return { success: true, transactionId: data?.transaction_id };
}

/**
 * Enregistre la durée du cycle après paiement (popup "Combien de minutes ?")
 * Met à jour transactions.estimated_end_time et machines.statut = occupied
 */
export async function setTransactionDuration(transactionId, minutes) {
  if (!supabase || !transactionId || !minutes || minutes < 1 || minutes > 300) {
    return { success: false, error: 'Paramètres invalides' };
  }

  const { data, error } = await supabase.rpc('set_transaction_duration', {
    p_transaction_id: transactionId,
    p_minutes: minutes,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: data === true };
}

/**
 * Récupère les transactions d'un utilisateur (avec noms machine et emplacement)
 */
export async function getUserTransactions(userId) {
  if (!supabase || !userId) return { data: [], error: null };

  const { data, error } = await supabase.rpc('get_user_transactions', {
    p_user_id: userId,
  });

  return { data: data || [], error };
}
