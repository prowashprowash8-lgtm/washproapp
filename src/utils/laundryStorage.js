import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Ancienne clé globale (tous les comptes voyaient la même laverie) */
const LEGACY_KEY = 'saved_laundry';

const storage = Platform.OS === 'web'
  ? {
      getItem: (k) => Promise.resolve(typeof window !== 'undefined' ? localStorage.getItem(k) : null),
      setItem: (k, v) => Promise.resolve(typeof window !== 'undefined' ? localStorage.setItem(k, v) : undefined),
      removeItem: (k) => Promise.resolve(typeof window !== 'undefined' ? localStorage.removeItem(k) : undefined),
    }
  : AsyncStorage;

function keyForUser(userId) {
  return `saved_laundry_${userId}`;
}

/**
 * Laverie mémorisée par compte. Sans userId → aucune laverie (première utilisation).
 */
export async function getSavedLaundry(userId) {
  if (!userId) return null;
  try {
    const raw = await storage.getItem(keyForUser(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveLaundry(userId, emplacement, machines) {
  if (!userId) return;
  try {
    await storage.setItem(
      keyForUser(userId),
      JSON.stringify({ emplacement, machines: machines || [] })
    );
  } catch (e) {
    console.warn('saveLaundry:', e);
  }
}

export async function clearSavedLaundry(userId) {
  if (!userId) return;
  try {
    await storage.removeItem(keyForUser(userId));
  } catch (e) {
    console.warn('clearSavedLaundry:', e);
  }
}

/**
 * À l’inscription : supprime l’ancienne clé globale pour qu’un nouveau compte
 * ne récupère pas la laverie d’un autre usage sur le même téléphone.
 */
export async function clearLegacySavedLaundry() {
  try {
    await storage.removeItem(LEGACY_KEY);
  } catch (e) {
    console.warn('clearLegacySavedLaundry:', e);
  }
}

/**
 * Après connexion ou au chargement du profil : copie l’ancienne clé globale
 * vers la clé du compte connecté (une seule fois), puis supprime la globale.
 */
export async function migrateLegacyForUser(userId) {
  if (!userId) return;
  try {
    const legacy = await storage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const userKey = keyForUser(userId);
    const existing = await storage.getItem(userKey);
    if (!existing) {
      await storage.setItem(userKey, legacy);
    }
    await storage.removeItem(LEGACY_KEY);
  } catch (e) {
    console.warn('migrateLegacyForUser:', e);
  }
}
