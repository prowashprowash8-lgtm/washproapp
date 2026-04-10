import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { showAlert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, spacing, typography, borderRadius } from '../../theme/colors';
import Button from '../../components/Button';

export default function ForgotPasswordScreen({ navigation }) {
  const { requestPasswordReset, resetPasswordWithCode } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  /** Code affiché uniquement en dev si l’Edge Function renvoie ALLOW_DEV_RESET_CODE */
  const [devCode, setDevCode] = useState(null);

  const handleRequestCode = async () => {
    if (!email.trim()) {
      showAlert(t('authGenericError'), t('authFillAllFields'));
      return;
    }
    setLoading(true);
    setDevCode(null);
    try {
      const result = await requestPasswordReset(email.trim());
      setStep(2);
      if (__DEV__ && result?.dev && result?.code != null && result.code !== '') {
        const c = String(result.code);
        setDevCode(c);
        setCode(c);
      } else {
        setCode('');
      }
    } catch (error) {
      showAlert(t('authGenericError'), error.message || t('authLoginErrorMsg'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code.trim() || !newPassword || !confirmPassword) {
      showAlert(t('authGenericError'), t('authFillAllFields'));
      return;
    }
    if (newPassword.length < 6) {
      showAlert(t('authGenericError'), t('authPasswordMin'));
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert(t('authGenericError'), t('authPasswordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithCode(email.trim(), code.trim(), newPassword);
      showAlert(t('resetPasswordChangedTitle'), t('resetPasswordChangedMsg'), [
        { text: t('ok'), onPress: () => navigation.navigate('Connexion') },
      ]);
    } catch (error) {
      showAlert(t('authGenericError'), error.message || t('authLoginErrorMsg'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  setStep(1);
                  setCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setDevCode(null);
                }}
                style={styles.backButton}
              >
                <Text style={styles.backText}>← {t('back')}</Text>
              </TouchableOpacity>
              <Text style={styles.title}>{t('resetPasswordTitle')}</Text>
              <Text style={styles.subtitle}>{t('resetPasswordStep2Subtitle')}</Text>
              <Text style={styles.hint}>{t('resetPasswordEmailSentHint')}</Text>
              {__DEV__ && devCode ? (
                <View style={styles.devCodeBox}>
                  <Text style={styles.devCodeLabel}>{t('resetPasswordDevHint')}</Text>
                  <Text style={styles.devCode}>{devCode}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>{t('resetPasswordCodeLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={styles.label}>{t('password')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('authPasswordMin')}
                placeholderTextColor={colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />

              <Text style={styles.label}>{t('confirmPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <Button
                title={loading ? '' : t('resetPasswordSubmit')}
                onPress={handleResetPassword}
                loading={loading}
                size="lg"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← {t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('resetPasswordTitle')}</Text>
          <Text style={styles.subtitle}>{t('resetPasswordStep1Subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('email')}</Text>
          <TextInput
            style={styles.input}
            placeholder="vous@exemple.fr"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Button
            title={loading ? '' : t('resetPasswordSendCode')}
            onPress={handleRequestCode}
            loading={loading}
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  title: {
    fontSize: typography.xxxl,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  hint: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  form: {
    marginTop: spacing.md,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.base,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  devCodeBox: {
    backgroundColor: colors.primary + '20',
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  devCodeLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  devCode: {
    fontSize: typography.xxl,
    fontWeight: '800',
    color: colors.primary,
  },
});
