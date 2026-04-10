import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra || {};
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || extra.supabaseUrl || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '';

// Sur le web, utiliser localStorage ; sur mobile, AsyncStorage
const storage = Platform.OS === 'web' 
  ? {
      getItem: (key) => Promise.resolve(typeof window !== 'undefined' ? localStorage.getItem(key) : null),
      setItem: (key, value) => Promise.resolve(typeof window !== 'undefined' ? localStorage.setItem(key, value) : undefined),
      removeItem: (key) => Promise.resolve(typeof window !== 'undefined' ? localStorage.removeItem(key) : undefined),
    }
  : AsyncStorage;

// Créer le client uniquement si configuré (évite les erreurs avec URL vide)
let supabaseClient = null;
if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
}

export const supabase = supabaseClient;
export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);
/** Pour appels directs (ex. Edge Functions) sans exposer la logique ailleurs */
export const getSupabasePublicConfig = () => ({ supabaseUrl, supabaseAnonKey });
