import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { getSavedLaundry } from '../utils/laundryStorage';
import { getMissionsByEmplacement } from '../services/missionService';
import { registerMissionAlertToken } from '../services/pushService';
import { useAuth } from '../context/AuthContext';

export default function MissionsScreen({ navigation }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [savedLaundry, setSavedLaundry] = useState(null);
  const [missions, setMissions] = useState([]);
  const [completedMissionIds, setCompletedMissionIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [adminAlertsEnabled, setAdminAlertsEnabled] = useState(false);
  const [adminAlertsLoading, setAdminAlertsLoading] = useState(false);

  const fetchMissions = useCallback(async () => {
    const saved = await getSavedLaundry(user?.id);
    setSavedLaundry(saved?.emplacement || null);

    if (!saved?.emplacement?.id) {
      setMissions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, completedByUserIds, error: err } = await getMissionsByEmplacement(saved.emplacement.id, user?.id);
    if (err) {
      setError(err.message);
      setMissions([]);
    } else {
      setMissions(data || []);
      setCompletedMissionIds(completedByUserIds || new Set());
      setError(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    fetchMissions();
  }, [fetchMissions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMissions();
  };

  const handleEnableAdminAlerts = async () => {
    setAdminAlertsLoading(true);
    const { ok, error: err } = await registerMissionAlertToken();
    setAdminAlertsLoading(false);
    if (ok) setAdminAlertsEnabled(true);
    else setError(
        err === 'missionAlertsWebOnly' ? t('missionAlertsWebOnly') :
        err === 'missionAlertsNoProjectId' ? t('missionAlertsNoProjectId') :
        (err || t('missionAdminAlertsError'))
      );
  };

  const backRow =
    navigation.canGoBack?.() === true ? (
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
        <Text style={styles.backText}>{t('back')}</Text>
      </TouchableOpacity>
    ) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        {backRow}
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!savedLaundry) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {backRow}
          <Text style={styles.title}>{t('missions')}</Text>
          <Text style={styles.subtitle}>{t('missionsSubtitle')}</Text>
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="map-marker-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('selectLaundryFirst')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const laundryName = savedLaundry?.name || savedLaundry?.nom || t('laundry');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {backRow}
        <Text style={styles.title}>{t('missions')}</Text>
        <Text style={styles.subtitle}>{t('missionsSubtitle')}</Text>
        <View style={styles.laundryBadge}>
          <MaterialCommunityIcons name="map-marker" size={18} color={colors.primary} />
          <Text style={styles.laundryBadgeText}>{laundryName}</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {missions.length === 0 ? (
          <>
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="target" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('noMissionsYet')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.adminAlertsCard, adminAlertsEnabled && styles.adminAlertsCardEnabled]}
            onPress={handleEnableAdminAlerts}
            disabled={adminAlertsEnabled || adminAlertsLoading}
          >
            <MaterialCommunityIcons
              name={adminAlertsEnabled ? 'bell-check' : 'bell-plus'}
              size={24}
              color={adminAlertsEnabled ? colors.success : colors.primary}
            />
            <View style={styles.adminAlertsText}>
              <Text style={styles.adminAlertsTitle}>
                {adminAlertsEnabled ? t('missionAdminAlertsEnabled') : t('missionEnableAdminAlerts')}
              </Text>
              {adminAlertsEnabled && (
                <Text style={styles.adminAlertsSub}>{t('completed')}</Text>
              )}
            </View>
            {adminAlertsLoading && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
          </TouchableOpacity>
          </>
        ) : (
          <>
          <View style={styles.missionsList}>
            {missions.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.missionCard, completedMissionIds.has(m.id) && styles.missionCardCompleted]}
                onPress={() => navigation.navigate('MissionDetail', { mission: m, emplacement: savedLaundry })}
                activeOpacity={0.8}
              >
                <View style={styles.missionTitleRow}>
                  <Text style={styles.missionTitle}>{m.titre}</Text>
                  {completedMissionIds.has(m.id) && (
                    <View style={styles.completedBadge}>
                      <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
                      <Text style={styles.completedBadgeText}>{t('completed')}</Text>
                    </View>
                  )}
                </View>
                {m.description ? (
                  <Text style={styles.missionDescription} numberOfLines={2}>{m.description}</Text>
                ) : null}
                {m.recompense ? (
                  <View style={styles.rewardRow}>
                    <MaterialCommunityIcons name="gift-outline" size={18} color={colors.secondary} />
                    <Text style={styles.rewardText}>{m.recompense}</Text>
                  </View>
                ) : null}
                <View style={styles.chevronRow}>
                  <Text style={styles.seeMore}>{t('seeMore')}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.adminAlertsCard, adminAlertsEnabled && styles.adminAlertsCardEnabled]}
            onPress={handleEnableAdminAlerts}
            disabled={adminAlertsEnabled || adminAlertsLoading}
          >
            <MaterialCommunityIcons
              name={adminAlertsEnabled ? 'bell-check' : 'bell-plus'}
              size={24}
              color={adminAlertsEnabled ? colors.success : colors.primary}
            />
            <View style={styles.adminAlertsText}>
              <Text style={styles.adminAlertsTitle}>
                {adminAlertsEnabled ? t('missionAdminAlertsEnabled') : t('missionEnableAdminAlerts')}
              </Text>
              {adminAlertsEnabled && (
                <Text style={styles.adminAlertsSub}>{t('completed')}</Text>
              )}
            </View>
            {adminAlertsLoading && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
          </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  backText: {
    marginLeft: spacing.xs,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  laundryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  laundryBadgeText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    marginTop: spacing.lg,
    fontSize: typography.base,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.error,
    fontWeight: typography.medium,
  },
  missionsList: {
    gap: spacing.md,
  },
  missionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  missionCardCompleted: {
    borderColor: colors.success + '60',
    backgroundColor: colors.success + '08',
  },
  missionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedBadgeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.success,
  },
  missionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.text,
    flex: 1,
  },
  missionDescription: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rewardText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.secondary,
  },
  chevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  seeMore: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.semibold,
  },
  adminAlertsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adminAlertsCardEnabled: {
    borderColor: colors.success + '60',
    backgroundColor: colors.success + '08',
  },
  adminAlertsText: { flex: 1 },
  adminAlertsTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  adminAlertsSub: {
    fontSize: typography.xs,
    color: colors.success,
    marginTop: 2,
  },
});
