/**
 * Traductions par code court (AsyncStorage / profil).
 * Pour ajouter une langue : nouveau fichier dans bundles/, l’importer ici,
 * l’ajouter à SUPPORTED_LOCALES, à LANGUAGE_OPTIONS (ProfileScreen) et à DATE_LOCALE_BY_APP (TransactionScreen).
 */
import fr from './bundles/fr';
import en from './bundles/en';
import de from './bundles/de';
import it from './bundles/it';
import zh from './bundles/zh';
import es from './bundles/es';

export const translations = {
  fr,
  en,
  de,
  it,
  zh,
  es,
};

/** Codes ISO courts utilisés dans l’app et AsyncStorage */
export const SUPPORTED_LOCALES = ['fr', 'en', 'de', 'it', 'zh', 'es'];

export function isSupportedLocale(code) {
  return typeof code === 'string' && SUPPORTED_LOCALES.includes(code);
}
