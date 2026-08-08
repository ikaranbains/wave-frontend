/* Wave service worker — app shell caching, offline outbox flush, web push. */

const SW_VERSION = 'v4';
const SHELL_CACHE = `pingme-shell-${SW_VERSION}`;
const ASSET_CACHE = `pingme-assets-${SW_VERSION}`;
const OFFLINE_URL = '/offline';
const OUTBOX_SYNC_TAG = 'pingme-outbox';

// Install blocks until every entry here is fetched, so this stays to what is
// genuinely needed offline. The 512 icon and the apple touch icon are only read
// by the OS at install/splash time — never rendered by the app — so fetching
// them here just makes activation slower.
const SHELL_ASSETS = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/wave-192.png',
];

/* ------------------------------------------------------------------ */
/* Outbox storage (mirrors src/services/outbox.js — keep both in sync) */
/* ------------------------------------------------------------------ */

const OUTBOX_DB_NAME = 'pingme-pwa';
const OUTBOX_DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';

function openOutboxDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OUTBOX_DB_NAME, OUTBOX_DB_VERSION);
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

function readOutbox() {
  return openOutboxDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(OUTBOX_STORE, 'readonly').objectStore(OUTBOX_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      })
  );
}

function deleteFromOutbox(clientId) {
  return openOutboxDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(OUTBOX_STORE, 'readwrite');
        transaction.objectStore(OUTBOX_STORE).delete(clientId);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

async function broadcastToClients(message) {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientList.forEach((client) => client.postMessage(message));
}

/**
 * Post every queued message to the REST endpoint. clientId makes the write
 * idempotent, so a retry after a partial failure can never duplicate a message.
 * Throws when anything is left unsent so Background Sync retries later.
 */
async function flushOutbox() {
  const queued = await readOutbox();
  if (queued.length === 0) return { sent: 0, remaining: 0 };

  let sent = 0;
  let remaining = 0;

  for (const entry of queued.sort((a, b) => a.createdAt - b.createdAt)) {
    try {
      const response = await fetch(`${entry.apiBaseUrl}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          clientId: entry.clientId,
          conversationId: entry.conversationId,
          text: entry.text,
          attachment: entry.attachment,
          replyTo: entry.replyTo,
        }),
      });

      if (response.ok) {
        await deleteFromOutbox(entry.clientId);
        sent += 1;
        continue;
      }

      // 4xx other than auth means the server will never accept it — stop retrying.
      if (response.status >= 400 && response.status < 500 && response.status !== 401) {
        await deleteFromOutbox(entry.clientId);
        continue;
      }

      remaining += 1;
    } catch {
      remaining += 1;
    }
  }

  await broadcastToClients({ type: 'PINGME_OUTBOX_FLUSHED', sent, remaining });

  if (remaining > 0) {
    throw new Error(`${remaining} queued message(s) still pending`);
  }

  return { sent, remaining };
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                          */
/* ------------------------------------------------------------------ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Cache entries individually so one 404 cannot abort the whole install.
      Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' }))))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => {});
      }
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (type === 'PINGME_SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (type === 'PINGME_FLUSH_OUTBOX') {
    event.waitUntil(flushOutbox().catch(() => {}));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === OUTBOX_SYNC_TAG) {
    event.waitUntil(flushOutbox());
  }
});

/* ------------------------------------------------------------------ */
/* Fetch strategies                                                   */
/* ------------------------------------------------------------------ */

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(?:css|js|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i.test(url.pathname)
  );
}

async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;

    const networkResponse = await fetch(event.request);
    if (networkResponse.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('/', networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (
      (await cache.match(event.request, { ignoreSearch: true })) ||
      (await cache.match('/')) ||
      (await cache.match(OFFLINE_URL)) ||
      new Response('You are offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  }
}

async function handleStaticAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    // Stale-while-revalidate: serve the cache now, refresh in the background.
    networkFetch.catch(() => {});
    return cached;
  }

  const network = await networkFetch;
  return network || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch the API, sockets, uploads or any other origin.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  }
});

/* ------------------------------------------------------------------ */
/* Web push                                                           */
/* ------------------------------------------------------------------ */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Wave', body: event.data.text() };
  }

  const conversationId = payload.data?.conversationId;

  event.waitUntil(
    (async () => {
      // A focused window already shows the message in real time.
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (clientList.some((client) => client.visibilityState === 'visible' && client.focused)) {
        clientList.forEach((client) =>
          client.postMessage({ type: 'PINGME_PUSH_RECEIVED', payload })
        );
        return;
      }

      await self.registration.showNotification(payload.title || 'Wave', {
        body: payload.body || 'You have a new message',
        icon: payload.icon || '/wave-192.png',
        badge: payload.badge || '/wave-192.png',
        tag: payload.tag || 'pingme-message',
        renotify: true,
        vibrate: [80, 40, 80],
        data: {
          url: payload.data?.url || '/',
          conversationId,
        },
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  const conversationId = event.notification.data?.conversationId;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = clientList.find((client) => client.url.startsWith(self.location.origin));

      if (existing) {
        await existing.focus();
        existing.postMessage({ type: 'PINGME_OPEN_CONVERSATION', conversationId });
        return;
      }

      await self.clients.openWindow(
        conversationId ? `${targetUrl}?conversation=${conversationId}` : targetUrl
      );
    })()
  );
});
