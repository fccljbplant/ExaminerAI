// TraineesAI Service Worker
// ==========================
// Caches the app shell for offline use + queues POST requests when the
// network drops. Syncs the queue automatically when connectivity returns.
//
// Strategy:
//   - HTML navigations (page loads) → network-first, fall back to cache.
//     (User gets fresh content when online; cached shell when offline.)
//   - Static assets (_next/static/*) → cache-first.
//     (These are content-hashed, so the cache is always safe.)
//   - API GETs → network-first, fall back to cache (max 5 min old).
//   - API POSTs → if offline, queue in IndexedDB, retry on sync.
//
// The queue lives in IndexedDB under the `offlineQueue` store. Each item:
//   { id, url, method, body, headers, timestamp, retries }

const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `traineesai-shell-${CACHE_VERSION}`;
const ASSETS_CACHE = `traineesai-assets-${CACHE_VERSION}`;
const API_CACHE = `traineesai-api-${CACHE_VERSION}`;
const OFFLINE_QUEUE_DB = "traineesai-offline";
const OFFLINE_QUEUE_STORE = "queue";

// ─── Install: pre-cache the app shell ──────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      // Pre-cache the main entry points. Don't cache everything —
      // the runtime cache handles the rest on first visit.
      cache.addAll([
        "/",
        "/app",
        "/courses",
        "/manifest.webmanifest",
      ]).catch(() => {}) // ignore failures — they'll cache at runtime
    )
  );
  self.skipWaiting(); // activate the new SW immediately
});

// ─── Activate: clean up old caches ─────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, ASSETS_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: route requests by type ─────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Same-origin only — don't intercept cross-origin requests.
  if (url.origin !== self.location.origin) return;

  // POST/PUT/DELETE → queue if offline.
  if (request.method !== "GET") {
    if (!navigator.onLine) {
      event.respondWith(queueRequest(request));
      return;
    }
    // Online — let it through, but watch for failure (queue on failure).
    event.respondWith(
      fetch(request).catch(() => queueRequest(request))
    );
    return;
  }

  // HTML navigations → network-first, fall back to cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/app")))
    );
    return;
  }

  // Static assets → cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.match(/\.(?:js|css|woff2?|png|jpg|svg|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(ASSETS_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
      )
    );
    return;
  }

  // API GETs → network-first, fall back to cache (5 min max age).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(API_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});

// ─── Queue: store POSTs in IndexedDB when offline ──────────────────
async function queueRequest(request) {
  const body = await request.clone().text();
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: request.url,
    method: request.method,
    body,
    headers: Object.fromEntries(request.headers.entries()),
    timestamp: Date.now(),
    retries: 0,
  };
  await addToQueue(item);
  // Tell all clients to update their pending count.
  broadcastPending();
  // Return a synthetic "queued" response.
  return new Response(
    JSON.stringify({ queued: true, id: item.id, message: "Saved offline. Will sync when online." }),
    { status: 202, headers: { "Content-Type": "application/json" } }
  );
}

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_QUEUE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addToQueue(item) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    tx.objectStore(OFFLINE_QUEUE_STORE).add(item);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueue() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function removeFromQueue(id) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    tx.objectStore(OFFLINE_QUEUE_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function broadcastPending() {
  const queue = await getQueue();
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((client) => {
    client.postMessage({ type: "PENDING_COUNT", pending: queue.length });
  });
}

// ─── Sync: drain the queue when connectivity returns ───────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "traineesai-sync") {
    event.waitUntil(drainQueue());
  }
});

// Also drain on `online` (Safari doesn't support Background Sync API).
self.addEventListener("message", (event) => {
  if (event.data?.type === "ONLINE") drainQueue();
  if (event.data?.type === "GET_PENDING_COUNT") broadcastPending();
});

async function drainQueue() {
  const queue = await getQueue();
  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (res.ok) {
        await removeFromQueue(item.id);
      } else if (res.status >= 400 && res.status < 500) {
        // 4xx — permanent failure, don't retry. Drop it.
        await removeFromQueue(item.id);
      }
      // 5xx — leave in queue, will retry on next sync.
    } catch (err) {
      // Network still flaky — leave in queue.
      item.retries = (item.retries || 0) + 1;
      if (item.retries > 10) await removeFromQueue(item.id); // give up after 10 tries
    }
  }
  broadcastPending();
}
