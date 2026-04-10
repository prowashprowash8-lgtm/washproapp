import React, { createContext, useContext, useEffect, useState } from 'react';
import bcrypt from 'bcryptjs';
import * as SecureStore from 'expo-secure-store';
import { supabase, isSupabaseConfigured, getSupabasePublicConfig } from '../lib/supabase';
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

    getStoredUser().then(async (storedUser) => {
      if (storedUser?.id) {
        await migrateLegacyForUser(storedUser.id);
      }
      if (storedUser) setUser(storedUser);
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

  // Déconnexion : on garde les credentials en SecureStore pour permettre Face ID au prochain login
  const clearUserOnly = () => setUser(null);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.rpc('sign_in', {
      p_email: email.trim(),
    });
    if (error) throw error;
    if (!data) throw new Error('Email ou mot de passe incorrect');
    const valid = bcrypt.compareSync(password, data.password_hash);
    if (!valid) throw new Error('Email ou mot de passe incorrect');
    const userData = {
      id: data.id,
      email: data.email,
      user_metadata: {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || '',
      },
    };
    await migrateLegacyForUser(userData.id);
    await persistUser(userData);
    return { user: userData };
  };

  const signUp = async (email, password, metadata = {}) => {
    const passwordHash = bcrypt.hashSync(password, 10);
    const { data, error } = await supabase.rpc('sign_up', {
      p_email: email.trim(),
      p_password_hash: passwordHash,
      p_first_name: metadata.first_name || '',
      p_last_name: metadata.last_name || '',
      p_phone: metadata.phone || '',
    });
    if (error) {
      throw new Error(error.message || 'Impossible de créer le compte. Vérifiez que supabase/profiles-auth.sql a été exécuté.');
    }
    const userData = {
      id: data.id,
      email: data.email,
      user_metadata: {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || '',
      },
    };
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
   * Mot de passe oublié : Edge Function `request-password-reset` (e-mail via Resend).
   * Le code n’est pas dans la réponse en production ; en dev, `ALLOW_DEV_RESET_CODE` peut renvoyer `code`.
   */
  const requestPasswordReset = async (email) => {
    const { supabaseUrl: url, supabaseAnonKey: anon } = getSupabasePublicConfig();
    if (!url || !anon) {
      throw new Error('Supabase non configuré');
    }
    const fnUrl = `${url.replace(/\/$/, '')}/functions/v1/request-password-reset`;
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: JSON.stringify({ email: email.trim() }),
    });
    const raw = await res.text();
    let json = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = {
        error: raw
          ? `Réponse invalide (${res.status}). ${String(raw).slice(0, 200)}`
          : `Erreur HTTP ${res.status}`,
      };
    }
    if (!res.ok) {
      const base = json.error || `Erreur ${res.status}`;
      const bits = [json.detail, json.help].filter(Boolean).map((x) => String(x).slice(0, 300));
      const extra = bits.length ? `\n${bits.join('\n')}` : '';
      throw new Error(base + extra);
    }
    if (json.error) throw new Error(json.error);
    return { code: json.code, dev: Boolean(json.dev), success: Boolean(json.success) };
  };

  const resetPasswordWithCode = async (email, code, newPassword) => {
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    const { data, error } = await supabase.rpc('reset_password_with_code', {
      p_email: email.trim(),
      p_code: code.trim(),
      p_new_password_hash: passwordHash,
    });
    if (error) throw new Error(error.message || 'Erreur');
    if (!data) throw new Error('Code invalide ou expiré');
    return true;
  };

  const updateUser = async ({ first_name, last_name, email, phone } = {}) => {
    if (!user?.id) throw new Error('Non connecté');
    const { data, error } = await supabase.rpc('update_profile', {
      p_user_id: user.id,
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
    const { data, error } = await supabase.rpc('sign_in', {
      p_email: user.email.trim(),
    });
    if (error) throw error;
    if (!data?.password_hash) throw new Error('Mot de passe actuel incorrect');
    const valid = bcrypt.compareSync(currentPassword, data.password_hash);
    if (!valid) throw new Error('Mot de passe actuel incorrect');
    const newHash = bcrypt.hashSync(newPassword, 10);
    const { error: err2 } = await supabase.rpc('update_password_hash', {
      p_user_id: user.id,
      p_new_password_hash: newHash,
    });
    if (err2) throw new Error(err2.message || 'Erreur');
  };

  const signInWithBiometric = async () => {
    const { authenticateWithBiometric } = await import('../utils/biometricAuth');
    const userData = await authenticateWithBiometric();
    if (userData) {
      await migrateLegacyForUser(userData.id);
      setUser(userData);
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
