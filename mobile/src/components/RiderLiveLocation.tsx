/** Keeps rider GPS flowing to ops while the partner app is open and online. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { config } from '@/config';
import {
  startRiderBackgroundLocation,
  stopRiderBackgroundLocation,
} from '@/lib/background-location';
import { useRiderLocationBroadcast, type LocationStatus } from '@/lib/rider-location';

interface RiderLocationContextValue {
  status: LocationStatus;
  lastError: string | null;
}

const RiderLocationContext = createContext<RiderLocationContextValue>({
  status: 'idle',
  lastError: null,
});

export function useRiderLocationStatus() {
  return useContext(RiderLocationContext);
}

export function RiderLiveLocation({ children }: { children?: ReactNode }) {
  const { token, isApproved } = useAuth();
  const [online, setOnline] = useState(false);
  // True once background updates are actually running, so we don't also post
  // from the foreground interval (avoids double-posting every tick).
  const [backgroundActive, setBackgroundActive] = useState(false);

  useEffect(() => {
    if (!token || !isApproved) {
      setOnline(false);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const me = await api.me();
        if (!cancelled) setOnline(me.rider_profile?.is_online ?? false);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };

    void refresh();
    const timer = setInterval(refresh, config.locationIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, isApproved]);

  // Start/stop battery-friendly background tracking as the partner goes on/offline.
  useEffect(() => {
    let cancelled = false;
    if (online && isApproved) {
      void startRiderBackgroundLocation().then((ok) => {
        if (!cancelled) setBackgroundActive(ok);
      });
    } else {
      setBackgroundActive(false);
      void stopRiderBackgroundLocation();
    }
    return () => {
      cancelled = true;
    };
  }, [online, isApproved]);

  // Foreground broadcaster runs only when the background service isn't handling
  // it — i.e. web, Expo Go, or when the "Always" permission was denied.
  const { status, lastError } = useRiderLocationBroadcast(online && isApproved && !backgroundActive);
  const value = useMemo(() => ({ status, lastError }), [status, lastError]);

  return (
    <RiderLocationContext.Provider value={value}>
      {children}
    </RiderLocationContext.Provider>
  );
}
