import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Platform,
  RefreshControl,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme/colors';
import Button from '../components/Button';
import PaymentModal from '../components/PaymentModal';
import DurationModal from '../components/DurationModal';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useLaundryTimer } from '../context/LaundryTimerContext';
import { createTransactionAndStartMachine, createTransactionAndPayWithWallet } from '../services/transactionService';
import { getWalletBalance } from '../services/walletService';
import { validateAndUsePromoCode, getUserAvailablePromoCodes } from '../services/promoService';
import { getMachinesByEmplacement, getMachineAvailabilityState, setMachineAvailableById } from '../services/laundryService';
import { checkEsp32Online, getEsp32IdForMachine } from '../services/esp32Service';
import { createCheckoutAndPay } from '../services/stripeService';
import { showAlert } from '../utils/alert';
import { isDryerMachine, getMachineKind } from '../utils/machineKind';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// TEST : masquer une ou plusieurs machines (UUID). Liste vide = rien a masquer.
const TEMP_HIDDEN_MACHINE_IDS = [];

/** Après paiement, l’ESP peut encore signaler « machine à l’arrêt » juste avant le vrai démarrage.
 * On masque un faux « disponible » seulement les premières secondes (voir POST_PAYMENT_MASK_DISPO_MS).
 * Passé ce délai, si Supabase indique déjà « disponible » (ex. arrêt / opto), on l’affiche — ne pas
 * forcer « occupé » jusqu’à 25 s, sinon l’app ne reflète jamais un arrêt rapide.
 */
const POST_PAYMENT_OCCUPE_HOLD_MS = 25 * 1000;
const POST_PAYMENT_MASK_DISPO_MS = 5000;

const STATUS_COLORS = {
  disponible: colors.success,
  available: colors.success,
  occupe: '#DC2626',
  occupied: '#DC2626',
  reserve: colors.primary,
  booked: colors.primary,
};

function formatPrice(price) {
  if (price == null || price === 0) return null;
  return `\u20ac ${Number(price).toFixed(2)}`;
}

function normalizeMachineStatut(statut) {
  const raw = (statut == null ? '' : String(statut)).trim().toLowerCase();
  try {
    return raw.normalize('NFD').replace(/\p{M}/gu, '');
  } catch {
    return raw;
  }
}

function isStatutDisponible(statut) {
  const s = normalizeMachineStatut(statut);
  return s === 'disponible' || s === 'available' || s === 'libre' || s === 'free';
}

function isStatutOccupe(statut) {
  const s = normalizeMachineStatut(statut);
  return s === 'occupe' || s === 'occupied';
}

function isMachineOutOfService(machine) {
  return machine?.hors_service === true;
}

export default function LaundryDetailScreen({ route, navigation }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { startTimer } = useLaundryTimer();
  const { emplacement, machines: initialMachines } = route.params || {};
  const [machines, setMachines] = useState(initialMachines || []);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [espOnlineByMachineId, setEspOnlineByMachineId] = useState({});
  const [espStatusReady, setEspStatusReady] = useState(false);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [walletBalanceCentimes, setWalletBalanceCentimes] = useState(null);
  const [durationModalVisible, setDurationModalVisible] = useState(false);
  const [durationSubmitBusy, setDurationSubmitBusy] = useState(false);
  const [availablePromoCodes, setAvailablePromoCodes] = useState([]);
  const pendingTimerMachineLabelRef = useRef(null);
  const blockPollingUntil = useRef(0); // timestamp jusqu'auquel on bloque le polling
  const postPaymentHoldMachineIdRef = useRef(null);
  const postPaymentHoldUntilRef = useRef(0);
  const postPaymentHoldStartedAtRef = useRef(0);

  const clearPostPaymentOccupeHold = useCallback(() => {
    postPaymentHoldMachineIdRef.current = null;
    postPaymentHoldUntilRef.current = 0;
    postPaymentHoldStartedAtRef.current = 0;
  }, []);

  const beginPostPaymentOccupeHold = useCallback((machineId) => {
    if (!machineId) return;
    postPaymentHoldMachineIdRef.current = machineId;
    postPaymentHoldUntilRef.current = Date.now() + POST_PAYMENT_OCCUPE_HOLD_MS;
    postPaymentHoldStartedAtRef.current = Date.now();
  }, []);

  const mergeMachinesWithPostPaymentHold = useCallback(
    (data) => {
      if (!data?.length) return data;
      const id = postPaymentHoldMachineIdRef.current;
      const until = postPaymentHoldUntilRef.current;
      if (!id || !until) return data;
      if (Date.now() > until) {
        clearPostPaymentOccupeHold();
        return data;
      }
      const row = data.find((m) => m.id === id);
      if (!row) return data;
      if (isStatutOccupe(row.statut)) {
        clearPostPaymentOccupeHold();
        return data;
      }
      // Faux « disponible » tout juste après paiement : masqué seulement les premières secondes.
      if (isStatutDisponible(row.statut)) {
        const age = Date.now() - (postPaymentHoldStartedAtRef.current || 0);
        if (age >= POST_PAYMENT_MASK_DISPO_MS) {
          clearPostPaymentOccupeHold();
          return data;
        }
      }
      return data.map((m) => {
        if (m.id !== id) return m;
        if (isStatutDisponible(m.statut)) {
          return { ...m, statut: 'occupe', estimated_end_time: null };
        }
        return m;
      });
    },
    [clearPostPaymentOccupeHold]
  );

  const refreshMachines = useCallback(() => {
    if (!emplacement?.id) return Promise.resolve();
    if (Date.now() < blockPollingUntil.current) return Promise.resolve();
    return getMachinesByEmplacement(emplacement.id).then(({ data }) => {
      // Double vérification : une requête lancée AVANT le blocage peut revenir APRÈS
      // Sans ce check, elle écraserait le statut 'occupe' mis localement au moment du paiement
      if (data && Date.now() >= blockPollingUntil.current) {
        setMachines(mergeMachinesWithPostPaymentHold(data));
      }
    });
  }, [emplacement?.id, mergeMachinesWithPostPaymentHold]);

  const refreshWalletBalance = useCallback(() => {
    if (!user?.id || !isSupabaseConfigured()) {
      setWalletBalanceCentimes(null);
      return Promise.resolve();
    }
    return getWalletBalance(user.id).then(({ balanceCentimes }) => {
      setWalletBalanceCentimes(balanceCentimes);
    });
  }, [user?.id]);

  const onRefreshList = useCallback(() => {
    setListRefreshing(true);
    Promise.all([refreshMachines(), refreshWalletBalance()]).finally(() =>
      setListRefreshing(false)
    );
  }, [refreshMachines, refreshWalletBalance]);

  useEffect(() => {
    if (emplacement?.id) {
      refreshMachines();
    } else {
      setMachines(initialMachines || []);
    }
  }, [emplacement?.id, refreshMachines]);

  useEffect(() => {
    if (!paymentModalVisible || !user?.id || !isSupabaseConfigured()) return;
    let cancelled = false;
    getWalletBalance(user.id).then(({ balanceCentimes }) => {
      if (!cancelled) setWalletBalanceCentimes(balanceCentimes);
    });
    return () => {
      cancelled = true;
    };
  }, [paymentModalVisible, user?.id]);

  useEffect(() => {
    if (!paymentModalVisible || !user?.id || !isSupabaseConfigured()) {
      setAvailablePromoCodes([]);
      return;
    }
    let cancelled = false;
    getUserAvailablePromoCodes(user.id).then(({ data }) => {
      if (!cancelled) setAvailablePromoCodes(Array.isArray(data) ? data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [paymentModalVisible, user?.id]);

  // Retour sur l'écran : machines + solde portefeuille
  useFocusEffect(
    useCallback(() => {
      refreshMachines();
      refreshWalletBalance();
    }, [refreshMachines, refreshWalletBalance])
  );

  // Polling : plus rapide tant qu'au moins une machine est occupee
  const hasBusyMachine = machines.some((m) => isStatutOccupe(m.statut));

  useEffect(() => {
    const ms = hasBusyMachine ? 1500 : 8000;
    const interval = setInterval(() => {
      refreshMachines();
    }, ms);
    return () => clearInterval(interval);
  }, [refreshMachines, hasBusyMachine]);

  // App au premier plan : recharger
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshMachines();
    });
    return () => sub.remove();
  }, [refreshMachines]);

  // Realtime Supabase
  useEffect(() => {
    if (!emplacement?.id || !isSupabaseConfigured() || !supabase) return;
    const emplId = String(emplacement.id);
    const channel = supabase
      .channel(`machines-rt-${emplId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines' },
        (payload) => {
          const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
          if (!row || String(row.emplacement_id) !== emplId) return;
          refreshMachines();
        }
      )
      .subscribe((status) => {
        if (__DEV__ && status === 'CHANNEL_ERROR') {
          console.warn('[WashPro] Realtime machines : erreur de canal');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [emplacement?.id, refreshMachines]);

  // Heartbeat ESP32 par machine
  useEffect(() => {
    if (!machines?.length) {
      setEspOnlineByMachineId({});
      setEspStatusReady(false);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      const next = {};
      for (const m of machines) {
        const id = getEsp32IdForMachine(m, emplacement);
        next[m.id] = id ? await checkEsp32Online(id) : false;
      }
      if (!cancelled) {
        setEspOnlineByMachineId(next);
        setEspStatusReady(true);
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [machines, emplacement]);

  const selectedEspOnline = selectedMachine ? espOnlineByMachineId[selectedMachine.id] : undefined;
  const isOnline = !selectedMachine || selectedEspOnline === true;
  const selectedMachineFromList = selectedMachine
    ? (machines.find((m) => m.id === selectedMachine.id) || selectedMachine)
    : null;

  const laundryName = emplacement?.name || emplacement?.nom || t('laundry');

  const hiddenMachineIds = useMemo(
    () => [
      ...TEMP_HIDDEN_MACHINE_IDS,
      ...String(process.env.EXPO_PUBLIC_HIDDEN_MACHINE_IDS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ],
    []
  );

  const availableMachines = (machines || []).filter((m) => !hiddenMachineIds.includes(m.id));

  const { washerMachines, dryerMachines } = useMemo(() => {
    const washers = [];
    const dryers = [];
    for (const m of availableMachines) {
      if (getMachineKind(m) === 'sechage') dryers.push(m);
      else washers.push(m);
    }
    return { washerMachines: washers, dryerMachines: dryers };
  }, [availableMachines]);

  useEffect(() => {
    if (!selectedMachine?.id || !hiddenMachineIds.length) return;
    if (hiddenMachineIds.includes(selectedMachine.id)) setSelectedMachine(null);
  }, [machines, hiddenMachineIds, selectedMachine?.id]);

  const getEsp32Id = () => getEsp32IdForMachine(selectedMachineFromList, emplacement);

  const getStatusColor = (statut) => {
    const s = (statut || 'disponible').toLowerCase();
    return STATUS_COLORS[s] || colors.textMuted;
  };

  const getTypeLabel = (type) => {
    if (!type) return t('machine');
    const key = type.toLowerCase().trim();
    return TYPE_KEYS[key] ? t(TYPE_KEYS[key]) : type;
  };

  const selectedMachineBusy = selectedMachineFromList && isStatutOccupe(selectedMachineFromList.statut);
  const selectedMachineOutOfService = isMachineOutOfService(selectedMachineFromList);

  const handleForceAvailable = async () => {
    if (!selectedMachine?.id) return;
    const { ok, error } = await setMachineAvailableById(selectedMachine.id);
    if (!ok) {
      if (error === 'release_rejected') {
        showAlert(t('error'), t('machineRemoteUnavailable'), [{ text: t('ok') }]);
      } else {
        showAlert(t('error'), error || t('updateError'), [{ text: t('ok') }]);
      }
      return;
    }
    await refreshMachines();
  };

  const getMachineAmount = () => {
    const m = selectedMachineFromList;
    if (!m) return 0;
    const isHourly = isDryerMachine(m);
    if (isHourly && m.price_per_hour) return Number(m.price_per_hour);
    // prix_centimes (board) en priorité, sinon price (legacy)
    if (m.prix_centimes != null) return m.prix_centimes / 100;
    return Number(m.price) || 0;
  };

  /** Prix en centimes pour le portefeuille (aligné sur getMachineAmount) */
  const getMachinePriceCentimes = () => {
    const amt = getMachineAmount();
    return Math.max(0, Math.round(Number(amt) * 100));
  };

  const handlePay = () => {
    if (!selectedMachine) return;
    if (selectedMachineOutOfService) {
      showAlert(t('error'), t('machineOutOfService'), [{ text: t('ok') }]);
      return;
    }
    const esp32Id = getEsp32Id();
    if (!esp32Id) {
      showAlert(t('esp32NotConfigured'), t('esp32ConfigHint'), [{ text: t('ok') }]);
      return;
    }
    showAlert(t('payBeforeProgramTitle'), t('payBeforeProgramMessage'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('payBeforeProgramContinue'), onPress: () => setPaymentModalVisible(true) },
    ]);
  };

  const handlePayByCard = async () => {
    if (!user?.id) {
      throw new Error(t('mustBeLoggedIn'));
    }
    const { hors_service, error: availabilityError } = await getMachineAvailabilityState(selectedMachineFromList?.id);
    if (availabilityError) {
      throw new Error(availabilityError);
    }
    if (hors_service === true) {
      throw new Error(t('machineOutOfService'));
    }
    const esp32Id = getEsp32Id();
    if (!esp32Id) {
      throw new Error(t('esp32NotConfigured'));
    }
    const emplacementId = emplacement?.id;
    const machineId = selectedMachineFromList?.id;
    if (!emplacementId || !machineId) {
      throw new Error(t('missingData'));
    }
    const amt = getMachineAmount();
    if (amt <= 0) {
      throw new Error(t('invalidAmount'));
    }

    const { success, error } = await createCheckoutAndPay({
      amount: amt,
      machineName: selectedMachineFromList?.name || selectedMachineFromList?.nom || t('washingMachine'),
      esp32Id,
      userId: user.id,
      machineId,
      emplacementId,
    });

    if (!success) {
      throw new Error(error || t('stripeError'));
    }

    setPaymentModalVisible(false);
    showAlert(t('stripeOpenTitle'), t('stripeOpenHint'), [{ text: t('ok') }]);
  };

  const handlePayWithWallet = async () => {
    if (!user?.id) {
      throw new Error(t('mustBeLoggedIn'));
    }
    const { hors_service, error: availabilityError } = await getMachineAvailabilityState(selectedMachineFromList?.id);
    if (availabilityError) {
      throw new Error(availabilityError);
    }
    if (hors_service === true) {
      throw new Error(t('machineOutOfService'));
    }
    const esp32Id = getEsp32Id();
    if (!esp32Id) {
      throw new Error(t('esp32NotConfigured'));
    }
    const emplacementId = emplacement?.id;
    const machineId = selectedMachineFromList?.id;
    const priceCentimes = getMachinePriceCentimes();
    if (!emplacementId || !machineId) {
      throw new Error(t('missingData'));
    }
    if (priceCentimes <= 0) {
      throw new Error(t('invalidAmount'));
    }

    blockPollingUntil.current = Date.now() + 30000;
    setMachines((prev) =>
      prev.map((m) => (m.id === machineId ? { ...m, statut: 'occupe', estimated_end_time: null } : m))
    );

    const { success, error } = await createTransactionAndPayWithWallet({
      userId: user.id,
      machineId,
      emplacementId,
      esp32Id,
      amount: getMachineAmount(),
      priceCentimes,
    });

    if (!success) {
      blockPollingUntil.current = 0;
      clearPostPaymentOccupeHold();
      setMachines((prev) =>
        prev.map((m) => (m.id === machineId ? { ...m, statut: 'disponible' } : m))
      );
      if (error === 'insufficient_balance') {
        throw new Error(t('walletInsufficient'));
      }
      throw new Error(error || t('startError'));
    }

    beginPostPaymentOccupeHold(machineId);
    setPaymentModalVisible(false);
    refreshWalletBalance();
    const machineLabel = selectedMachineFromList?.name || selectedMachineFromList?.nom || t('machine');
    openDurationModalAfterPayment(machineLabel);
  };

  const openDurationModalAfterPayment = (machineLabel) => {
    pendingTimerMachineLabelRef.current = machineLabel;
    setDurationModalVisible(true);
  };

  const handleDurationModalClose = () => {
    setDurationModalVisible(false);
    pendingTimerMachineLabelRef.current = null;
  };

  const handleDurationSubmit = async (minutes) => {
    setDurationSubmitBusy(true);
    try {
      const machineLabel = pendingTimerMachineLabelRef.current || t('machine');
      await startTimer({ machineName: machineLabel, durationMinutes: minutes });
      clearPostPaymentOccupeHold();
      setDurationModalVisible(false);
      pendingTimerMachineLabelRef.current = null;
      navigation.dispatch(CommonActions.navigate({ name: 'Activité' }));
      showAlert(t('codeAccepted'), t('machineStartingWithTimer'), [{ text: t('ok') }]);
    } catch (e) {
      showAlert(t('error'), e?.message || t('updateError'), [{ text: t('ok') }]);
    } finally {
      setDurationSubmitBusy(false);
    }
  };

  const goToWalletQuick = () => {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Profil',
        params: { screen: 'Wallet' },
      })
    );
  };

  const goToWallet = () => {
    setPaymentModalVisible(false);
    goToWalletQuick();
  };

  const handlePayWithPromo = async (code) => {
    if (!user?.id) {
      throw new Error(t('mustBeLoggedIn'));
    }
    const { hors_service, error: availabilityError } = await getMachineAvailabilityState(selectedMachineFromList?.id);
    if (availabilityError) {
      throw new Error(availabilityError);
    }
    if (hors_service === true) {
      throw new Error(t('machineOutOfService'));
    }
    const esp32Id = getEsp32Id();
    if (!esp32Id) {
      throw new Error(t('esp32NotConfigured'));
    }
    const machineId = selectedMachineFromList?.id;
    const promoResult = await validateAndUsePromoCode(code, machineId);
    if (!promoResult.ok) {
      if (promoResult.reason === 'wrong_machine_type') {
        throw new Error(t('promoWrongMachineType'));
      }
      throw new Error(t('invalidPromoCode'));
    }

    const emplacementId = emplacement?.id;
    if (!emplacementId || !machineId) {
      throw new Error(t('missingData'));
    }

    // Bloquer tout polling/realtime et afficher "occupe" AVANT l'appel Supabase
    // (évite que le Realtime ou le polling écrase le statut pendant la transaction)
    blockPollingUntil.current = Date.now() + 30000;
    setMachines((prev) =>
      prev.map((m) => m.id === machineId ? { ...m, statut: 'occupe', estimated_end_time: null } : m)
    );

    const { success, error } = await createTransactionAndStartMachine({
      userId: user.id,
      machineId,
      emplacementId,
      esp32Id,
      amount: getMachineAmount(),
      paymentMethod: 'promo',
      promoCode: code.trim().toUpperCase(),
    });

    if (!success) {
      blockPollingUntil.current = 0; // libérer le bloc si erreur
      clearPostPaymentOccupeHold();
      throw new Error(error || t('startError'));
    }

    beginPostPaymentOccupeHold(machineId);
    setPaymentModalVisible(false);
    const machineLabel = selectedMachineFromList?.name || selectedMachineFromList?.nom || t('machine');
    openDurationModalAfterPayment(machineLabel);
  };

  const renderMachineRow = (machine) => {
    const isSelected = selectedMachine?.id === machine.id;
    const isOccupied = isStatutOccupe(machine.statut);
    const outOfService = isMachineOutOfService(machine);
    const dbFree = isStatutDisponible(machine.statut);
    const espOnline = espOnlineByMachineId[machine.id];
    const espConfirmedOnline = espOnline === true;
    const espOfflineButDbFree = dbFree && (espStatusReady ? !espConfirmedOnline : true);
    let statusColor = getStatusColor(machine.statut);
    if (outOfService) statusColor = colors.error;
    if (espOfflineButDbFree) statusColor = colors.warning;
    else if (dbFree && espConfirmedOnline) statusColor = colors.success;
    const isHourly = isDryerMachine(machine);
    const machinePrice = machine.prix_centimes != null
      ? machine.prix_centimes / 100
      : (Number(machine.price) || null);
    const priceDisplay = isHourly
      ? machine.price_per_hour
        ? `${t('perHour')} ${Number(machine.price_per_hour).toFixed(2)}`
        : formatPrice(machinePrice) || '\u2014'
      : formatPrice(machinePrice) || '\u2014';
    return (
      <TouchableOpacity
        key={machine.id}
        style={[
          styles.machineCard,
          isSelected && styles.machineCardSelected,
          isOccupied && styles.machineCardOccupied,
          outOfService && styles.machineCardOutOfService,
          espOfflineButDbFree && styles.machineCardWarning,
        ]}
        onPress={() => setSelectedMachine(machine)}
        activeOpacity={0.7}
      >
        <View style={[styles.statusBar, { backgroundColor: statusColor }]} />
        <View style={styles.machineContent}>
          <MaterialCommunityIcons
            name={isHourly ? 'tumble-dryer' : 'washing-machine'}
            size={32}
            color={colors.primary}
          />
          <View style={styles.machineInfo}>
            <Text style={styles.machineName}>
              {(() => { const n = machine.name || machine.nom || ''; return n.charAt(0).toUpperCase() + n.slice(1); })()}{priceDisplay ? ` — ${priceDisplay}` : ''}
            </Text>
            <Text style={[
              styles.machineStatus,
              isOccupied && styles.machineStatusOccupied,
              outOfService && styles.machineStatusOutOfService,
            ]}>
              {outOfService
                ? t('machineOutOfService')
                : isOccupied
                ? t('unavailable')
                : espOfflineButDbFree
                  ? !espStatusReady
                    ? t('checkingEsp')
                    : t('machineRemoteUnavailable')
                  : dbFree && espConfirmedOnline
                    ? t('available')
                    : machine.statut || t('available')}
            </Text>
          </View>
          {isSelected && (
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color={colors.primary}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={listRefreshing} onRefresh={onRefreshList} colors={[colors.primary]} />
        }
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{t('chooseMachine')}</Text>
          <Text style={styles.location}>{laundryName}</Text>
        </View>

        {user?.id && isSupabaseConfigured() ? (
          <View style={styles.walletStrip}>
            <MaterialCommunityIcons name="wallet-outline" size={22} color={colors.primary} />
            <View style={styles.walletStripText}>
              <Text style={styles.walletStripLabel}>{t('walletRemainingLabel')}</Text>
              <Text style={styles.walletStripAmount}>
                {walletBalanceCentimes == null ? '—' : `${(walletBalanceCentimes / 100).toFixed(2)} €`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={goToWalletQuick}
              style={styles.walletStripPlus}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('walletRechargeQuick')}
            >
              <MaterialCommunityIcons name="plus-circle" size={30} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.machineList}>
          {availableMachines.length === 0 ? (
            <Text style={styles.emptyText}>{t('noMachineAvailable')}</Text>
          ) : (
            <>
              {washerMachines.length > 0 && (
                <View>
                  <Text style={styles.machineSectionTitle}>{t('sectionWashers')}</Text>
                  {washerMachines.map(renderMachineRow)}
                </View>
              )}
              {dryerMachines.length > 0 && (
                <View style={washerMachines.length > 0 ? styles.machineSectionSpaced : undefined}>
                  <Text style={styles.machineSectionTitle}>{t('sectionDryers')}</Text>
                  {dryerMachines.map(renderMachineRow)}
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.paySection}>
          {selectedMachineOutOfService ? (
            <View style={styles.offlineBox}>
              <Text style={styles.outOfServiceMessage}>{t('machineOutOfService')}</Text>
            </View>
          ) : selectedMachine && selectedEspOnline !== true && (
            <View style={styles.offlineBox}>
              <Text style={styles.offlineMessage}>
                {!espStatusReady ? t('checkingEsp') : t('machineOffline')}
              </Text>
            </View>
          )}
          {selectedMachineBusy && selectedEspOnline === true && (
            <TouchableOpacity style={styles.releaseButton} onPress={handleForceAvailable}>
              <Text style={styles.releaseButtonText}>{t('machineStoppedRelease')}</Text>
            </TouchableOpacity>
          )}
          <Button
            title={selectedMachine && getMachineAmount() > 0 ? `${t('paid')} — ${getMachineAmount().toFixed(2)} €` : t('paid')}
            onPress={handlePay}
            size="lg"
            disabled={!selectedMachine || !isOnline || selectedMachineBusy || selectedMachineOutOfService}
          />
          <Text style={styles.stripeNote}>
            {t('cardOrPromo')}
          </Text>
        </View>
      </ScrollView>

      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        allowCardPayment={false}
        machine={selectedMachineFromList}
        machineLabel={selectedMachineFromList ? `${selectedMachineFromList.name || selectedMachineFromList.nom}` : ''}
        amount={getMachineAmount()}
        walletBalanceCentimes={walletBalanceCentimes}
        priceCentimes={getMachinePriceCentimes()}
        onPayWithWallet={handlePayWithWallet}
        onGoToWallet={goToWallet}
        onPayByCard={handlePayByCard}
        onPayWithPromo={handlePayWithPromo}
        availablePromoCodes={availablePromoCodes}
      />

      <DurationModal
        visible={durationModalVisible}
        onClose={handleDurationModalClose}
        onSubmit={handleDurationSubmit}
        loading={durationSubmitBusy}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backText: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: typography.semibold,
    marginLeft: spacing.xs,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  location: {
    fontSize: typography.lg,
    color: colors.textSecondary,
  },
  walletStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  walletStripText: {
    flex: 1,
  },
  walletStripLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  walletStripAmount: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
  },
  walletStripPlus: {
    padding: spacing.xs,
  },
  machineList: {
    marginBottom: spacing.xl,
  },
  machineSectionSpaced: {
    marginTop: spacing.lg,
  },
  machineSectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  machineCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    ...Platform.select({
      web: { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  machineCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  machineCardOccupied: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  machineCardOutOfService: {
    borderColor: colors.error,
    backgroundColor: colors.error + '12',
  },
  machineCardWarning: {
    borderColor: colors.warning,
    backgroundColor: colors.warning + '18',
  },
  statusBar: {
    width: 6,
    borderRadius: 3,
  },
  machineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  machineInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  machineName: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  machineStatus: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  machineStatusOccupied: {
    color: '#DC2626',
    fontWeight: typography.semibold,
  },
  machineStatusOutOfService: {
    color: colors.error,
    fontWeight: typography.semibold,
  },
  machineStatusSub: {
    fontSize: typography.xs,
    color: colors.warning,
    marginTop: spacing.xs,
    fontWeight: typography.medium,
  },
  machinePrice: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  paySection: {
    marginTop: spacing.lg,
  },
  releaseButton: {
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.warning + '1A',
  },
  releaseButtonText: {
    color: colors.warning,
    textAlign: 'center',
    fontWeight: typography.semibold,
    fontSize: typography.sm,
  },
  offlineBox: {
    marginBottom: spacing.md,
  },
  offlineMessage: {
    fontSize: typography.sm,
    color: colors.warning,
    marginBottom: spacing.xs,
    textAlign: 'center',
    fontWeight: typography.semibold,
  },
  outOfServiceMessage: {
    fontSize: typography.sm,
    color: colors.error,
    marginBottom: spacing.xs,
    textAlign: 'center',
    fontWeight: typography.semibold,
  },
  offlineMessageSub: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stripeNote: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
