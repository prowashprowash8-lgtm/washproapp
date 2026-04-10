import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

export async function authenticateWithBiometric() {
  if (Platform.OS === 'web') return null;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authentification pour WashPro',
      fallbackLabel: 'Utiliser le code',
    });
    if (result.success) {
      const stored = await SecureStore.getItemAsync(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  } catch {
    return null;
  }
}

