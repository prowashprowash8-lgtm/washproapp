import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { translations, isSupportedLocale } from '../i18n/translations';

const LANG_STORAGE_KEY = 'washpro_lang';

const storage = Platform.OS === 'web'
  ? {
    getItem: (key) => Promise.resolve(typeof window !== 'undefined' ? localStorage.getItem(key) : null),
    setItem: (key, value) => Promise.resolve(typeof window !== 'undefined' ? localStorage.setItem(key, value) : undefined),
  }
  : AsyncStorage;

const LanguageContext = createContext({});

function translate(locale, key) {
  const pack = translations[locale];
  if (pack && pack[key] != null) return pack[key];
  if (translations.en && translations.en[key] != null) return translations.en[key];
  if (translations.fr && translations.fr[key] != null) return translations.fr[key];
  return key;
}

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('fr');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.getItem(LANG_STORAGE_KEY).then((stored) => {
      if (stored && isSupportedLocale(stored)) {
        setLocale(stored);
      }
      setLoading(false);
    });
  }, []);

  const setLanguage = async (lang) => {
    if (!isSupportedLocale(lang)) return;
    setLocale(lang);
    await storage.setItem(LANG_STORAGE_KEY, lang);
  };

  const t = useCallback(
    (key) => translate(locale, key),
    [locale],
  );

  return (
    <LanguageContext.Provider value={{ locale, setLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
