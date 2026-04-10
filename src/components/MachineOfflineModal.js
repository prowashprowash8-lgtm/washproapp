import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme/colors';
import Button from '../components/Button';
import { useLanguage } from '../context/LanguageContext';

export default function MachineOfflineModal({ visible, onClose, onRetry, onForce }) {
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.iconWrapper}>
                <MaterialCommunityIcons
                  name="power-plug-outline"
                  size={48}
                  color={colors.warning}
                />
              </View>
              <Text style={styles.message}>
                {t('ensureMachineOn')}
              </Text>
              {onRetry && (
                <Button
                  title={t('retry')}
                  onPress={onRetry}
                  style={styles.button}
                />
              )}
              {onForce && (
                <Button
                  title={t('continueAnyway')}
                  onPress={onForce}
                  variant="outline"
                  style={[styles.button, styles.buttonSecondary]}
                />
              )}
              <Button
                title={t('ok')}
                onPress={onClose}
                variant={onRetry || onForce ? 'outline' : 'primary'}
                style={[styles.button, (onRetry || onForce) && styles.buttonSecondary]}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 340,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.warning}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  message: {
    fontSize: typography.lg,
    fontWeight: typography.medium,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing.xl,
  },
  button: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  buttonSecondary: {
    marginBottom: 0,
  },
});
