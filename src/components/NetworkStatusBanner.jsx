'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { CloudOff, Clock3, Wifi } from 'lucide-react';
import { getQueuedCount, requestOutboxSync } from '../services/outbox';

function subscribeToConnectivity(onChange) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Thin status strip: offline state and how many messages are waiting in the
 * IndexedDB outbox. Shown above the app chrome so it never covers the composer.
 */
export function NetworkStatusBanner() {
  const isOnline = useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    () => true
  );
  const [queuedCount, setQueuedCount] = useState(0);
  const [justReconnected, setJustReconnected] = useState(false);

  const refreshQueue = useCallback(() => {
    getQueuedCount()
      .then(setQueuedCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setJustReconnected(true);
      requestOutboxSync().catch(() => {});
      window.setTimeout(() => setJustReconnected(false), 2500);
      refreshQueue();
    };
    const handleQueueChange = () => refreshQueue();

    refreshQueue();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleQueueChange);
    window.addEventListener('pingme:outbox-changed', handleQueueChange);
    window.addEventListener('pingme:outbox-flushed', handleQueueChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleQueueChange);
      window.removeEventListener('pingme:outbox-changed', handleQueueChange);
      window.removeEventListener('pingme:outbox-flushed', handleQueueChange);
    };
  }, [refreshQueue]);

  const showQueueOnly = isOnline && queuedCount > 0;
  if (isOnline && !showQueueOnly && !justReconnected) return null;

  const tone = !isOnline
    ? 'bg-slate-900 text-white'
    : showQueueOnly
      ? 'bg-amber-500 text-slate-900'
      : 'bg-emerald-600 text-white';

  return (
    <div
      role="status"
      className={`fixed inset-x-0 top-0 z-[115] flex items-center justify-center gap-2 px-4 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-[11px] font-semibold shadow-md ${tone}`}
    >
      {!isOnline ? (
        <>
          <CloudOff className="h-3.5 w-3.5" />
          <span>
            Offline
            {queuedCount > 0
              ? ` · ${queuedCount} message${queuedCount === 1 ? '' : 's'} queued`
              : ' · messages will send when you reconnect'}
          </span>
        </>
      ) : showQueueOnly ? (
        <>
          <Clock3 className="h-3.5 w-3.5" />
          <span>
            Sending {queuedCount} queued message{queuedCount === 1 ? '' : 's'}…
          </span>
        </>
      ) : (
        <>
          <Wifi className="h-3.5 w-3.5" />
          <span>Back online</span>
        </>
      )}
    </div>
  );
}
