const CACHE_DB_NAME = 'wave-offline-cache';
const CACHE_DB_VERSION = 1;
const SNAPSHOT_STORE = 'conversation-snapshots';
const CACHED_USER_KEY = 'wave-cached-user';
const MAX_MESSAGES_PER_CONVERSATION = 50;

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withSnapshotStore(mode, operation) {
  if (!canUseIndexedDb()) return Promise.resolve(undefined);

  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(SNAPSHOT_STORE, mode);
        const request = operation(transaction.objectStore(SNAPSHOT_STORE));
        transaction.oncomplete = () => {
          database.close();
          resolve(request?.result);
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error);
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error);
        };
      })
  );
}

export function getCachedUser() {
  if (typeof window === 'undefined') return null;
  try {
    const user = JSON.parse(window.localStorage.getItem(CACHED_USER_KEY));
    return user && (user.id || user._id) ? user : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user) {
  if (typeof window === 'undefined' || !user) return;
  try {
    window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  } catch {
    // Offline cache is best-effort; storage can be disabled or full.
  }
}

export function clearCachedUser() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CACHED_USER_KEY);
  } catch {
    // Logout must still succeed if browser storage is unavailable.
  }
}

export async function getConversationSnapshot(userId) {
  if (!userId) return null;
  try {
    return (await withSnapshotStore('readonly', (store) => store.get(String(userId)))) || null;
  } catch {
    return null;
  }
}

export async function saveConversationSnapshot({
  userId,
  conversations,
  messagesMap,
  activeConversationId,
}) {
  if (!userId) return;

  const recentMessagesMap = Object.fromEntries(
    Object.entries(messagesMap).map(([conversationId, messages]) => [
      conversationId,
      messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
    ])
  );

  try {
    await withSnapshotStore('readwrite', (store) =>
      store.put({
        userId: String(userId),
        conversations,
        messagesMap: recentMessagesMap,
        activeConversationId,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Live state remains authoritative when persistence is unavailable.
  }
}

export async function clearConversationSnapshot(userId) {
  if (!userId) return;
  try {
    await withSnapshotStore('readwrite', (store) => store.delete(String(userId)));
  } catch {
    // Logout must still succeed if browser storage is unavailable.
  }
}
