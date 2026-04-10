import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme/colors';
import Button from '../components/Button';
import { findEmplacementByName, getMachinesByEmplacement } from '../services/laundryService';
import { getSavedLaundry, saveLaundry, clearSavedLaundry } from '../utils/laundryStorage';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function PayScreen({ navigation }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const firstName = user?.user_metadata?.first_name;
  const [emplacementName, setEmplacementName] = useState('');
  const [loading, setLoading] = useState(false);
  const [emplacement, setEmplacement] = useState(null);
  const [machines, setMachines] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!user?.id) return;
    getSavedLaundry(user.id).then(async (saved) => {
      if (saved?.emplacement) {
        setEmplacement(saved.emplacement);
        setEmplacementName(saved.emplacement?.name || saved.emplacement?.nom || '');
        const empId = saved.emplacement?.id;
        if (empId) {
          const { data } = await getMachinesByEmplacement(empId);
          setMachines(data || []);
          if (data?.length) await saveLaundry(user.id, saved.emplacement, data);
        } else {
          setMachines(saved.machines || []);
        }
      }
    });
  }, [user?.id]);

  const handleAccessMachines = async () => {
    if (!user?.id) return;
    const term = emplacementName.trim();
    if (!term) return;

    setLoading(true);
    setError(null);
    setEmplacement(null);
    setMachines([]);

    try {
      const { data: emp, error: empError } = await findEmplacementByName(term);
      if (empError) {
        setError(empError.message);
        return;
      }
      if (!emp) {
        setError(t('noLocationFound'));
        return;
      }

      setEmplacement(emp);

      const { data: machs, error: machError } = await getMachinesByEmplacement(emp.id);
      if (machError) {
        setError(machError.message);
        return;
      }
      setMachines(machs || []);

      await saveLaundry(user.id, emp, machs || []);
    } catch (err) {
      setError(err?.message || t('searchError'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLaundry = () => {
    if (emplacement) {
      navigation.navigate('LaundryDetail', { emplacement, machines: machines || [] });
    }
  };

  const handleChangeLaundry = async () => {
    if (!user?.id) return;
    await clearSavedLaundry(user.id);
    setEmplacement(null);
    setMachines([]);
    setEmplacementName('');
    setError(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {firstName ? (
          <Text style={styles.welcomeText}>Bonjour, {firstName} 👋</Text>
        ) : null}
        <View style={styles.laundryFrame}>
          <Text style={styles.frameTitle}>{t('accessMachines')}</Text>
          <Text style={styles.frameSubtitle}>{t('enterLaundry')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('laundryPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={emplacementName}
            onChangeText={(t) => {
              setEmplacementName(t);
              setError(null);
            }}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading}
          />
          <Button
            title={loading ? t('searching') : t('accessMachinesButton')}
            onPress={handleAccessMachines}
            size="lg"
            loading={loading}
            disabled={loading}
          />

          {error && (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {emplacement && (
            <View style={styles.resultsSection}>
              <TouchableOpacity
                style={styles.resultsTouchable}
                onPress={handleOpenLaundry}
                activeOpacity={0.8}
              >
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsTitle}>
                    {emplacement.nom || emplacement.name} — {machines.length} {t('machinesCount')}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={24} color={colors.primary} />
                </View>
                <Text style={styles.tapHint}>{t('tapToSeeMachines')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.changeLaundryBtn}
                onPress={handleChangeLaundry}
              >
                <MaterialCommunityIcons name="swap-horizontal" size={18} color={colors.textSecondary} />
                <Text style={styles.changeLaundryText}>{t('changeLaundry')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
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
  laundryFrame: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  welcomeText: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  frameTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  frameSubtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.base,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.error,
    fontWeight: typography.medium,
  },
  resultsSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultsTouchable: {
    marginBottom: spacing.md,
  },
  changeLaundryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  changeLaundryText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsTitle: {
    flex: 1,
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  tapHint: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
