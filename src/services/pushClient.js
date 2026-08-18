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
 * `getRegistration` rather than `serviceWorker.ready`: in development
 * PwaRegistrar unregisters the worker, and `ready` would never resolve.
 */
async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration('/')) || null;
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
