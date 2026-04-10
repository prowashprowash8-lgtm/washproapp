import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography, borderRadius } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getMissionsCount } from '../services/missionService';

export default function MissionsTabIcon({ focused }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetch = () => {
      getMissionsCount(user?.id).then((n) => {
        if (!cancelled) setCount(n);
      });
    };
    fetch();
    if (focused) fetch(); // Rafraîchir quand on ouvre l'onglet Missions
    return () => { cancelled = true; };
  }, [focused, user?.id]);

  const iconColor = focused ? colors.primary : '#000000';
  return (
    <View style={[styles.iconFrame, focused && styles.iconFrameFocused]}>
      <View style={styles.iconWrapper}>
        <MaterialCommunityIcons name="target" size={20} color={iconColor} />
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.frameLabel, { color: iconColor }]} numberOfLines={1}>
        {t('missions')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    minWidth: 68,
    maxWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFrameFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  iconWrapper: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.bold,
    color: '#FFF',
  },
  frameLabel: {
    fontSize: 8,
    fontWeight: typography.semibold,
    marginTop: 2,
  },
});
