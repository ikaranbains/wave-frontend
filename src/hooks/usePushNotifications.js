'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  disablePushNotifications,
  enablePushNotifications,
  getExistingPushSubscription,
  getNotificationPermission,
  isPushSupported,
} from '../services/pushClient';
import { isFirebaseConfigured } from '../services/firebaseClient';
import { getPushPublicKeyApi } from '../services/api';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  // NEXT_PUBLIC_FIREBASE_* are inlined at build time, so a deploy built without them
  // silently disables push. Tracked separately from isSupported to say so out loud.
  const [isAppConfigured, setIsAppConfigured] = useState(true);
  const [isServerConfigured, setIsServerConfigured] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    // Browser capabilities are only knowable on the client, so they are read after
    // mount and applied asynchronously to keep the first render deterministic.
    const detectCapabilities = async () => {
      const supported = isPushSupported();
      const subscription = supported
        ? await getExistingPushSubscription().catch(() => null)
        : null;
      if (!active) return;

      setIsSupported(supported);
      setIsAppConfigured(isFirebaseConfigured());
      setPermission(getNotificationPermission());
      setIsSubscribed(Boolean(subscription));

      if (!supported) return;

      try {
        const { enabled } = await getPushPublicKeyApi();
        if (active) setIsServerConfigured(Boolean(enabled));
      } catch {
        if (active) setIsServerConfigured(false);
      }
    };

    detectCapabilities();

    return () => {
      active = false;
    };
  }, []);

  const subscribe = useCallback(async () => {
    setIsBusy(true);
    setError('');
    try {
      await enablePushNotifications();
      setIsSubscribed(true);
      setPermission(getNotificationPermission());
    } catch (subscribeError) {
      setError(subscribeError.message || 'Unable to enable notifications');
      setPermission(getNotificationPermission());
    } finally {
      setIsBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setIsBusy(true);
    setError('');
    try {
      await disablePushNotifications();
      setIsSubscribed(false);
    } catch (unsubscribeError) {
      setError(unsubscribeError.message || 'Unable to disable notifications');
    } finally {
      setIsBusy(false);
    }
  }, []);

  return {
    isSupported,
    isAppConfigured,
    isServerConfigured,
    permission,
    isSubscribed,
    isBusy,
    error,
    subscribe,
    unsubscribe,
  };
}
