require('dotenv').config();

const VAPID_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ||
  'BMM4HtS4VkKnK4o96Qxv35gzXXcACoXEzmkH086EguUAPRvr2UxiMXT3x-FOp2CIz2gjwAZbzrlmy2jAMbqVPmQ';

/** Config unique (plus de app.json) — évite les avertissements Expo et les doublons. */
module.exports = {
  expo: {
    name: 'WashPro',
    slug: 'washproapp',
    scheme: 'washproapp',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0066CC',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#0066CC',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-web-browser',
      'expo-notifications',
      'expo-font',
      'expo-secure-store',
      [
        'expo-local-authentication',
        { faceIDPermission: 'WashPro utilise Face ID pour une connexion rapide et sécurisée.' },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'WashPro a besoin d\'accéder à vos photos pour envoyer les preuves des missions.',
          cameraPermission: 'WashPro a besoin d\'accéder à la caméra pour prendre des photos des missions.',
        },
      ],
    ],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
      /** Web push (VAPID) — ne pas mettre sous expo.notification (schéma SDK 54) */
      vapidPublicKey: VAPID_PUBLIC_KEY,
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || process.env.EAS_PROJECT_ID,
      },
    },
  },
};
