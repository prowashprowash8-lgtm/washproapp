import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGE_OPTIONS } from '../constants/languageOptions';

/**
 * @param {{ variant?: 'row' | 'icon'; showSectionLabel?: boolean; containerStyle?: import('react-native').ViewStyle }} props
 */
export default function LanguagePicker({ variant = 'row', showSectionLabel = true, containerStyle }) {
  const { locale, setLanguage, t } = useLanguage();
  const [visible, setVisible] = useState(false);

  const currentLang =
    LANGUAGE_OPTIONS.find((o) => o.code === locale) || LANGUAGE_OPTIONS[0];

  const open = () => setVisible(true);
  const close = () => setVisible(false);

  const modal = (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.langModalRoot}>
        <Pressable style={styles.langModalBackdrop} onPress={close} />
        <View style={styles.langModalSheet}>
          <View style={styles.langModalGrab} />
          <View style={styles.langModalHeader}>
            <Text style={styles.langModalTitle}>{t('chooseLanguage')}</Text>
            <TouchableOpacity
              onPress={close}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('cancel')}
            >
              <MaterialCommunityIcons name="close" size={26} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.langModalScroll}
            contentContainerStyle={styles.langModalScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.languageCard}>
              {LANGUAGE_OPTIONS.map((item, index) => {
                const selected = locale === item.code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    activeOpacity={0.65}
                    style={[
                      styles.languageRow,
                      index < LANGUAGE_OPTIONS.length - 1 && styles.languageRowDivider,
                      selected && styles.languageRowSelected,
                    ]}
                    onPress={async () => {
                      await setLanguage(item.code);
                      close();
                    }}
                  >
                    <View style={[styles.flagBadge, selected && styles.flagBadgeSelected]}>
                      <Text style={styles.flagEmoji} allowFontScaling={false}>
                        {item.flag}
                      </Text>
                    </View>
                    <Text
                      style={[styles.languageRowLabel, selected && styles.languageRowLabelSelected]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {selected ? (
                      <View style={styles.checkPill}>
                        <MaterialCommunityIcons name="check" size={18} color="#fff" />
                      </View>
                    ) : (
                      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (variant === 'icon') {
    return (
      <View style={containerStyle}>
        <TouchableOpacity
          style={styles.iconTrigger}
          onPress={open}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t('changeLanguage')}
        >
          <Text style={styles.iconTriggerFlag} allowFontScaling={false}>
            {currentLang.flag}
          </Text>
        </TouchableOpacity>
        {modal}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {showSectionLabel ? <Text style={styles.sectionLabel}>{t('language')}</Text> : null}
      <TouchableOpacity style={styles.langTrigger} onPress={open} activeOpacity={0.75}>
        <View style={[styles.flagBadge, styles.flagBadgeCompact]}>
          <Text style={styles.flagEmoji} allowFontScaling={false}>
            {currentLang.flag}
          </Text>
        </View>
        <View style={styles.langTriggerTexts}>
          <Text style={styles.langTriggerTitle}>{t('changeLanguage')}</Text>
          <Text style={styles.langTriggerCurrent} numberOfLines={1}>
            {currentLang.label}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
      </TouchableOpacity>
      {modal}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  langTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#1A2C42',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 12px rgba(26, 44, 66, 0.06)' },
    }),
  },
  langTriggerTexts: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  langTriggerTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  langTriggerCurrent: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.text,
  },
  iconTrigger: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#1A2C42',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 8px rgba(26, 44, 66, 0.1)' },
    }),
  },
  iconTriggerFlag: {
    fontSize: 28,
    lineHeight: 32,
  },
  flagBadgeCompact: {
    width: 48,
    height: 48,
    marginRight: 0,
  },
  langModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  langModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 44, 66, 0.45)',
  },
  langModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
  },
  langModalGrab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  langModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  langModalTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.text,
    flex: 1,
    paddingRight: spacing.md,
  },
  langModalScroll: {
    maxHeight: 420,
  },
  langModalScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  languageCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1A2C42',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      web: { boxShadow: '0 4px 24px rgba(26, 44, 66, 0.08)' },
    }),
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 56,
  },
  languageRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  languageRowSelected: {
    backgroundColor: colors.primary + '0C',
  },
  flagBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flagBadgeSelected: {
    backgroundColor: '#fff',
    borderColor: colors.primary + '55',
  },
  flagEmoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  languageRowLabel: {
    flex: 1,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  languageRowLabelSelected: {
    color: colors.primaryDark,
  },
  checkPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
