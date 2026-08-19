import { deleteToken, getToken } from 'firebase/messaging';
import {
  deletePushTokenApi,
  getPushPublicKeyApi,
  savePushTokenApi,
} from './api';
import { getMessagingIfSupported, isFirebaseConfigured } from './firebaseClient';

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    isFirebaseConfigured()
  );
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * FCM is told to reuse Wave's own service worker rather than the SDK default
 * `firebase-messaging-sw.js`, so pushes land in the existing `push` handler in
 * `public/sw.js` — one worker, one notification, and the focused-window
 * suppression there keeps working.
 *
 * PwaRegistrar registers the worker on window `load`, so an early call can race it.
 * Wait on `serviceWorker.ready`, but with a timeout: in development PwaRegistrar
 * unregisters the worker and `ready` would never resolve.
 */
const SW_READY_TIMEOUT_MS = 10_000;

async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;

  const existing = await navigator.serviceWorker.getRegistration('/').catch(() => null);
  if (existing?.active) return existing;

  return Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(existing || null), SW_READY_TIMEOUT_MS)),
  ]);
}

/** Non-null only when this browser already holds an FCM push subscription. */
export async function getExistingPushSubscription() {
  const registration = await getServiceWorkerRegistration();
  if (!registration?.pushManager) return null;
  return registration.pushManager.getSubscription().catch(() => null);
}

/**
 * Mint the FCM registration token for this browser and hand it to the server.
 * Safe to call repeatedly: FCM returns the same token until it rotates, and the
 * server upserts by token, so a rotation replaces the old row.
 */
async function registerToken({ vapidKey, registration }) {
  const messaging = await getMessagingIfSupported();
  if (!messaging) throw new Error('This browser cannot receive push notifications.');

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('Firebase did not return a registration token.');

  await savePushTokenApi(token);
  return token;
}

/** Ask for permission, register with FCM and persist the token server-side. */
export async function enablePushNotifications() {
  if (!isPushSupported()) {
    throw new Error('This browser cannot receive push notifications.');
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error(
      'The Wave service worker is not registered yet. Reload the app and try again.'
    );
  }

  const { enabled, publicKey } = await getPushPublicKeyApi();
  if (!enabled || !publicKey) {
    throw new Error('Push notifications are not configured on the server.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  return registerToken({ vapidKey: publicKey, registration });
}

/**
 * Re-send the current token on launch so a rotated token never leaves the server
 * pushing to a dead one. Silent by design: never prompts, never throws.
 */
export async function syncPushToken() {
  if (!isPushSupported() || getNotificationPermission() !== 'granted') return null;

  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;

  try {
    const { enabled, publicKey } = await getPushPublicKeyApi();
    if (!enabled || !publicKey) return null;
    return await registerToken({ vapidKey: publicKey, registration });
  } catch {
    return null;
  }
}

/**
 * Ask for notification permission as soon as the app opens, then register the token.
 *
 * Chrome and Edge allow `Notification.requestPermission()` with no user gesture, so
 * the prompt appears immediately. Firefox and Safari — including an installed iOS
 * PWA — reject a gesture-less call, so the first tap or keypress retries it. Already
 * granted means no prompt, just a token refresh; already denied means nothing at all,
 * because the browser will not re-prompt and Settings owns the recovery copy.
 *
 * Returns a cleanup function for the calling effect.
 */
export function requestPushOnLaunch() {
  const permission = getNotificationPermission();
  if (!isPushSupported() || permission === 'denied' || permission === 'unsupported') {
    return () => {};
  }
  if (permission === 'granted') {
    syncPushToken();
    return () => {};
  }

  const GESTURES = ['pointerdown', 'keydown'];
  let inFlight = false;

  const disarm = () => {
    GESTURES.forEach((name) => window.removeEventListener(name, onGesture));
  };

  async function attempt() {
    if (inFlight) return;
    inFlight = true;
    try {
      await enablePushNotifications();
      disarm();
    } catch {
      // A gesture-less prompt leaves permission at 'default'. Anything else — denied,
      // or a real registration failure — is not worth retrying on every tap.
      if (getNotificationPermission() !== 'default') disarm();
    } finally {
      inFlight = false;
    }
  }

  function onGesture() {
    disarm();
    attempt();
  }

  GESTURES.forEach((name) => window.addEventListener(name, onGesture, { once: true }));
  attempt();

  return disarm;
}

export async function disablePushNotifications() {
  const messaging = await getMessagingIfSupported();
  const registration = await getServiceWorkerRegistration();
  if (!messaging || !registration) return;

  const { publicKey } = await getPushPublicKeyApi().catch(() => ({ publicKey: '' }));

  // Read the token before deleting it — the server row is keyed by it.
  const token = await getToken(messaging, {
    vapidKey: publicKey,
    serviceWorkerRegistration: registration,
  }).catch(() => null);

  // deleteToken also drops the underlying PushManager subscription, which is what
  // getExistingPushSubscription reads, so the UI flips back to "off".
  await deleteToken(messaging).catch(() => {});
  if (token) await deletePushTokenApi(token).catch(() => {});
}
