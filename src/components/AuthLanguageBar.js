import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGE_OPTIONS } from '../constants/languageOptions';

/**
 * Barre fixe en bas des écrans d’auth : drapeaux cliquables, changement immédiat de langue.
 */
export default function AuthLanguageBar() {
  const insets = useSafeAreaInsets();
  const { locale, setLanguage, t } = useLanguage();

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(spacing.sm, insets.bottom) },
      ]}
    >
      <Text style={styles.label}>{t('language')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollInner}
        keyboardShouldPersistTaps="handled"
      >
        {LANGUAGE_OPTIONS.map((item) => {
          const active = locale === item.code;
          return (
            <TouchableOpacity
              key={item.code}
              style={[styles.flagSlot, active && styles.flagSlotActive]}
              onPress={() => setLanguage(item.code)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
            >
              <Text style={styles.flag} allowFontScaling={false}>
                {item.flag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#1A2C42',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      web: { boxShadow: '0 -2px 12px rgba(26, 44, 66, 0.06)' },
    }),
  },
  label: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  scrollInner: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 52,
  },
  flagSlot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  flagSlotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '18',
  },
  flag: {
    fontSize: 26,
    lineHeight: 30,
  },
});
