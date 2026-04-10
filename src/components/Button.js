import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../theme/colors';

export default function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'md',
  loading = false,
  disabled = false,
}) {
  const isPrimary = variant === 'primary';
  const isLarge = size === 'lg';

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.primary} size="small" />
      ) : (
        <Text style={[
          styles.text,
          isPrimary && styles.textPrimary,
          !isPrimary && styles.textSecondary,
          isLarge && styles.textLarge,
        ]}>
          {title}
        </Text>
      )}
    </>
  );

  if (isPrimary) {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[
          styles.touchable,
          styles.button,
          isLarge && styles.buttonLarge,
          styles.buttonPrimary,
          disabled && styles.disabled,
        ]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        styles.buttonSecondary,
        isLarge && styles.buttonLarge,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonLarge: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    cursor: 'pointer',
  },
  text: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  textPrimary: {
    color: '#fff',
  },
  textSecondary: {
    color: colors.primary,
  },
  textLarge: {
    fontSize: typography.lg,
  },
  disabled: {
    opacity: 0.6,
  },
});
