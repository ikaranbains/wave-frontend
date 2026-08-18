/* Wave service worker — app shell caching, offline outbox flush, FCM push. */

const SW_VERSION = 'v10';
const SHELL_CACHE = `pingme-shell-${SW_VERSION}`;
const ASSET_CACHE = `pingme-assets-${SW_VERSION}`;
const OFFLINE_URL = '/offline';
const OUTBOX_SYNC_TAG = 'pingme-outbox';
const OUTBOX_BATCH_SIZE = 10;

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

  const sorted = queued.sort((a, b) => a.createdAt - b.createdAt);
  const batches = [];
  for (let index = 0; index < sorted.length; index += OUTBOX_BATCH_SIZE) {
    batches.push(sorted.slice(index, index + OUTBOX_BATCH_SIZE));
  }

  const requests = await Promise.allSettled(
    batches.map(async (batch) => {
      const response = await fetch(`${batch[0].apiBaseUrl}/messages/batch`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          messages: batch.map((entry) => ({
            clientId: entry.clientId,
            conversationId: entry.conversationId,
            text: entry.text,
            attachment: entry.attachment,
            replyTo: entry.replyTo,
          })),
        }),
      });

      if (!response.ok) throw new Error(`Batch request failed with ${response.status}`);
      return { batch, results: (await response.json()).results || [] };
    })
  );

  const outcomes = requests.flatMap((request, index) => {
    const batch = batches[index];
    if (request.status === 'rejected') return batch.map(() => ({ remaining: 1 }));

    const resultsByClientId = new Map(
      request.value.results.map((result) => [result.clientId, result])
    );
    return batch.map((entry) => {
      const result = resultsByClientId.get(entry.clientId);
      if (result?.ok) return { clientId: entry.clientId, sent: 1 };
      if (result?.status >= 400 && result.status < 500 && result.status !== 401) {
        return { clientId: entry.clientId };
      }
      return { remaining: 1 };
    });
  });

  const removals = await Promise.allSettled(
    outcomes.map(async (outcome) => {
      if (!outcome.clientId) return outcome;
      await deleteFromOutbox(outcome.clientId);
      return outcome;
    })
  );
  const sent = removals.reduce(
    (count, result) => count + (result.status === 'fulfilled' ? result.value.sent || 0 : 0),
    0
  );
  const remaining = removals.reduce(
    (count, result) =>
      count + (result.status === 'rejected' ? 1 : result.value.remaining || 0),
    0
  );

  await broadcastToClients({ type: 'PINGME_OUTBOX_FLUSHED', sent, remaining });

  if (remaining > 0) {
    throw new Error(`${remaining} queued message(s) still pending`);
  }

  return { sent, remaining };
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                          */
/* ------------------------------------------------------------------ */

function findShellFontUrls(html) {
  return [
    ...html.matchAll(/href=["'](\/_next\/static\/media\/[^"']+\.(?:woff2?|ttf|otf))["']/gi),
  ].map((match) => match[1]);
}

async function precacheAppShell() {
  const shellCache = await caches.open(SHELL_CACHE);

  // Cache entries individually so one 404 cannot abort the whole install.
  await Promise.allSettled(
    SHELL_ASSETS.map((asset) => shellCache.add(new Request(asset, { cache: 'reload' })))
  );

  // next/font filenames are content-hashed per build. Discover their preload
  // URLs from the shell instead of hardcoding them, then keep them cache-first.
  const shell = await shellCache.match('/');
  if (!shell) return;

  const fontUrls = [...new Set(findShellFontUrls(await shell.text()))];
  if (fontUrls.length === 0) return;

  const assetCache = await caches.open(ASSET_CACHE);
  await Promise.allSettled(
    fontUrls.map((url) => assetCache.add(new Request(url, { cache: 'reload' })))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Cache-first navigation does not consume preload responses. Disable any
      // preload setting left by an older worker so launches do not waste a request.
      await self.registration.navigationPreload?.disable().catch(() => {});
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

function isImmutableAsset(url) {
  // Next.js content-hashes everything here, including generated font files.
  return url.pathname.startsWith('/_next/static/');
}

async function handleNavigation(event) {
  const cache = await caches.open(SHELL_CACHE);
  const cachedShell = await cache.match('/');
  if (cachedShell) return cachedShell;

  try {
    const networkResponse = await fetch(event.request);
    if (networkResponse.ok) {
      cache.put('/', networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    return (
      (await cache.match(OFFLINE_URL)) ||
      new Response('You are offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  }
}

async function handleStaticAsset(request, immutable) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached && immutable) return cached;

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
    event.respondWith(handleStaticAsset(request, isImmutableAsset(url)));
  }
});

/* ------------------------------------------------------------------ */
/* Web push                                                           */
/* ------------------------------------------------------------------ */

/**
 * FCM wraps the payload as `{ notification, data, fcmOptions }` rather than the flat
 * `{ title, body, icon, ... }` shape web-push used. Read both so an old queued push
 * and a new FCM one both render.
 */
function normalizePushPayload(payload) {
  const notification = payload.notification || {};
  const data = payload.data || {};

  return {
    title: notification.title || payload.title || 'Wave',
    body: notification.body || payload.body || 'You have a new message',
    icon: notification.icon || payload.icon || '/wave-192.png',
    badge: notification.badge || payload.badge || '/wave-192.png',
    tag: notification.tag || payload.tag || 'pingme-message',
    // FCM serializes every data value to a string, so compare as one.
    requireInteraction:
      String(notification.requireInteraction ?? payload.requireInteraction) === 'true',
    url: data.url || payload.fcmOptions?.link || notification.click_action || '/',
    conversationId: data.conversationId,
    callId: data.callId,
    kind: data.kind || 'message',
  };
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Wave', body: event.data.text() };
  }

  const push = normalizePushPayload(payload);

  event.waitUntil(
    (async () => {
      // A focused window already shows the message in real time.
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (clientList.some((client) => client.visibilityState === 'visible' && client.focused)) {
        clientList.forEach((client) =>
          client.postMessage({ type: 'PINGME_PUSH_RECEIVED', payload: push })
        );
        return;
      }

      await self.registration.showNotification(push.title, {
        body: push.body,
        icon: push.icon,
        badge: push.badge,
        tag: push.tag,
        renotify: true,
        // A ringing call should stay up until it is answered or it times out.
        requireInteraction: push.requireInteraction,
        vibrate: push.kind === 'call' ? [200, 100, 200, 100, 200] : [80, 40, 80],
        data: {
          url: push.url,
          conversationId: push.conversationId,
          callId: push.callId,
          kind: push.kind,
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
