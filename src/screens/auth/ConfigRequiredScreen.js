import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../theme/colors';

export default function ConfigRequiredScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>⚙️</Text>
        <Text style={styles.title}>Configuration requise</Text>
        <Text style={styles.text}>
          Créez un fichier .env à la racine du projet avec :
        </Text>
        <View style={styles.codeBlock}>
          <Text style={styles.code}>
            EXPO_PUBLIC_SUPABASE_URL=votre_url_supabase{'\n'}
            EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_clé_anon
          </Text>
        </View>
        <Text style={styles.hint}>
          Récupérez ces valeurs dans le dashboard Supabase → Settings → API
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  text: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  codeBlock: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.md,
    width: '100%',
  },
  code: {
    fontFamily: Platform?.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: typography.sm,
    color: colors.text,
  },
  hint: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
