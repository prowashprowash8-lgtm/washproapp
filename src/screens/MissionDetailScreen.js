import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getMySubmissionForMission, submitMissionWithPhotos } from '../services/missionService';

export default function MissionDetailScreen({ route, navigation }) {
  const { mission, emplacement } = route.params || {};
  const { t } = useLanguage();
  const { user } = useAuth();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState([]); // [{ uri, base64 }]
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!mission?.id) {
      setLoading(false);
      return;
    }
    getMySubmissionForMission(mission.id, user?.id).then(({ data }) => {
      setSubmission(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [mission?.id, user?.id]);

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('error'), t('cameraPermissionDenied'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        setPhotos((p) => [...p, { uri: a.uri, base64: a.base64 }]);
      }
    } catch (err) {
      Alert.alert(t('error'), err?.message || t('cameraError'));
    }
  };

  const pickFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('error'), t('photoPermissionDenied'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.length) {
        const newPhotos = result.assets.map((a) => ({ uri: a.uri, base64: a.base64 }));
        setPhotos((p) => [...p, ...newPhotos]);
      }
    } catch (err) {
      Alert.alert(t('error'), err?.message || t('photoError'));
    }
  };

  const removePhoto = (index) => {
    setPhotos((p) => p.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (photos.length === 0) {
      Alert.alert(t('error'), t('addAtLeastOnePhoto'));
      return;
    }
    if (!mission?.id || !emplacement?.id) return;

    setSending(true);
    const payload = photos.map((p) => (p?.base64 && p.base64.length > 50 ? p.base64 : p?.uri)).filter(Boolean);
    const { error, photoUrls } = await submitMissionWithPhotos(
      mission.id,
      emplacement.id,
      user?.id || null,
      payload.filter(Boolean)
    );
    setSending(false);

    if (error) {
      const msg = error?.code === 'MISSION_ALREADY_TAKEN' ? t('missionAlreadyTaken') : (error?.message || t('sendError'));
      const onOk = error?.code === 'MISSION_ALREADY_TAKEN' ? () => navigation.goBack() : undefined;
      Alert.alert(t('error'), msg, onOk ? [{ text: t('ok'), onPress: onOk }] : undefined);
      return;
    }
    setSubmission({ status: 'completed', photo_urls: photoUrls || [] });
    setPhotos([]);
    Alert.alert(t('missionCompleted'), t('missionCompletedHint'), [
      { text: t('ok'), onPress: () => navigation.goBack() },
    ]);
  };

  if (!mission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>{t('error')}</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isCompleted = submission?.status === 'completed';
  const displayPhotos = isCompleted ? (submission.photo_urls || []) : photos;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{mission.titre}</Text>
        {mission.description ? <Text style={styles.description}>{mission.description}</Text> : null}
        {mission.recompense ? (
          <View style={styles.rewardBadge}>
            <MaterialCommunityIcons name="gift" size={20} color={colors.secondary} />
            <Text style={styles.rewardText}>{mission.recompense}</Text>
          </View>
        ) : null}

        {isCompleted ? (
          <View style={styles.completedBox}>
            <MaterialCommunityIcons name="check-circle" size={48} color={colors.success} />
            <Text style={styles.completedTitle}>{t('missionCompleted')}</Text>
            <Text style={styles.completedHint}>{t('missionCompletedDone')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t('takePhotos')}</Text>
            <Text style={styles.photoHint}>{t('photoHint')}</Text>
            <View style={styles.photoButtons}>
              <TouchableOpacity style={[styles.photoBtn, styles.photoBtnPrimary]} onPress={pickFromLibrary}>
                <MaterialCommunityIcons name="image-multiple" size={36} color={colors.primary} />
                <Text style={styles.photoBtnText}>{t('gallery')}</Text>
                <Text style={styles.photoBtnSub}>{t('gallerySub')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                <MaterialCommunityIcons name="camera" size={32} color={colors.primary} />
                <Text style={styles.photoBtnText}>{t('camera')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {displayPhotos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              {isCompleted ? t('sentPhotos') : t('photosToSend')} ({displayPhotos.length})
            </Text>
            <View style={styles.photosGrid}>
              {displayPhotos.map((item, index) => {
                const uri = typeof item === 'string' ? item : item?.uri;
                return (
                <View key={index} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                  {!isCompleted && (
                    <TouchableOpacity
                      style={styles.removePhotoBtn}
                      onPress={() => removePhoto(index)}
                    >
                      <MaterialCommunityIcons name="close-circle" size={28} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
              })}
            </View>
          </>
        )}

        {!isCompleted && photos.length > 0 && (
          <TouchableOpacity
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="send" size={22} color="#FFF" />
                <Text style={styles.sendBtnText}>{t('send')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  backText: { fontSize: typography.base, color: colors.primary, fontWeight: typography.semibold },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary + '20',
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  rewardText: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.secondary },
  completedBox: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.success + '15',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  completedTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.success,
    marginTop: spacing.md,
  },
  completedHint: { fontSize: typography.sm, color: colors.textSecondary, marginTop: spacing.xs },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  photoButtons: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  photoBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  photoBtnPrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  photoBtnText: { fontSize: typography.sm, color: colors.textSecondary, marginTop: spacing.sm },
  photoBtnSub: { fontSize: 10, color: colors.primary, marginTop: 2, fontWeight: typography.semibold },
  photoHint: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  photoWrapper: { position: 'relative' },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.border,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: '#FFF' },
});
