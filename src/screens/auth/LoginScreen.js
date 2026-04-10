import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { showAlert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import Button from '../../components/Button';
import AuthLanguageBar from '../../components/AuthLanguageBar';

export default function LoginScreen({ navigation }) {
  const { t } = useLanguage();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showAlert(t('authGenericError'), t('authFillAllFields'));
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      showAlert(
        t('authLoginError'),
        error.message || t('authLoginErrorMsg')
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
        <View style={styles.inner}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backText}>← {t('back')}</Text>
            </TouchableOpacity>
            <Text style={styles.welcome}>{t('welcome')}</Text>
            <Text style={styles.title}>{t('login')}</Text>
            <Text style={styles.subtitle}>
              {t('loginSubtitle')}
            </Text>
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
              autoCorrect={false}
            />

            <View style={styles.passwordRow}>
              <Text style={[styles.label, { marginTop: spacing.md }]}>
                {t('password')}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('MotDePasseOublie')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.forgotText}>{t('forgotPassword')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <View style={styles.submitWrapper}>
              <Button
                title={loading ? '' : t('signIn')}
                onPress={handleLogin}
                loading={loading}
                size="lg"
              />
            </View>
          </View>
        </View>
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
  inner: {
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
  welcome: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 36,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
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
    flex: 1,
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
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  forgotText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  submitWrapper: {
    marginTop: spacing.lg,
  },
});
