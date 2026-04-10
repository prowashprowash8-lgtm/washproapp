import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useLaundryTimer } from '../context/LaundryTimerContext';
import { getUserTransactions } from '../services/transactionService';
import { colors, spacing, typography, borderRadius } from '../theme/colors';

const DATE_LOCALE_BY_APP = {
  fr: 'fr-FR',
  en: 'en-GB',
  de: 'de-DE',
  it: 'it-IT',
  zh: 'zh-CN',
  es: 'es-ES',
};

function formatDate(dateStr, locale) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const tag = DATE_LOCALE_BY_APP[locale] || 'en-GB';
  return d.toLocaleDateString(tag, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCountdown(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ss = s % 60;
  if (h > 0) {
    return `${h}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export default function TransactionScreen() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const {
    timer,
    remainingMs,
    updateDuration,
    stopTimer,
    minDurationMin,
    maxDurationMin,
  } = useLaundryTimer();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editMinutes, setEditMinutes] = useState('30');

  const showTimer = Boolean(timer && remainingMs > 0);

  const fetchTransactions = async (isRefresh = false) => {
    if (!user?.id) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    setError(null);
    const { data, error: err } = await getUserTransactions(user.id);
    setTransactions(data || []);
    setError(err?.message || null);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, [user?.id]);

  const openEdit = () => {
    if (timer) setEditMinutes(String(timer.durationMinutes));
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const n = parseInt(editMinutes, 10);
    if (Number.isNaN(n)) return;
    const clamped = Math.min(maxDurationMin, Math.max(minDurationMin, n));
    await updateDuration(clamped);
    setEditOpen(false);
  };

  const renderTimerBanner = () => {
    if (!showTimer) return null;
    return (
      <View style={styles.timerCard}>
        <View style={styles.timerCardInner}>
          <MaterialCommunityIcons name="timer-sand" size={32} color={colors.primary} />
          <Text style={styles.timerTitle}>{t('laundryTimerTitle')}</Text>
          <Text style={styles.timerMachine} numberOfLines={2}>
            {timer.machineName}
          </Text>
          <Text style={styles.timerCountdown}>{formatCountdown(remainingMs)}</Text>
          <Text style={styles.timerHint}>{t('laundryTimerHint')}</Text>
          <View style={styles.timerActions}>
            <TouchableOpacity style={styles.timerBtnSecondary} onPress={openEdit} activeOpacity={0.75}>
              <MaterialCommunityIcons name="pencil" size={20} color={colors.primary} />
              <Text style={styles.timerBtnSecondaryText}>{t('laundryTimerEdit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.timerBtnGhost} onPress={stopTimer} activeOpacity={0.75}>
              <Text style={styles.timerBtnGhostText}>{t('laundryTimerStop')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }
    if (transactions.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={[styles.center, styles.emptyScroll]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTransactions(true)}
              colors={[colors.primary]}
            />
          }
        >
          <MaterialCommunityIcons name="receipt" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>{t('noTransaction')}</Text>
          <Text style={styles.emptyHint}>{t('noTransactionHint')}</Text>
        </ScrollView>
      );
    }
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTransactions(true)}
            colors={[colors.primary]}
          />
        }
      >
        {transactions.map((tx) => (
          <View key={tx.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardLeft}>
                <MaterialCommunityIcons
                  name={
                    tx.payment_method === 'promo'
                      ? 'ticket-percent'
                      : tx.payment_method === 'wallet'
                        ? 'wallet'
                        : 'credit-card'
                  }
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.cardInfo}>
                  <Text style={styles.machineLabel}>{t('machineStarted')}</Text>
                  <Text style={styles.machineName}>
                    {tx.machine_name || t('machine')}
                  </Text>
                  <Text style={styles.emplacementName}>
                    {tx.emplacement_name ? `${tx.emplacement_name}` : t('laundry')}
                  </Text>
                </View>
              </View>
              <Text style={[
                styles.amount,
                tx.status === 'refunded' && styles.amountRefunded,
              ]}>
                {tx.status === 'refunded' ? t('refunded') : tx.payment_method === 'promo' ? t('free') : `€ ${Number(tx.amount).toFixed(2)}`}
              </Text>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.date}>{formatDate(tx.created_at, locale)}</Text>
              {tx.promo_code && (
                <Text style={styles.promo}>{t('promoCodeLabel')}: {tx.promo_code}</Text>
              )}
              {tx.status === 'refunded' && tx.refund_reason && (
                <Text style={styles.refundReason}>{tx.refund_reason}</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>{t('myTransactions')}</Text>
        <Text style={styles.subtitle}>{t('transactionHistory')}</Text>
      </View>

      <View style={styles.main}>
        {renderTimerBanner()}
        {renderBody()}
      </View>

      <Modal visible={editOpen} animationType="fade" transparent onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('laundryTimerEdit')}</Text>
            <Text style={styles.modalLabel}>{t('laundryTimerMinutes')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editMinutes}
              onChangeText={setEditMinutes}
              keyboardType="number-pad"
              maxLength={3}
              placeholder={`${minDurationMin}–${maxDurationMin}`}
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.modalRange}>
              {minDurationMin}–{maxDurationMin} {t('minutesShort')}
            </Text>
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditOpen(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveEdit}>
                <Text style={styles.modalSaveText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  main: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: typography.xxl, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: typography.sm, color: colors.textSecondary, marginTop: spacing.xs },
  timerCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary + '44',
    alignItems: 'center',
  },
  timerCardInner: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
  },
  timerTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    width: '100%',
  },
  timerMachine: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.text,
    marginTop: spacing.xs,
    textAlign: 'center',
    width: '100%',
  },
  timerCountdown: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
    marginVertical: spacing.md,
    textAlign: 'center',
    width: '100%',
  },
  timerHint: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
    width: '100%',
    lineHeight: 18,
  },
  timerActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  timerBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  timerBtnSecondaryText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
    textAlign: 'center',
    flexShrink: 1,
  },
  timerBtnGhost: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBtnGhostText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textAlign: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyScroll: { flexGrow: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardInfo: { marginLeft: spacing.md },
  machineLabel: { fontSize: typography.xs, color: colors.textMuted, marginBottom: 2 },
  machineName: { fontSize: typography.base, fontWeight: '600', color: colors.text },
  emplacementName: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  amount: { fontSize: typography.lg, fontWeight: '700', color: colors.text },
  amountRefunded: { color: colors.success, textDecorationLine: 'line-through' },
  cardFooter: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  date: { fontSize: typography.xs, color: colors.textMuted },
  promo: { fontSize: typography.xs, color: colors.primary, fontWeight: '600' },
  refundReason: { fontSize: typography.xs, color: colors.textSecondary, fontStyle: 'italic', width: '100%' },
  errorText: { color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  emptyText: { fontSize: typography.lg, fontWeight: '600', color: colors.text, marginTop: spacing.md },
  emptyHint: { fontSize: typography.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
    width: '100%',
  },
  modalLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
    width: '100%',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
    textAlign: 'center',
    width: '100%',
    minHeight: 52,
  },
  modalRange: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
    width: '100%',
  },
  modalRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, width: '100%' },
  modalCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textAlign: 'center',
  },
  modalSave: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: { fontSize: typography.base, color: '#fff', fontWeight: typography.semibold, textAlign: 'center' },
});
