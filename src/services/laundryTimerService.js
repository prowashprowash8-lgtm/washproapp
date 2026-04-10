/**
 * Minuteur de cycle machine + notification locale ~10 min avant la fin.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const STORAGE_KEY = '@washpro_laundry_timer_v1';
const ANDROID_CHANNEL = 'laundry-timer';

export const DEFAULT_LAUNDRY_DURATION_MIN = 30;
export const REMINDER_MINUTES_BEFORE_END = 10;
export const MIN_DURATION_MIN = 5;
export const MAX_DURATION_MIN = 180;

export function configureLaundryNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Linge',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

async function requestPermissionsIfNeeded() {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * @returns {Promise<{ endTimeMs: number, machineName: string, durationMinutes: number, notificationId?: string } | null>}
 */
export async function loadTimerState() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s.endTimeMs || !s.machineName) return null;
    return s;
  } catch {
    return null;
  }
}

export async function saveTimerState(state) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearTimerState() {
  const s = await loadTimerState();
  if (s?.notificationId && Platform.OS !== 'web') {
    await Notifications.cancelScheduledNotificationAsync(s.notificationId).catch(() => {});
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Rappel idéalement 10 min avant la fin ; si le cycle est plus court, dès que possible avant la fin.
 */
function computeReminderDate(endTimeMs) {
  const prefer = endTimeMs - REMINDER_MINUTES_BEFORE_END * 60 * 1000;
  const now = Date.now();
  if (prefer > now) return prefer;
  const soon = now + 2000;
  if (soon < endTimeMs - 1000) return soon;
  return Math.max(now + 500, endTimeMs - 1000);
}

/**
 * @param {{ endTimeMs: number, machineName: string, title: string, body: string }} params
 * @returns {Promise<string | undefined>}
 */
async function scheduleReminderNotification({ endTimeMs, title, body }) {
  if (Platform.OS === 'web') return undefined;
  const ok = await requestPermissionsIfNeeded();
  if (!ok) return undefined;
  await ensureAndroidChannel();

  const when = computeReminderDate(endTimeMs);
  if (when >= endTimeMs) return undefined;

  const trigger = {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(when),
  };
  if (Platform.OS === 'android') {
    trigger.channelId = ANDROID_CHANNEL;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger,
  });
  return id;
}

/**
 * @param {{ machineName: string, durationMinutes?: number, reminderTitle: string, reminderBody: string }} params
 */
export async function startTimer({
  machineName,
  durationMinutes = DEFAULT_LAUNDRY_DURATION_MIN,
  reminderTitle,
  reminderBody,
}) {
  await clearTimerState();

  const dm = Math.min(MAX_DURATION_MIN, Math.max(MIN_DURATION_MIN, Math.round(durationMinutes)));
  const endTimeMs = Date.now() + dm * 60 * 1000;

  const notificationId = await scheduleReminderNotification({
    endTimeMs,
    title: reminderTitle,
    body: reminderBody,
  });

  const state = {
    endTimeMs,
    machineName,
    durationMinutes: dm,
    notificationId,
  };
  await saveTimerState(state);
  return state;
}

/**
 * Nouvelle durée totale à partir de maintenant (correction utilisateur).
 */
export async function updateTimerDurationMinutes(durationMinutes, { reminderTitle, reminderBody }) {
  const s = await loadTimerState();
  if (!s) return null;
  if (s.notificationId && Platform.OS !== 'web') {
    await Notifications.cancelScheduledNotificationAsync(s.notificationId).catch(() => {});
  }
  const dm = Math.min(MAX_DURATION_MIN, Math.max(MIN_DURATION_MIN, Math.round(durationMinutes)));
  const endTimeMs = Date.now() + dm * 60 * 1000;
  const notificationId = await scheduleReminderNotification({
    endTimeMs,
    title: reminderTitle,
    body: reminderBody,
  });
  const next = { ...s, endTimeMs, durationMinutes: dm, notificationId };
  await saveTimerState(next);
  return next;
}

/**
 * Au cold start : si minuteur encore valide, reprogrammer la notif (IDs invalidés au redémarrage).
 */
export async function hydrateTimerIfNeeded({ reminderTitle, reminderBody }) {
  const s = await loadTimerState();
  if (!s) return null;
  if (s.endTimeMs <= Date.now()) {
    await clearTimerState();
    return null;
  }
  if (s.notificationId && Platform.OS !== 'web') {
    await Notifications.cancelScheduledNotificationAsync(s.notificationId).catch(() => {});
  }
  const notificationId = await scheduleReminderNotification({
    endTimeMs: s.endTimeMs,
    title: reminderTitle,
    body: reminderBody,
  });
  const next = { ...s, notificationId };
  await saveTimerState(next);
  return next;
}
