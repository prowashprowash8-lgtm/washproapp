import { Alert, Platform } from 'react-native';

/**
 * Alerte compatible web (Alert.alert ne fonctionne pas sur le web)
 */
export function showAlert(title, message, options = []) {
  if (Platform.OS === 'web') {
    const fullMessage = [title, message].filter(Boolean).join('\n\n');
    const cancelBtn = options.find((o) => o.style === 'cancel');
    const confirmBtn = options.find((o) => o.style !== 'cancel') || options[0];

    if (cancelBtn && confirmBtn) {
      // Deux boutons : Annuler / Confirmer
      const result = window.confirm(fullMessage);
      if (result) {
        confirmBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
    } else {
      // Un seul bouton
      window.alert(fullMessage);
      confirmBtn?.onPress?.();
    }
  } else {
    Alert.alert(title, message, options);
  }
}
