import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { showAlert } from '../utils/alert';
import LanguagePicker from '../components/LanguagePicker';

export default function ProfileScreen({ navigation }) {
  const { user, signOut, updateUser, changePassword } = useAuth();
  const { t } = useLanguage();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const displayName = user?.user_metadata?.first_name || user?.user_metadata?.last_name
    ? [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ')
    : user?.email || t('user');

  const openEditModal = () => {
    setFirstName(user?.user_metadata?.first_name || '');
    setLastName(user?.user_metadata?.last_name || '');
    setEmail(user?.email || '');
    setPhone(user?.user_metadata?.phone || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setError(null);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError(t('authFillAllFields'));
      return;
    }

    const wantsPasswordChange =
      Boolean(currentPassword) || Boolean(newPassword) || Boolean(confirmNewPassword);
    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        setError(t('profilePasswordFieldsRequired'));
        return;
      }
      if (newPassword.length < 6) {
        setError(t('authPasswordMin'));
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError(t('authPasswordMismatch'));
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await updateUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      if (wantsPasswordChange) {
        await changePassword(currentPassword, newPassword);
        showAlert(t('ok'), t('profilePasswordChanged'));
      }
      setEditModalVisible(false);
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('EMAIL_TAKEN') || msg.includes('email est déjà')) {
        setError(t('profileEmailTaken'));
      } else {
        setError(msg || t('updateError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    showAlert(
      t('logoutTitle'),
      t('logoutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('logout'), style: 'destructive', onPress: signOut },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(displayName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.profileName}>{displayName}</Text>
            {user?.email && (
              <Text style={styles.profileEmail}>{user.email}</Text>
            )}
            {user?.user_metadata?.phone ? (
              <Text style={styles.profilePhone}>{user.user_metadata.phone}</Text>
            ) : null}
            <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
              <MaterialCommunityIcons name="pencil" size={18} color={colors.primary} />
              <Text style={styles.editButtonText}>{t('modifyProfile')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.menuSectionTitle}>{t('profileMenuTitle')}</Text>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Wallet')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="wallet-outline" size={24} color={colors.primary} />
            <Text style={styles.menuRowText}>{t('walletTitle')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowSpacing]}
            onPress={() => navigation.navigate('MissionsList')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="target" size={24} color={colors.primary} />
            <Text style={styles.menuRowText}>{t('missions')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowSpacing]}
            onPress={() => navigation.navigate('Aide')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="help-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.menuRowText}>{t('help')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <LanguagePicker variant="row" />
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
            <MaterialCommunityIcons name="logout" size={24} color={colors.error} />
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('editProfile')}</Text>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.inputLabel}>{t('firstName')}</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder={t('firstName')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>{t('lastName')}</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder={t('lastName')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>{t('email')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t('email')}
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>{t('authPhone')}</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder={t('authPhone')}
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />

              <Text style={styles.sectionDivider}>{t('profileChangePasswordSection')}</Text>
              <Text style={styles.hintMuted}>{t('profilePasswordOptionalHint')}</Text>

              <Text style={styles.inputLabel}>{t('profileCurrentPassword')}</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />

              <Text style={styles.inputLabel}>{t('profileNewPassword')}</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('authPasswordMin')}
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />

              <Text style={styles.inputLabel}>{t('profileConfirmNewPassword')}</Text>
              <TextInput
                style={styles.input}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>{t('save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: typography.bold,
    color: '#fff',
  },
  profileName: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  profilePhone: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  editButtonText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.semibold,
  },
  section: {
    marginTop: spacing.lg,
  },
  menuSectionTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  menuRowSpacing: {
    marginTop: spacing.sm,
  },
  menuRowText: {
    flex: 1,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.error,
    gap: spacing.sm,
  },
  logoutText: {
    fontSize: typography.base,
    color: colors.error,
    fontWeight: typography.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalScroll: {
    maxHeight: Platform.OS === 'web' ? 560 : 520,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  sectionDivider: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  hintMuted: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: typography.base,
    color: colors.text,
  },
  errorText: {
    fontSize: typography.sm,
    color: colors.error,
    marginTop: spacing.sm,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
  },
  saveButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  saveButtonText: {
    fontSize: typography.base,
    color: '#fff',
    fontWeight: typography.semibold,
  },
});
