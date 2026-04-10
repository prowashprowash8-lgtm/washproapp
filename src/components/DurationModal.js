import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme/colors';
import Button from './Button';
import { useLanguage } from '../context/LanguageContext';
import { MIN_DURATION_MIN, MAX_DURATION_MIN } from '../services/laundryTimerService';

export default function DurationModal({
  visible,
  onClose,
  onSubmit,
  loading,
  minMinutes = MIN_DURATION_MIN,
  maxMinutes = MAX_DURATION_MIN,
}) {
  const { t } = useLanguage();
  const [minutes, setMinutes] = useState('');

  const handleSubmit = () => {
    const n = parseInt(minutes, 10);
    if (!isNaN(n) && n >= minMinutes && n <= maxMinutes) {
      onSubmit(n);
      setMinutes('');
    }
  };

  const n = parseInt(minutes, 10);
  const isValid = !isNaN(n) && n >= minMinutes && n <= maxMinutes;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.card}>
              <View style={styles.iconWrapper}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={48}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.title}>{t('durationQuestion')}</Text>
              <Text style={styles.hint}>{t('durationHint')}</Text>
              <TextInput
                style={styles.input}
                placeholder={`${minMinutes}–${maxMinutes}`}
                placeholderTextColor={colors.textMuted}
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
                maxLength={3}
              />
              <View style={styles.buttons}>
                <Button
                  title={t('cancel')}
                  onPress={onClose}
                  variant="outline"
                  style={styles.btn}
                />
                <Button
                  title={t('validate')}
                  onPress={handleSubmit}
                  disabled={!isValid || loading}
                  loading={loading}
                  style={styles.btn}
                />
              </View>
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
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.xl,
    color: colors.text,
    textAlign: 'center',
    width: '100%',
    marginBottom: spacing.xl,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  btn: {
    flex: 1,
  },
});
