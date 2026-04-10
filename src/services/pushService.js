/**
 * Service pour enregistrer le token push Expo (notifications)
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';

function getProjectId() {
  return Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
}

/**
 * Enregistre le token push de l'utilisateur pour les notifications
 * À appeler après connexion, si l'utilisateur a autorisé les notifications
 * Note: Les notifications push ne sont pas supportées sur le web (Expo).
 */
export async function registerPushToken(userId) {
  if (!supabase || !userId) return;
  if (Platform.OS === 'web') return; // Push non supporté sur web

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[Push] projectId manquant. Lancez: npx eas init');
      return;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;
    if (!token) return;

    await supabase.from('push_tokens').upsert(
      { user_id: userId, expo_push_token: token },
      { onConflict: 'user_id,expo_push_token' }
    );
  } catch (err) {
    console.warn('[Push] registerPushToken error:', err);
  }
}

/**
 * Enregistre le token push pour recevoir les alertes admin (soumissions de missions)
 * À appeler quand l'admin veut recevoir une notif à chaque soumission
 * Note: Non disponible sur le web — utilisez l'app iOS ou Android.
 */
export async function registerMissionAlertToken() {
  if (!supabase) return { ok: false, error: 'Supabase non configuré' };
  if (Platform.OS === 'web') return { ok: false, error: 'missionAlertsWebOnly' };

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return { ok: false, error: 'Autorisation refusée' };

    const projectId = getProjectId();
    if (!projectId) return { ok: false, error: 'missionAlertsNoProjectId' };

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;
    if (!token) return { ok: false, error: 'Token non disponible' };

    const { error } = await supabase.from('mission_alert_tokens').upsert(
      { expo_push_token: token, label: 'App admin' },
      { onConflict: 'expo_push_token' }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Erreur' };
  }
}
