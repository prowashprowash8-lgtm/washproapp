/**
 * Service : envoyer un rappel push à l'utilisateur de la dernière
 * transaction d'une machine pour qu'il vienne récupérer son linge.
 *
 * L'envoi réel passe par l'Edge Function Supabase `pickup-reminder`,
 * qui valide la demande via la RPC `request_pickup_reminder` puis
 * envoie la notification Expo.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Mappe un code d'erreur backend vers un message utilisateur lisible.
 * Les libellés restent en français pour l'instant ; on pourra les passer
 * dans i18n plus tard.
 */
function reasonToMessage(reason) {
  switch (reason) {
    case 'cooldown':
      return 'Un rappel a déjà été envoyé récemment. Réessayez dans quelques minutes.';
    case 'cannot_notify_self':
      return 'Vous ne pouvez pas vous envoyer un rappel à vous-même.';
    case 'no_recent_transaction':
      return 'Aucun utilisateur récent à prévenir pour cette machine.';
    case 'machine_not_found':
      return 'Machine introuvable.';
    case 'recipient_not_found':
      return 'Profil utilisateur introuvable.';
    case 'no_sender':
    case 'no_session':
    case 'missing_sender':
      return 'Vous devez être connecté.';
    default:
      return 'Impossible d\'envoyer le rappel pour le moment.';
  }
}

/**
 * Envoie un rappel pour une machine donnée.
 *
 * L'app n'utilise pas Supabase Auth standard, donc on transmet
 * explicitement le `userId` du sender courant. La RPC côté SQL valide
 * l'existence du profil, le cooldown et l'anti auto-notification.
 *
 * @param {string} machineId - UUID de la machine
 * @param {string} senderUserId - UUID de l'utilisateur qui envoie le rappel
 * @returns {Promise<{
 *   success: boolean,
 *   reminderId?: string,
 *   recipientName?: string,
 *   pushSent?: number,
 *   hadTokens?: boolean,
 *   reason?: string,
 *   message?: string,
 *   error?: string
 * }>}
 */
export async function sendPickupReminder(machineId, senderUserId) {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase non configuré' };
  }
  if (!machineId) {
    return { success: false, error: 'machineId requis' };
  }
  if (!senderUserId) {
    return {
      success: false,
      reason: 'missing_sender',
      message: 'Vous devez être connecté pour envoyer un rappel.',
      error: 'missing_sender',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('pickup-reminder', {
      body: { machine_id: machineId, sender_user_id: senderUserId },
    });

    if (error) {
      // Quand l'Edge renvoie un code !=2xx, supabase-js met l'erreur ici.
      // On essaye d'en extraire le `reason` pour afficher un message propre.
      let reason = null;
      let message = error.message || 'Erreur inconnue';
      let httpStatus = null;
      const ctx = error.context;
      if (ctx) {
        httpStatus = ctx.status ?? null;
        if (typeof ctx.json === 'function') {
          try {
            const body = await ctx.json();
            if (body?.reason) {
              reason = body.reason;
              message = reasonToMessage(reason);
            } else if (body?.error) {
              message = body.error;
            }
          } catch {
            /* noop : pas de JSON exploitable */
          }
        }
      }
      console.warn('[pickupReminder] Edge function error', {
        message: error.message,
        name: error.name,
        httpStatus,
        reason,
      });
      return { success: false, reason, message, error: message, httpStatus };
    }

    if (!data || data.ok !== true) {
      const reason = data?.reason || null;
      return {
        success: false,
        reason,
        message: reasonToMessage(reason),
        error: reasonToMessage(reason),
      };
    }

    return {
      success: true,
      reminderId: data.reminder_id ?? null,
      recipientName: data.recipient_name ?? null,
      pushSent: Number(data.push_sent || 0),
      hadTokens: Boolean(data.had_tokens),
    };
  } catch (err) {
    return {
      success: false,
      message: err?.message || 'Erreur technique',
      error: err?.message || 'Erreur technique',
    };
  }
}
