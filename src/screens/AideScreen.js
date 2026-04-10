import React, { useState, useEffect } from 'react';
import {
  StyleSheet, ScrollView, Text, View, TouchableOpacity,
  Linking, Modal, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserTransactions } from '../services/transactionService';
import { showAlert } from '../utils/alert';

const FAQ_ITEMS = [
  { id: 'lingebloque', titleKey: 'faqLingeBloque', contentKey: 'faqLingeBloqueContent' },
];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AideScreen({ navigation }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState(null);

  // Remboursement
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [txPickerVisible, setTxPickerVisible] = useState(false);
  const [motif, setMotif] = useState('');
  const [sending, setSending] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setTxLoading(true);
    getUserTransactions(user.id).then(({ data }) => {
      setTransactions(data || []);
      setTxLoading(false);
    });
  }, [user?.id]);

  // Réinitialiser si on change de transaction
  useEffect(() => {
    setAlreadySent(false);
    setMotif('');
  }, [selectedTx]);

  const handleSendRefund = async () => {
    if (!selectedTx || !motif.trim()) return;
    setSending(true);
    const { data, error } = await supabase.rpc('create_refund_request', {
      p_transaction_id: selectedTx.id,
      p_user_id: user.id,
      p_motif: motif.trim(),
    });
    setSending(false);
    if (error || data === false) {
      showAlert('Erreur', error?.message || 'Impossible d\'envoyer la demande. Une demande est peut-être déjà en cours.', [{ text: 'OK' }]);
      return;
    }
    setAlreadySent(true);
    setMotif('');
    setSelectedTx(null);
    showAlert('Demande envoyée', 'Votre demande de remboursement a bien été transmise. Nous vous répondrons dans les plus brefs délais.', [{ text: 'OK' }]);
  };

  const showBack = navigation?.canGoBack?.() === true;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showBack ? (
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
            <Text style={styles.backText}>{t('back')}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>{t('help')}</Text>
        <Text style={styles.subtitle}>{t('howToUse')}</Text>

        {/* Étapes */}
        <View style={styles.section}>
          <View style={styles.step}>
            <MaterialCommunityIcons name="map-marker" size={24} color={colors.primary} />
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>1. {t('step1Title')}</Text>
              <Text style={styles.stepText}>{t('step1Text')}</Text>
            </View>
          </View>
          <View style={styles.step}>
            <MaterialCommunityIcons name="washing-machine" size={24} color={colors.primary} />
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>2. {t('step2Title')}</Text>
              <Text style={styles.stepText}>{t('step2Text')}</Text>
            </View>
          </View>
          <View style={styles.step}>
            <MaterialCommunityIcons name="ticket-percent" size={24} color={colors.primary} />
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>3. {t('step3Title')}</Text>
              <Text style={styles.stepText}>{t('step3Text')}</Text>
            </View>
          </View>
          <View style={styles.step}>
            <MaterialCommunityIcons name="format-list-bulleted" size={24} color={colors.primary} />
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>4. {t('step4Title')}</Text>
              <Text style={styles.stepText}>{t('step4Text')}</Text>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <Text style={styles.faqSectionTitle}>{t('faqSectionTitle')}</Text>
        <View style={styles.faqList}>
          {FAQ_ITEMS.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqTitle}>{t(item.titleKey)}</Text>
                  <MaterialCommunityIcons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={colors.primary}
                  />
                </View>
                {isExpanded && (
                  <Text style={styles.faqContent}>{t(item.contentKey)}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── DEMANDE DE REMBOURSEMENT ── */}
        <Text style={styles.faqSectionTitle}>Remboursement</Text>
        <View style={styles.refundBox}>
          <View style={styles.refundTitleRow}>
            <MaterialCommunityIcons name="cash-refund" size={22} color={colors.primary} />
            <Text style={styles.refundTitle}>Faire une demande de remboursement</Text>
          </View>
          <Text style={styles.refundDesc}>
            Sélectionnez la transaction concernée, indiquez le motif et envoyez votre demande.
          </Text>

          {/* Sélecteur de transaction */}
          <Text style={styles.fieldLabel}>Transaction concernée *</Text>
          <TouchableOpacity
            style={styles.txSelector}
            onPress={() => setTxPickerVisible(true)}
            activeOpacity={0.7}
          >
            {txLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : selectedTx ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.txSelectorText} numberOfLines={1}>
                  {selectedTx.machine_name || 'Machine'} — {selectedTx.emplacement_name || ''}
                </Text>
                <Text style={styles.txSelectorSub}>{formatDate(selectedTx.created_at)}</Text>
              </View>
            ) : (
              <Text style={styles.txSelectorPlaceholder}>Choisir une transaction...</Text>
            )}
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Motif */}
          <Text style={styles.fieldLabel}>Motif de la demande *</Text>
          <TextInput
            style={styles.motifInput}
            placeholder="Ex : machine non démarrée, cycle interrompu, erreur de paiement..."
            placeholderTextColor={colors.textMuted}
            value={motif}
            onChangeText={setMotif}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{motif.length}/500</Text>

          {/* Bouton envoyer */}
          <TouchableOpacity
            style={[styles.sendBtn, (!selectedTx || !motif.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSendRefund}
            disabled={!selectedTx || !motif.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <MaterialCommunityIcons name="send" size={18} color="#fff" />
                  <Text style={styles.sendBtnText}>Envoyer la demande</Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* Contact urgence */}
        <View style={styles.contactSection}>
          <Text style={styles.emergencyHint}>{t('emergencyHint')}</Text>
          <TouchableOpacity
            style={styles.emergencyRow}
            onPress={() => Linking.openURL('tel:0970704861')}
            activeOpacity={0.7}
          >
            <View style={styles.emergencyText}>
              <Text style={styles.emergencyLabel}>{t('emergencyPhone')}</Text>
              <Text style={styles.emergencyNumber}>09 70 70 48 61</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal sélection transaction */}
      <Modal
        visible={txPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTxPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerBox}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choisir une transaction</Text>
              <TouchableOpacity onPress={() => setTxPickerVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {transactions.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>Aucune transaction trouvée.</Text>
              </View>
            ) : (
              <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.txItem, selectedTx?.id === item.id && styles.txItemSelected]}
                    onPress={() => { setSelectedTx(item); setTxPickerVisible(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txItemName} numberOfLines={1}>
                        {item.machine_name || 'Machine'} — {item.emplacement_name || ''}
                      </Text>
                      <Text style={styles.txItemDate}>{formatDate(item.created_at)}</Text>
                    </View>
                    <Text style={styles.txItemAmount}>
                      {item.payment_method === 'promo' ? 'Code promo' : `€ ${Number(item.amount).toFixed(2)}`}
                    </Text>
                    {selectedTx?.id === item.id && (
                      <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: typography.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: typography.base, color: colors.textSecondary, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  faqSectionTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.text, marginBottom: spacing.md },
  faqList: { marginBottom: spacing.xl },
  faqItem: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.sm },
  faqItemExpanded: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  faqTitle: { flex: 1, fontSize: typography.base, fontWeight: typography.semibold, color: colors.text },
  faqContent: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 22, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: 0 },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  stepContent: { flex: 1, marginLeft: spacing.md },
  stepTitle: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.text, marginBottom: spacing.xs },
  stepText: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 22 },
  contactSection: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  emergencyHint: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md, textAlign: 'center' },
  emergencyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.primary + '15', borderRadius: 12, borderWidth: 2, borderColor: colors.error },
  emergencyText: { alignItems: 'center' },
  emergencyLabel: { fontSize: typography.sm, color: colors.textSecondary, marginBottom: 2 },
  emergencyNumber: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.error },

  // Remboursement
  refundBox: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.xl },
  refundTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  refundTitle: { fontSize: typography.base, fontWeight: '700', color: colors.text },
  refundDesc: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  txSelector: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, marginBottom: spacing.lg, backgroundColor: colors.background },
  txSelectorText: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  txSelectorSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  txSelectorPlaceholder: { fontSize: 14, color: colors.textMuted, flex: 1 },
  motifInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, minHeight: 100, backgroundColor: colors.background },
  charCount: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: 4, marginBottom: spacing.md },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 12, padding: 15 },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  pickerEmpty: { padding: 40, alignItems: 'center' },
  pickerEmptyText: { color: colors.textMuted, fontSize: 14 },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20 },
  txItemSelected: { backgroundColor: colors.primary + '10' },
  txItemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  txItemDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  txItemAmount: { fontSize: 13, fontWeight: '700', color: colors.text, marginLeft: 8 },
});
