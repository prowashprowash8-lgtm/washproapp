import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getWalletBalance } from '../services/walletService';
import { createWalletCheckout } from '../services/stripeService';
import { showAlert } from '../utils/alert';

const RECHARGE_AMOUNTS = [10, 20, 50];
const POST_CHECKOUT_POLL_MS = 3000;
const POST_CHECKOUT_POLL_DURATION_MS = 60000;
/** Rafraîchissement auto du solde tant que l’écran est ouvert (remboursements / crédits Stripe côté webhook). */
const WALLET_FOCUS_POLL_MS = 6000;

export default function WalletScreen({ navigation }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [balanceCentimes, setBalanceCentimes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const pollTimerRef = useRef(null);

  const stopPostCheckoutPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const loadWalletData = useCallback(
    async (silent) => {
      if (!user?.id) {
        setBalanceCentimes(0);
        if (!silent) setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const bal = await getWalletBalance(user.id);
        setBalanceCentimes(bal.balanceCentimes);
      } catch (e) {
        if (__DEV__) console.warn('[Wallet] loadWalletData', e);
      }
      if (!silent) setLoading(false);
    },
    [user?.id],
  );

  const refresh = useCallback(() => loadWalletData(false), [loadWalletData]);

  const startPostCheckoutPolling = useCallback((startingBalance) => {
    stopPostCheckoutPolling();
    const startedAt = Date.now();
    pollTimerRef.current = setInterval(async () => {
      if (!user?.id) {
        stopPostCheckoutPolling();
        return;
      }
      const bal = await getWalletBalance(user.id);
      setBalanceCentimes(bal.balanceCentimes);

      const timedOut = Date.now() - startedAt >= POST_CHECKOUT_POLL_DURATION_MS;
      const nextBalance = bal.balanceCentimes;
      const balanceUpdated =
        startingBalance == null ? nextBalance != null : Number(nextBalance) > Number(startingBalance);

      if (timedOut || balanceUpdated) {
        stopPostCheckoutPolling();
      }
    }, POST_CHECKOUT_POLL_MS);
  }, [stopPostCheckoutPolling, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadWalletData(false);
      const interval = setInterval(() => loadWalletData(true), WALLET_FOCUS_POLL_MS);
      return () => clearInterval(interval);
    }, [loadWalletData]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && user?.id) loadWalletData(false);
    });
    return () => sub.remove();
  }, [loadWalletData, user?.id]);

  useEffect(() => stopPostCheckoutPolling, [stopPostCheckoutPolling]);

  const handleRecharge = useCallback(async (amountEur) => {
    if (!user?.id) {
      showAlert(t('error'), t('mustBeLoggedIn'), [{ text: t('ok') }]);
      return;
    }
    setCheckoutLoading(true);
    try {
      const { success, error } = await createWalletCheckout({
        userId: user.id,
        amountEur: amountEur,
      });
      if (!success) {
        const detail = error ? `\n\n${error}` : '';
        showAlert(t('error'), `${t('stripeError')}${detail}`, [{ text: t('ok') }]);
        return;
      }
      startPostCheckoutPolling(balanceCentimes);
      showAlert(t('stripeOpenTitle'), t('walletStripeAfterPay'), [{ text: t('ok') }]);
    } catch (err) {
      showAlert(t('error'), err?.message || t('stripeError'), [{ text: t('ok') }]);
    } finally {
      setCheckoutLoading(false);
    }
  }, [balanceCentimes, startPostCheckoutPolling, t, user?.id]);

  const displayBalance =
    balanceCentimes == null ? '—' : (balanceCentimes / 100).toFixed(2);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('walletTitle')}</Text>
        <Text style={styles.subtitle}>{t('walletSubtitle')}</Text>

        <View style={styles.balanceCard}>
          <MaterialCommunityIcons name="wallet-outline" size={40} color={colors.primary} />
          <Text style={styles.balanceLabel}>{t('walletBalanceLabel')}</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          ) : (
            <Text style={styles.balanceValue}>{displayBalance} €</Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, styles.rechargeSectionTitle]}>{t('walletRechargeTitle')}</Text>
        <View style={styles.amountRow}>
          {RECHARGE_AMOUNTS.map((amt) => (
            <TouchableOpacity
              key={amt}
              style={[styles.amountBtn, checkoutLoading && styles.amountBtnDisabled]}
              onPress={() => handleRecharge(amt)}
              disabled={checkoutLoading}
            >
              <Text style={styles.amountBtnText}>{amt} €</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>{t('walletStripeHint')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: typography.semibold,
    marginLeft: spacing.xs,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: typography.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  amountBtn: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  amountBtnDisabled: {
    opacity: 0.6,
  },
  amountBtnText: {
    color: '#fff',
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  hint: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  rechargeSectionTitle: {
    marginTop: spacing.lg,
  },
});
