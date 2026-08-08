/**
 * Offline outbox — messages typed without a connection are stored in IndexedDB and
 * replayed once the network returns. The service worker reads the same database so
 * Background Sync can flush the queue even when no tab is open (`public/sw.js`).
 */

const OUTBOX_DB_NAME = 'pingme-pwa';
const OUTBOX_DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';
export const OUTBOX_SYNC_TAG = 'pingme-outbox';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function isSupported() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(OUTBOX_DB_NAME, OUTBOX_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'clientId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction(mode, run) {
  if (!isSupported()) return Promise.resolve(undefined);

  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(OUTBOX_STORE, mode);
        const store = transaction.objectStore(OUTBOX_STORE);
        let result;
        try {
          result = run(store);
        } catch (error) {
          reject(error);
          return;
        }
        transaction.oncomplete = () =>
          resolve(result && 'result' in result ? result.result : result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );
}

export async function enqueueMessage(payload) {
  await runTransaction('readwrite', (store) =>
    store.put({
      clientId: payload.clientId,
      conversationId: payload.conversationId,
      text: payload.text || '',
      attachment: payload.attachment,
      replyTo: payload.replyTo,
      createdAt: Date.now(),
      apiBaseUrl: API_BASE_URL,
    })
  );
  await requestOutboxSync();
}

export function getQueuedMessages() {
  return runTransaction('readonly', (store) => store.getAll()).then((result) => result || []);
}

export function getQueuedCount() {
  return getQueuedMessages().then((messages) => messages.length);
}

export function removeQueuedMessage(clientId) {
  return runTransaction('readwrite', (store) => store.delete(clientId));
}

export function clearOutbox() {
  return runTransaction('readwrite', (store) => store.clear());
}

/** Ask the service worker to flush the queue when the browser next has connectivity. */
export async function requestOutboxSync() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await registration.sync.register(OUTBOX_SYNC_TAG);
      return true;
    }
    // Safari has no Background Sync — fall back to an immediate in-page flush.
    registration.active?.postMessage({ type: 'PINGME_FLUSH_OUTBOX' });
    return false;
  } catch {
    return false;
  }
}
