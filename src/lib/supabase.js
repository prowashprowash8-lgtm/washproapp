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
// Migration #2 (audit) : persistSession volontairement à false — l'app gère elle-même la
// persistance (son propre refresh_token en SecureStore/AsyncStorage) pour ne jamais
// restaurer de session silencieusement au démarrage à froid (voir AuthContext.js) : au
// démarrage, rien n'est restauré, donc rien à auto-rafraîchir.
// autoRefreshToken reste à true (indépendant de persistSession) : une fois une session
// établie via signIn/signUp/Face ID, elle doit rester valide tant que l'app reste ouverte —
// sans ça, le jeton d'accès expire (~1h) et toutes les RPC auth.uid() échouent en silence
// ("Profil introuvable") sans que l'utilisateur soit déconnecté visuellement.
let supabaseClient = null;
if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = supabaseClient;
export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);
/** Pour appels directs (ex. Edge Functions) sans exposer la logique ailleurs */
export const getSupabasePublicConfig = () => ({ supabaseUrl, supabaseAnonKey });
