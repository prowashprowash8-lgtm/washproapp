import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLegacySavedLaundry, migrateLegacyForUser } from '../utils/laundryStorage';

const USER_STORAGE_KEY = 'washpro_user';

const storage = Platform.OS === 'web'
  ? {
      getItem: (key) => Promise.resolve(typeof window !== 'undefined' ? localStorage.getItem(key) : null),
      setItem: (key, value) => Promise.resolve(typeof window !== 'undefined' ? localStorage.setItem(key, value) : undefined),
      removeItem: (key) => Promise.resolve(typeof window !== 'undefined' ? localStorage.removeItem(key) : undefined),
    }
  : AsyncStorage;

async function getStoredUser() {
  if (Platform.OS === 'web') {
    const stored = await storage.getItem(USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }
  try {
    const stored = await SecureStore.getItemAsync(USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    const stored = await storage.getItem(USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }
}

/**
 * Migration #2 (audit) : profiles reste la source de vérité pour prénom/nom/téléphone
 * (auth.users.user_metadata n'est mis à jour qu'à l'inscription, pas après update_profile).
 */
async function fetchProfile(uid) {
  const { data } = await supabase
    .from('profiles')
    .select('email, first_name, last_name, phone')
    .eq('id', uid)
    .maybeSingle();
  return data;
}

function buildUserData(session, profile) {
  return {
    id: session.user.id,
    email: profile?.email || session.user.email,
    refresh_token: session.refresh_token,
    user_metadata: {
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      phone: profile?.phone || '',
    },
  };
}

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());

    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // Migration #2 (audit) : on ne restaure JAMAIS la session automatiquement ici — l'app
    // affiche toujours l'écran de connexion au démarrage à froid. Le blob stocké ne sert
    // qu'à savoir si le bouton Face ID doit s'afficher (voir biometricAuth.js) et à migrer
    // les anciennes données locales.
    getStoredUser().then(async (storedUser) => {
      if (storedUser?.id) {
        await migrateLegacyForUser(storedUser.id);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user?.id && Platform.OS !== 'web') {
      import('../services/pushService').then(({ registerPushToken }) => {
        registerPushToken(user.id);
      });
    }
  }, [user?.id]);

  const persistUser = async (userData) => {
    if (userData) {
      const json = JSON.stringify(userData);
      if (Platform.OS === 'web') {
        await storage.setItem(USER_STORAGE_KEY, json);
      } else {
        await SecureStore.setItemAsync(USER_STORAGE_KEY, json);
      }
      setUser(userData);
    } else {
      if (Platform.OS === 'web') {
        await storage.removeItem(USER_STORAGE_KEY);
      } else {
        await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
      }
      setUser(null);
    }
  };

  // Déconnexion "douce" : on garde le refresh_token en SecureStore pour permettre Face ID
  // au prochain lancement — supabase.auth.signOut() révoquerait ce refresh_token côté
  // serveur (y compris en scope 'local'), ce qui casserait Face ID. Comportement identique
  // à avant la migration : rien n'est invalidé côté serveur à la déconnexion.
  const clearUserOnly = () => setUser(null);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error('Email ou mot de passe incorrect');
    if (!data?.session) throw new Error('Email ou mot de passe incorrect');

    const profile = await fetchProfile(data.session.user.id);
    const userData = buildUserData(data.session, profile);
    await migrateLegacyForUser(userData.id);
    await persistUser(userData);
    return { user: userData };
  };

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          first_name: metadata.first_name || '',
          last_name: metadata.last_name || '',
          phone: metadata.phone || '',
        },
      },
    });
    if (error) {
      throw new Error(error.message || 'Impossible de créer le compte.');
    }
    if (!data?.session) {
      // "Confirm email" est activé côté projet Supabase : pas de session immédiate.
      throw new Error(
        'Compte créé, mais aucune session retournée. Vérifie que "Confirm email" est désactivé dans Supabase → Authentication → Providers.'
      );
    }

    const profile = await fetchProfile(data.session.user.id);
    const userData = buildUserData(data.session, profile);
    await clearLegacySavedLaundry();
    await persistUser(userData);
    return { user: userData };
  };

  const signOut = async () => {
    if (Platform.OS === 'web') {
      await persistUser(null);
    } else {
      clearUserOnly();
    }
  };

  /**
   * Mot de passe oublié : OTP natif Supabase Auth (code à 6 chiffres par email), au lieu
   * de la table maison password_reset_codes (migration #2 de l'audit).
   */
  const requestPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) throw new Error(error.message || 'Erreur');
    return { success: true };
  };

  const resetPasswordWithCode = async (email, code, newPassword) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    if (error) throw new Error('Code invalide ou expiré');
    if (!data?.session) throw new Error('Code invalide ou expiré');

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updateErr) throw new Error(updateErr.message || 'Erreur');

    // Ne pas connecter automatiquement : l'utilisateur repasse par l'écran de connexion
    // normal avec son nouveau mot de passe (cohérent avec "pas de reconnexion silencieuse").
    return true;
  };

  const updateUser = async ({ first_name, last_name, email, phone } = {}) => {
    if (!user?.id) throw new Error('Non connecté');
    const { data, error } = await supabase.rpc('update_profile', {
      p_first_name: first_name ?? user?.user_metadata?.first_name ?? '',
      p_last_name: last_name ?? user?.user_metadata?.last_name ?? '',
      p_email: (email ?? user.email ?? '').trim(),
      p_phone: (phone ?? user?.user_metadata?.phone ?? '').trim(),
    });
    if (error) throw error;
    let row = data;
    if (typeof data === 'string') {
      try {
        row = JSON.parse(data);
      } catch {
        row = null;
      }
    }
    if (!row?.email) throw new Error('Profil introuvable');
    const userData = {
      ...user,
      email: row.email,
      user_metadata: {
        first_name: row.first_name,
        last_name: row.last_name,
        phone: row.phone || '',
      },
    };
    await persistUser(userData);
    return { user: userData };
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!user?.id || !user?.email) throw new Error('Non connecté');
    // Re-vérifie le mot de passe actuel via une vraie connexion (Supabase Auth ne le
    // redemande pas pour updateUser() puisque la session est déjà authentifiée) — préserve
    // le même niveau de sécurité qu'avant la migration.
    const { data: reauth, error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reauthErr || !reauth?.session) {
      throw new Error('Mot de passe actuel incorrect');
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message || 'Erreur');

    await persistUser({ ...user, refresh_token: reauth.session.refresh_token });
  };

  const signInWithBiometric = async () => {
    const { authenticateWithBiometric } = await import('../utils/biometricAuth');
    const userData = await authenticateWithBiometric();
    if (userData) {
      await migrateLegacyForUser(userData.id);
      await persistUser(userData);
      return { user: userData };
    }
    throw new Error('Authentification annulée ou échouée');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session: user ? { user } : null,
        loading,
        configured,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        resetPasswordWithCode,
        signInWithBiometric,
        updateUser,
        changePassword,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
