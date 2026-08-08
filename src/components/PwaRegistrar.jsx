'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

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

  if (!waitingWorker) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[130] flex justify-center px-4 md:bottom-6">
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white/95 p-3 shadow-2xl backdrop-blur">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-secondary-container text-primary">
          <RefreshCw className={`h-4 w-4 ${isReloading ? 'animate-spin' : ''}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-on-surface">A new version is ready</p>
          <p className="text-[11px] text-outline">Reload to get the latest version.</p>
        </div>
        <button
          type="button"
          onClick={applyUpdate}
          disabled={isReloading}
          className="flex-shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-transform active:scale-95 disabled:opacity-60"
        >
          {isReloading ? 'Updating…' : 'Reload'}
        </button>
      </div>
    </div>
  );
}
