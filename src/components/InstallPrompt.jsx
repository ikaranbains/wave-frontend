'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const DISMISS_STORAGE_KEY = 'pingme:install-dismissed';
export const INSTALL_REQUEST_EVENT = 'wave:request-install';
export const INSTALL_STATUS_REQUEST_EVENT = 'wave:request-install-status';
export const INSTALL_STATUS_EVENT = 'wave:install-status';

function emitInstallStatus(canInstall) {
  window.dispatchEvent(
    new CustomEvent(INSTALL_STATUS_EVENT, {
      detail: { canInstall, isInstalled: isStandaloneDisplay() },
    })
  );
}

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true
  );
}

/**
 * Install affordance. Chromium fires `beforeinstallprompt`, which we defer so the
 * user can install from our own button; iOS Safari has no such event, so it gets
 * Add-to-Home-Screen instructions instead.
 */
export function InstallPrompt() {
  const deferredPromptRef = useRef(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, '1');
    setIsVisible(false);
  }, []);

  const install = useCallback(async () => {
    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPromptRef.current = null;
    emitInstallStatus(false);
    if (outcome === 'accepted') setIsVisible(false);
    else dismiss();
  }, [dismiss]);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      emitInstallStatus(false);
      return undefined;
    }

    const isDismissed = window.localStorage.getItem(DISMISS_STORAGE_KEY) === '1';

    // Platform sniffing happens after mount, applied on a microtask so the first
    // render stays identical to the server output.
    const detectPlatform = async () => {
      await Promise.resolve();
      const iosDevice =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

      setIsIOS(iosDevice && isSafari);
      if (iosDevice && isSafari && !isDismissed) setIsVisible(true);
    };
    detectPlatform();

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      if (!isDismissed) setIsVisible(true);
      emitInstallStatus(true);
    };
    const handleInstalled = () => {
      setIsVisible(false);
      deferredPromptRef.current = null;
      emitInstallStatus(false);
    };
    const handleStatusRequest = () => emitInstallStatus(Boolean(deferredPromptRef.current));

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener(INSTALL_REQUEST_EVENT, install);
    window.addEventListener(INSTALL_STATUS_REQUEST_EVENT, handleStatusRequest);
    queueMicrotask(handleStatusRequest);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener(INSTALL_REQUEST_EVENT, install);
      window.removeEventListener(INSTALL_STATUS_REQUEST_EVENT, handleStatusRequest);
    };
  }, [install]);

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[125] flex justify-center px-4 md:bottom-6">
      <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-outline-variant/60 bg-white/95 p-3 shadow-2xl backdrop-blur">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-secondary-container text-primary">
          {isIOS ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-on-surface">Install Wave</p>
          {isIOS ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-outline">
              Tap Share, then “Add to Home Screen” to get calls, chats and notifications
              like a native app.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-[11px] text-outline">
                Add it to your device for full-screen chats and notifications.
              </p>
              <button
                type="button"
                onClick={install}
                className="mt-2 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95"
              >
                Install app
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="flex-shrink-0 rounded-full p-1 text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
