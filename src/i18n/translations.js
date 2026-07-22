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
import pt from './bundles/pt';
import ar from './bundles/ar';
import ru from './bundles/ru';
import ja from './bundles/ja';
import ko from './bundles/ko';
import hi from './bundles/hi';
import tr from './bundles/tr';
import nl from './bundles/nl';
import pl from './bundles/pl';
import sv from './bundles/sv';
import el from './bundles/el';
import uk from './bundles/uk';
import th from './bundles/th';
import vi from './bundles/vi';
import id from './bundles/id';
import ro from './bundles/ro';
import cs from './bundles/cs';
import hu from './bundles/hu';
import da from './bundles/da';
import fi from './bundles/fi';
import no from './bundles/no';
import he from './bundles/he';
import tl from './bundles/tl';
import bn from './bundles/bn';

export const translations = {
  fr,
  en,
  de,
  it,
  zh,
  es,
  pt,
  ar,
  ru,
  ja,
  ko,
  hi,
  tr,
  nl,
  pl,
  sv,
  el,
  uk,
  th,
  vi,
  id,
  ro,
  cs,
  hu,
  da,
  fi,
  no,
  he,
  tl,
  bn,
};

/** Codes ISO courts utilisés dans l’app et AsyncStorage */
export const SUPPORTED_LOCALES = [
  'fr', 'en', 'de', 'it', 'zh', 'es',
  'pt', 'ar', 'ru', 'ja', 'ko', 'hi', 'tr', 'nl', 'pl', 'sv',
  'el', 'uk', 'th', 'vi', 'id', 'ro', 'cs', 'hu', 'da', 'fi',
  'no', 'he', 'tl', 'bn',
];

export function isSupportedLocale(code) {
  return typeof code === 'string' && SUPPORTED_LOCALES.includes(code);
}
