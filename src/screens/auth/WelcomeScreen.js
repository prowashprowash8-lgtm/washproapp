import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/colors';
import Button from '../../components/Button';
import AuthLanguageBar from '../../components/AuthLanguageBar';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { isBiometricAvailable, hasStoredCredentials } from '../../utils/biometricAuth';
import { showAlert } from '../../utils/alert';

export default function WelcomeScreen({ navigation }) {
  const { t } = useLanguage();
  const { signInWithBiometric } = useAuth();
  const [biometricReady, setBiometricReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Promise.all([isBiometricAvailable(), hasStoredCredentials()]).then(([available, hasStored]) => {
        setBiometricReady(available && hasStored);
      });
    }
  }, []);

  const handleBiometric = async () => {
    setLoading(true);
    try {
      await signInWithBiometric();
    } catch (error) {
      showAlert(t('authGenericError'), error.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.main}>
        <View style={styles.content}>
          <Image
            source={require('../../../assets/logo-washpro.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.actions}>
          {biometricReady && (
            <>
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometric}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.biometricText}>{t('biometricLogin')}</Text>
                )}
              </TouchableOpacity>
              <View style={{ height: spacing.md }} />
            </>
          )}
          <Button
            title={t('signIn')}
            onPress={() => navigation.navigate('Connexion')}
            size="lg"
          />
          <View style={{ height: spacing.md }} />
          <Button
            title={t('createAccount')}
            onPress={() => navigation.navigate('Inscription')}
            variant="secondary"
            size="lg"
          />
        </View>
      </View>
      <AuthLanguageBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  main: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  logoImage: {
    width: 200,
    height: 90,
    alignSelf: 'center',
  },
  actions: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  biometricButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  biometricText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
});
