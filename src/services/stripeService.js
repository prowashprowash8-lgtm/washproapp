/**
 * Service Stripe - crée une session Checkout et ouvre l'URL de paiement
 */

import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Crée une session Stripe Checkout et ouvre l'URL de paiement.
 * Le webhook `stripe-webhook` enregistre la transaction + envoie START à l’ESP32
 * si user_id, machine_id et emplacement_id sont fournis.
 *
 * @param {Object} params
 * @param {number} params.amount - Montant en euros (ex: 3.00)
 * @param {string} params.machineName - Nom de la machine
 * @param {string} params.esp32Id - ID de l'ESP32
 * @param {string} params.userId - UUID profil (obligatoire pour l’historique + webhook)
 * @param {string} params.machineId - UUID machine
 * @param {string} params.emplacementId - UUID emplacement
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function createCheckoutAndPay({
  amount,
  machineName,
  esp32Id,
  userId,
  machineId,
  emplacementId,
}) {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' };
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const successUrl = `${baseUrl}/functions/v1/payment-success`;
  const cancelUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'washproapp://';

  const payload = {
    amount: Number(amount) || 0,
    machineName: machineName || 'Machine',
    esp32_id: esp32Id || '',
    user_id: userId || '',
    machine_id: machineId || '',
    emplacement_id: emplacementId || '',
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  try {
    let data = null;
    let error = null;

    const invokeResult = await supabase.functions.invoke('create-checkout', { body: payload });
    data = invokeResult.data;
    error = invokeResult.error;

    // Secours si le client Supabase échoue (réseau / navigateur) : fetch directe vers l’Edge Function
    const invokeMsg = error?.message || '';
    if (
      error &&
      (invokeMsg.includes('Failed to send') ||
        invokeMsg.includes('fetch') ||
        invokeMsg.includes('Edge Function'))
    ) {
      if (!baseUrl || !anonKey) {
        return {
          success: false,
          error:
            'Supabase non configuré (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY). Redémarrez Expo après modification du .env.',
        };
      }
      try {
        const res = await fetch(`${baseUrl}/functions/v1/create-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let parsed = {};
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch {
          parsed = { error: text };
        }
        if (!res.ok) {
          error = {
            message:
              parsed.error ||
              parsed.message ||
              `HTTP ${res.status} — vérifiez que la fonction create-checkout est déployée (supabase functions deploy create-checkout).`,
          };
        } else {
          data = parsed;
          error = null;
        }
      } catch (fetchErr) {
        error = {
          message:
            fetchErr?.message ||
            'Impossible de joindre Supabase. Déployez create-checkout et vérifiez STRIPE_SECRET_KEY dans Edge Functions → Secrets.',
        };
      }
    }

    if (error) {
      return { success: false, error: typeof error.message === 'string' ? error.message : invokeMsg };
    }
    if (data?.error) {
      return { success: false, error: data.error };
    }
    if (!data?.url) {
      return { success: false, error: 'URL Stripe manquante' };
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(data.url, '_blank');
      return { success: true };
    }

    // iOS / Android : Safari / Chrome **dans l’app** (vue intégrée), pas le navigateur système
    try {
      await WebBrowser.openBrowserAsync(data.url);
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message || 'Impossible d\'ouvrir le paiement' };
    }
  } catch (err) {
    return { success: false, error: err?.message || 'Erreur' };
  }
}

/**
 * Recharge du portefeuille (Stripe Checkout) — le webhook crédite wallet_balance
 * @param {Object} params
 * @param {string} params.userId - UUID profil
 * @param {number} params.amountEur - Montant en euros (ex: 20)
 */
export async function createWalletCheckout({ userId, amountEur }) {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' };
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const successUrl = `${baseUrl}/functions/v1/payment-success`;
  const cancelUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'washproapp://';

  const payload = {
    amount: Number(amountEur) || 0,
    checkout_kind: 'wallet_recharge',
    machineName: 'Recharge portefeuille',
    user_id: userId || '',
    esp32_id: '',
    machine_id: '',
    emplacement_id: '',
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  // Compat ancienne Edge Function create-checkout (sans checkout_kind explicite).
  const legacyPayload = {
    amount: Number(amountEur) || 0,
    machineName: 'Recharge portefeuille',
    user_id: userId || '',
    esp32_id: '',
    machine_id: '',
    emplacement_id: '',
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  try {
    let data = null;
    let error = null;

    const invokeResult = await supabase.functions.invoke('create-checkout', { body: payload });
    data = invokeResult.data;
    error = invokeResult.error;

    const invokeMsg = error?.message || '';
    if (
      error &&
      (invokeMsg.includes('Failed to send') ||
        invokeMsg.includes('fetch') ||
        invokeMsg.includes('Edge Function'))
    ) {
      if (!baseUrl || !anonKey) {
        return {
          success: false,
          error:
            'Supabase non configuré (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).',
        };
      }
      try {
        const res = await fetch(`${baseUrl}/functions/v1/create-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let parsed = {};
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch {
          parsed = { error: text };
        }
        if (!res.ok) {
          error = {
            message:
              parsed.error ||
              parsed.message ||
              `HTTP ${res.status}`,
          };
        } else {
          data = parsed;
          error = null;
        }
      } catch (fetchErr) {
        error = {
          message: fetchErr?.message || 'Impossible de joindre Supabase.',
        };
      }
    }

    if (error) {
      // Fallback legacy: certains déploiements plus anciens rejettent checkout_kind.
      try {
        const legacyResult = await supabase.functions.invoke('create-checkout', { body: legacyPayload });
        if (!legacyResult.error && legacyResult.data?.url) {
          data = legacyResult.data;
          error = null;
        }
      } catch {
        // On garde l'erreur initiale
      }
    }

    if (error) {
      return { success: false, error: typeof error.message === 'string' ? error.message : invokeMsg };
    }
    if (data?.error) {
      return { success: false, error: data.error };
    }
    if (!data?.url) {
      return { success: false, error: 'URL Stripe manquante' };
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(data.url, '_blank');
      return { success: true };
    }

    try {
      await WebBrowser.openBrowserAsync(data.url);
      return { success: true };
    } catch (e) {
      try {
        const can = await Linking.canOpenURL(data.url);
        if (can) {
          await Linking.openURL(data.url);
          return { success: true };
        }
      } catch {
        // no-op
      }
      return { success: false, error: e?.message || 'Impossible d\'ouvrir le paiement' };
    }
  } catch (err) {
    return { success: false, error: err?.message || 'Erreur' };
  }
}

