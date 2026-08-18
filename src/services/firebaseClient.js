import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Messaging is the only Firebase product Wave uses, so these are all it needs. */
export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId
  );
}

function getFirebaseApp() {
  // Fast refresh re-runs this module, and initializeApp throws on a duplicate name.
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Returns the Messaging instance, or null when this browser cannot support it
 * (no service worker, no push, or IndexedDB blocked as in Safari private mode).
 */
export async function getMessagingIfSupported() {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) return null;
  if (!(await isSupported().catch(() => false))) return null;

  try {
    return getMessaging(getFirebaseApp());
  } catch {
    return null;
  }
}
