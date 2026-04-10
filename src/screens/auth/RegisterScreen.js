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
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import Button from '../../components/Button';
import AuthLanguageBar from '../../components/AuthLanguageBar';

export default function RegisterScreen({ navigation }) {
  const { t } = useLanguage();
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim() || !password) {
      showAlert(t('authGenericError'), t('authFillAllFields'));
      return;
    }
    if (password.length < 6) {
      showAlert(t('authGenericError'), t('authPasswordMin'));
      return;
    }
    if (password !== confirmPassword) {
      showAlert(t('authGenericError'), t('authPasswordMismatch'));
      return;
    }
    if (!acceptedTerms) {
      showAlert(t('authGenericError'), t('authAcceptTerms'));
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
      });
      showAlert(t('authRegisterSuccessTitle'), t('authRegisterSuccessMsg'));
    } catch (error) {
      showAlert(
        t('authGenericError'),
        error.message || t('updateError')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backText}>← {t('back')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('registerTitle')}</Text>
            <Text style={styles.subtitle}>
              {t('registerSubtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.sm }]}>
                <Text style={styles.label}>{t('firstName')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Jean"
                  placeholderTextColor={colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>{t('lastName')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Dupont"
                  placeholderTextColor={colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('authPhone')}</Text>
              <TextInput
                style={styles.input}
                placeholder="06 12 34 56 78"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
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
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('password')}</Text>
              <TextInput
                style={styles.input}
                placeholder="Minimum 6 caractères"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('confirmPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                {t('termsAccept')}
              </Text>
            </TouchableOpacity>

            <Button
              title={loading ? '' : t('registerSubmit')}
              onPress={handleRegister}
              loading={loading}
              size="lg"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <AuthLanguageBar />
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
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
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
  form: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
    marginBottom: spacing.md,
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
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
