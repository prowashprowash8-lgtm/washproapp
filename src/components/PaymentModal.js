import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme/colors';
import Button from './Button';
import { useLanguage } from '../context/LanguageContext';

export default function PaymentModal({
  visible,
  onClose,
  onMachineOffline,
  machine,
  machineLabel,
  amount,
  onPayByCard,
  allowCardPayment = true,
  onPayWithPromo,
  /** Portefeuille (optionnel) */
  walletBalanceCentimes = null,
  priceCentimes = 0,
  onPayWithWallet,
  onGoToWallet,
  /** Codes issus des remboursements acceptés ({ code, uses_remaining }) */
  availablePromoCodes = [],
}) {
  const { t } = useLanguage();
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState(null);
  const [showMyCodes, setShowMyCodes] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState(null);

  const showWallet = typeof onPayWithWallet === 'function' && priceCentimes > 0;
  const showCard = allowCardPayment && typeof onPayByCard === 'function';
  const walletLoadingBalance = showWallet && walletBalanceCentimes === null;
  const walletEnough =
    showWallet && walletBalanceCentimes != null && walletBalanceCentimes >= priceCentimes;

  useEffect(() => {
    if (!visible) {
      setShowMyCodes(false);
      setPromoCode('');
      setPromoError(null);
    }
  }, [visible]);

  const handleApplyPromo = async () => {
    const code = promoCode.trim();
    if (!code) return;

    setPromoLoading(true);
    setPromoError(null);
    try {
      await onPayWithPromo(code);
    } catch (err) {
      if (err?.message === 'MACHINE_OFFLINE' || err?.code === 'MACHINE_OFFLINE') {
        onMachineOffline?.();
      } else {
        setPromoError(err?.message || t('invalidCode'));
      }
    } finally {
      setPromoLoading(false);
    }
  };

  const handleUseSavedCode = async (code) => {
    const c = (code || '').trim();
    if (!c) return;
    setPromoCode(c);
    setPromoLoading(true);
    setPromoError(null);
    try {
      await onPayWithPromo(c);
    } catch (err) {
      if (err?.message === 'MACHINE_OFFLINE' || err?.code === 'MACHINE_OFFLINE') {
        onMachineOffline?.();
      } else {
        setPromoError(err?.message || t('invalidCode'));
      }
    } finally {
      setPromoLoading(false);
    }
  };

  const handleCard = async () => {
    setCardLoading(true);
    setCardError(null);
    try {
      await onPayByCard();
    } catch (err) {
      if (err?.message === 'MACHINE_OFFLINE' || err?.code === 'MACHINE_OFFLINE') {
        onMachineOffline?.();
      } else {
        setCardError(err?.message || t('stripeError'));
      }
    } finally {
      setCardLoading(false);
    }
  };

  const handleWallet = async () => {
    setWalletLoading(true);
    setWalletError(null);
    try {
      await onPayWithWallet();
    } catch (err) {
      if (err?.message === 'MACHINE_OFFLINE' || err?.code === 'MACHINE_OFFLINE') {
        onMachineOffline?.();
      } else {
        setWalletError(err?.message || t('walletPayError'));
      }
    } finally {
      setWalletLoading(false);
    }
  };

  const machineName = machineLabel || (machine ? `${machine.name || machine.nom || t('machine')}` : '');
  const amountDisplay = amount != null && amount > 0 ? `€ ${Number(amount).toFixed(2)}` : '—';
  const balanceDisplay =
    walletBalanceCentimes == null ? '—' : `${(walletBalanceCentimes / 100).toFixed(2)} €`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modal}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('payment')}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>{machineName}</Text>
                <Text style={styles.summaryAmount}>{amountDisplay}</Text>
              </View>

              {showWallet ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.optionCard,
                      styles.walletCard,
                      walletEnough && styles.walletCardOk,
                      (walletLoading || walletLoadingBalance) && styles.optionDisabled,
                    ]}
                    onPress={handleWallet}
                    disabled={walletLoading || walletLoadingBalance || !walletEnough}
                  >
                    <MaterialCommunityIcons name="wallet" size={28} color={colors.primary} />
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>{t('payWithWallet')}</Text>
                      <Text style={styles.optionSubtitle}>
                        {t('walletCurrentBalance')}: {walletLoadingBalance ? '…' : balanceDisplay}
                      </Text>
                      {!walletLoadingBalance && !walletEnough ? (
                        <Text style={styles.walletInsufficient}>{t('walletInsufficient')}</Text>
                      ) : null}
                    </View>
                    {walletLoading || walletLoadingBalance ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                  {walletError ? <Text style={styles.promoError}>{walletError}</Text> : null}
                  {!walletEnough && !walletLoadingBalance && typeof onGoToWallet === 'function' ? (
                    <TouchableOpacity style={styles.rechargeLink} onPress={onGoToWallet}>
                      <Text style={styles.rechargeLinkText}>{t('walletRechargeCta')}</Text>
                      <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}

              {showCard ? (
                <>
                  <TouchableOpacity
                    style={[styles.optionCard, cardLoading && styles.optionDisabled]}
                    onPress={handleCard}
                    disabled={cardLoading}
                  >
                    <MaterialCommunityIcons name="credit-card" size={28} color={colors.primary} />
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>{t('creditCard')}</Text>
                      <Text style={styles.optionSubtitle}>{t('cardStripeHint')}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                  {cardError ? <Text style={styles.promoError}>{cardError}</Text> : null}
                </>
              ) : null}

              <View style={styles.promoSection}>
                <View style={styles.promoTitleRow}>
                  <Text style={styles.promoLabel}>{t('promoCode')}</Text>
                  {availablePromoCodes.length > 0 ? (
                    <View style={styles.promoCountBadge} accessibilityLabel={String(availablePromoCodes.length)}>
                      <Text style={styles.promoCountBadgeText}>
                        {availablePromoCodes.length > 99 ? '99+' : availablePromoCodes.length}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {availablePromoCodes.length > 0 ? (
                  <>
                    <TouchableOpacity
                      style={styles.myCodesToggle}
                      onPress={() => setShowMyCodes((v) => !v)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.myCodesToggleText}>
                        {showMyCodes ? t('hideMyPromoCodes') : t('showMyPromoCodes')}
                      </Text>
                      <MaterialCommunityIcons
                        name={showMyCodes ? 'chevron-up' : 'chevron-down'}
                        size={22}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    {showMyCodes ? (
                      <View style={styles.savedCodesList}>
                        {availablePromoCodes.map((row) => {
                          const kind = (row.applies_to || 'both').toLowerCase();
                          const kindLabel =
                            kind === 'sechage'
                              ? t('promoCodeMachineDryer')
                              : kind === 'lavage'
                                ? t('promoCodeMachineWasher')
                                : t('promoCodeMachineBoth');
                          return (
                            <View key={row.code} style={styles.savedCodeRow}>
                              <View style={styles.savedCodeLeft}>
                                <Text style={styles.savedCodeText} selectable>
                                  {row.code}
                                </Text>
                                <Text style={styles.savedCodeKind}>{kindLabel}</Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.useCodeBtn, promoLoading && styles.optionDisabled]}
                                onPress={() => handleUseSavedCode(row.code)}
                                disabled={promoLoading}
                              >
                                <Text style={styles.useCodeBtnText}>{t('useThisPromoCode')}</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </>
                ) : null}

                <View style={styles.promoRow}>
                  <TextInput
                    style={styles.promoInput}
                    placeholder={t('enterPromoCode')}
                    placeholderTextColor={colors.textMuted}
                    value={promoCode}
                    onChangeText={(x) => {
                      setPromoCode(x);
                      setPromoError(null);
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <Button
                    title={promoLoading ? '...' : t('apply')}
                    onPress={handleApplyPromo}
                    disabled={!promoCode.trim() || promoLoading}
                    variant="secondary"
                  />
                </View>
                {promoError && (
                  <Text style={styles.promoError}>{promoError}</Text>
                )}
                <Text style={styles.promoHint}>{t('usePromoHint')}</Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    padding: spacing.xl,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  summary: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  summaryLabel: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  summaryAmount: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  walletCard: {
    marginBottom: spacing.sm,
  },
  walletCardOk: {
    borderColor: colors.success,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  optionContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  optionTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  optionSubtitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  walletInsufficient: {
    fontSize: typography.sm,
    color: colors.warning,
    marginTop: 4,
    fontWeight: typography.semibold,
  },
  rechargeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: 4,
  },
  rechargeLinkText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  promoSection: {
    marginTop: spacing.sm,
  },
  promoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  promoLabel: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  promoCountBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoCountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  myCodesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '55',
  },
  myCodesToggleText: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  savedCodesList: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  savedCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  savedCodeLeft: {
    flex: 1,
    minWidth: 0,
  },
  savedCodeText: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.text,
  },
  savedCodeKind: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  useCodeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  useCodeBtnText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: '#fff',
  },
  promoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  promoInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.base,
    color: colors.text,
  },
  promoError: {
    fontSize: typography.sm,
    color: colors.error,
    marginTop: spacing.sm,
  },
  promoHint: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
