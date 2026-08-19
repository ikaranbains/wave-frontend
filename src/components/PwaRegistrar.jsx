'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;
export const UPDATE_REQUEST_EVENT = 'wave:request-update';
export const UPDATE_STATUS_EVENT = 'wave:update-status';

export function PwaRegistrar() {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [isReloading, setIsReloading] = useState(false);
  const isReloadingRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    // Dev chunks are re-hashed on every edit, so a cached copy of `/_next/static`
    // gets served against freshly compiled HTML and the app dies on a missing
    // module factory. Tear any worker down instead of registering one.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((worker) => worker.unregister()))
        )
        .then(() => caches?.keys())
        .then((keys) =>
          Promise.all(
            (keys || [])
              .filter((key) => key.startsWith('pingme-'))
              .map((key) => caches.delete(key))
          )
        )
        .catch(() => {});
      return undefined;
    }

    let registration;
    let updateTimer;
    let hasReloaded = false;

    const trackWaiting = (activeRegistration) => {
      if (activeRegistration.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(activeRegistration.waiting);
      }
    };

    const handleUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(installing);
        }
      });
    };

    const handleControllerChange = () => {
      // Only reload for an update the user accepted, never on first install.
      if (hasReloaded || !isReloadingRef.current) return;
      hasReloaded = true;
      window.location.reload();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => {});
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        trackWaiting(registration);
        registration.addEventListener('updatefound', handleUpdateFound);
        updateTimer = window.setInterval(
          () => registration?.update().catch(() => {}),
          UPDATE_CHECK_INTERVAL
        );
        document.addEventListener('visibilitychange', handleVisibilityChange);
      } catch (error) {
        console.warn('Wave service worker registration failed:', error);
      }
    };

    const handleMessage = (event) => {
      const type = event.data?.type;
      if (type === 'PINGME_OPEN_CONVERSATION') {
        window.dispatchEvent(
          new CustomEvent('pingme:open-conversation', {
            detail: { conversationId: event.data.conversationId },
          })
        );
      }
      if (type === 'PINGME_OUTBOX_FLUSHED') {
        window.dispatchEvent(
          new CustomEvent('pingme:outbox-flushed', {
            detail: { sent: event.data.sent, remaining: event.data.remaining },
          })
        );
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      if (updateTimer) window.clearInterval(updateTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    isReloadingRef.current = true;
    setIsReloading(true);
    waitingWorker.postMessage({ type: 'PINGME_SKIP_WAITING' });
  }, [waitingWorker]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(UPDATE_STATUS_EVENT, {
        detail: { available: Boolean(waitingWorker), updating: isReloading },
      })
    );
    window.addEventListener(UPDATE_REQUEST_EVENT, applyUpdate);
    return () => window.removeEventListener(UPDATE_REQUEST_EVENT, applyUpdate);
  }, [applyUpdate, isReloading, waitingWorker]);

  return null;
}
