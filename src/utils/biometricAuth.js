import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const USER_STORAGE_KEY = 'washpro_user';

export async function isBiometricAvailable() {
  if (Platform.OS === 'web') return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function hasStoredCredentials() {
  if (Platform.OS === 'web') return false;
  try {
    const stored = await SecureStore.getItemAsync(USER_STORAGE_KEY);
    return !!stored;
  } catch {
    return false;
  }
}

/**
 * Migration #2 (audit) : après succès Face ID, échange le refresh_token stocké contre une
 * vraie session Supabase Auth (au lieu de relire le blob local sans aucune vérification).
 */
export async function authenticateWithBiometric() {
  if (Platform.OS === 'web') return null;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authentification pour WashPro',
      fallbackLabel: 'Utiliser le code',
    });
    if (!result.success) return null;

    const stored = await SecureStore.getItemAsync(USER_STORAGE_KEY);
    if (!stored) return null;
    const cached = JSON.parse(stored);
    if (!cached?.refresh_token) return null;

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: cached.refresh_token,
    });
    if (error || !data?.session) {
      // Jeton expiré/révoqué : on efface le blob pour ne pas garder un bouton Face ID mort.
      await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
      return null;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, first_name, last_name, phone')
      .eq('id', data.session.user.id)
      .maybeSingle();

    return {
      id: data.session.user.id,
      email: profile?.email || data.session.user.email,
      refresh_token: data.session.refresh_token,
      user_metadata: {
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        phone: profile?.phone || '',
      },
    };
  } catch {
    return null;
  }
}
