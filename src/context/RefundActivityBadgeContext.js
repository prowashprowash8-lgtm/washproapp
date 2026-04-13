import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { countUnseenRefundResponses, markRefundResponsesSeen } from '../services/transactionService';

const RefundActivityBadgeContext = createContext({
  unseenCount: 0,
  refresh: async () => {},
  markAllSeen: async () => {},
});

export function RefundActivityBadgeProvider({ userId, children }) {
  const [unseenCount, setUnseenCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnseenCount(0);
      return;
    }
    const { count, error } = await countUnseenRefundResponses(userId);
    if (!error) setUnseenCount(count);
  }, [userId]);

  const markAllSeen = useCallback(async () => {
    if (!userId) return;
    const { error } = await markRefundResponsesSeen(userId);
    if (!error) setUnseenCount(0);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId || !supabase) return;
    const channel = supabase
      .channel(`refund-badge-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'refund_requests',
          filter: `user_id=eq.${userId}`,
        },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId) return;
    const t = setInterval(() => refresh(), 45_000);
    return () => clearInterval(t);
  }, [userId, refresh]);

  const value = useMemo(
    () => ({ unseenCount, refresh, markAllSeen }),
    [unseenCount, refresh, markAllSeen]
  );

  return (
    <RefundActivityBadgeContext.Provider value={value}>{children}</RefundActivityBadgeContext.Provider>
  );
}

export function useRefundActivityBadge() {
  return useContext(RefundActivityBadgeContext);
}
