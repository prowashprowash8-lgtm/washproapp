import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useLanguage } from './LanguageContext';
import {
  loadTimerState,
  startTimer as startTimerService,
  clearTimerState,
  updateTimerDurationMinutes,
  hydrateTimerIfNeeded,
  DEFAULT_LAUNDRY_DURATION_MIN,
  MIN_DURATION_MIN,
  MAX_DURATION_MIN,
} from '../services/laundryTimerService';

const LaundryTimerContext = createContext(null);

function buildReminderStrings(t, machineName) {
  return {
    reminderTitle: t('laundryReminderTitle'),
    reminderBody: t('laundryReminderBody').replace(/\{machine\}/g, machineName || ''),
  };
}

export function LaundryTimerProvider({ children }) {
  const { t } = useLanguage();
  const [timer, setTimer] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [ready, setReady] = useState(false);
  const endTimeRef = useRef(0);

  useEffect(() => {
    endTimeRef.current = timer?.endTimeMs ?? 0;
    if (timer?.endTimeMs) {
      setRemainingMs(Math.max(0, timer.endTimeMs - Date.now()));
    } else {
      setRemainingMs(0);
    }
  }, [timer]);

  const refreshFromStorage = useCallback(async () => {
    const s = await loadTimerState();
    if (!s) {
      setTimer(null);
      return;
    }
    if (s.endTimeMs <= Date.now()) {
      await clearTimerState();
      setTimer(null);
      return;
    }
    setTimer(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await loadTimerState();
      if (cancelled) return;
      if (s && s.endTimeMs > Date.now()) {
        const { reminderTitle, reminderBody } = buildReminderStrings(t, s.machineName);
        await hydrateTimerIfNeeded({ reminderTitle, reminderBody });
        const next = await loadTimerState();
        if (!cancelled) setTimer(next);
      } else if (s) {
        await clearTimerState();
        if (!cancelled) setTimer(null);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshFromStorage();
    });
    return () => sub.remove();
  }, [refreshFromStorage]);

  useEffect(() => {
    if (!endTimeRef.current) return undefined;
    const id = setInterval(() => {
      const r = Math.max(0, endTimeRef.current - Date.now());
      setRemainingMs(r);
      if (r <= 0) {
        clearTimerState().then(() => setTimer(null));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [timer?.endTimeMs]);

  const startTimer = useCallback(
    async ({ machineName, durationMinutes = DEFAULT_LAUNDRY_DURATION_MIN }) => {
      const { reminderTitle, reminderBody } = buildReminderStrings(t, machineName);
      const state = await startTimerService({
        machineName: machineName || t('machine'),
        durationMinutes,
        reminderTitle,
        reminderBody,
      });
      setTimer(state);
    },
    [t]
  );

  const updateDuration = useCallback(
    async (durationMinutes) => {
      const { reminderTitle, reminderBody } = buildReminderStrings(t, timer?.machineName);
      const next = await updateTimerDurationMinutes(durationMinutes, { reminderTitle, reminderBody });
      if (next) setTimer(next);
    },
    [t, timer?.machineName]
  );

  const stopTimer = useCallback(async () => {
    await clearTimerState();
    setTimer(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      timer,
      remainingMs,
      remainingMinutes: Math.ceil(remainingMs / 60000),
      startTimer,
      updateDuration,
      stopTimer,
      minDurationMin: MIN_DURATION_MIN,
      maxDurationMin: MAX_DURATION_MIN,
      defaultDurationMin: DEFAULT_LAUNDRY_DURATION_MIN,
      refresh: refreshFromStorage,
    }),
    [ready, timer, remainingMs, startTimer, updateDuration, stopTimer, refreshFromStorage]
  );

  return <LaundryTimerContext.Provider value={value}>{children}</LaundryTimerContext.Provider>;
}

export function useLaundryTimer() {
  const ctx = useContext(LaundryTimerContext);
  if (!ctx) {
    throw new Error('useLaundryTimer must be used within LaundryTimerProvider');
  }
  return ctx;
}
