const CACHE_NAME = 'homy-shell-v6'
const APP_SHELL = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
]

/** Private/authenticated areas must never be written to the shared offline cache. */
function isPrivate(url) {
  const path = url.pathname
  return path.startsWith('/api/') || path.startsWith('/dashboard') || path.startsWith('/message') || path.startsWith('/auth')
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return

  // Navigations: network first, then cached shell, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!isPrivate(url)) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/'))
            .then((fallback) => fallback || caches.match('/offline.html')),
        ),
    )
    return
  }

  // Never serve cached API/dashboard data.
  if (isPrivate(url)) return

  // Static assets: cache first, then network; fall back to the offline page.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
        .catch(() => caches.match('/offline.html'))
    }),
  )
})

/* ------------------------------------------------------------------ *
 * Web Push — notifikasi ke HP (pertanyaan pembeli, kunjungan, listing).
 * ------------------------------------------------------------------ */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Homy Property', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Homy Property'
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.kind || 'homy',
    renotify: true,
    data: { url: payload.href || '/', kind: payload.kind || 'system' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientList) {
        if (!('focus' in client)) continue
        await client.focus()
        try {
          if ('navigate' in client && new URL(client.url).origin === self.location.origin) await client.navigate(target)
        } catch {
          /* abaikan */
        }
        return
      }
      if (self.clients.openWindow) await self.clients.openWindow(target)
    })(),
  )
})

/* ------------------------------------------------------------------ *
 * Background Sync — kirim ulang aksi yang tertunda (mis. simpan favorit).
 * Antrean disimpan di IndexedDB `homy-sync` / store `actions` oleh lib/pwa-sync.ts
 * dan halaman memanggil registration.sync.register('homy-sync').
 * ------------------------------------------------------------------ */
const SYNC_DB = 'homy-sync'
const SYNC_STORE = 'actions'

function syncDb() {
  return new Promise((resolve) => {
    const request = indexedDB.open(SYNC_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SYNC_STORE)) db.createObjectStore(SYNC_STORE, { keyPath: 'id', autoIncrement: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

function readQueue(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(SYNC_STORE, 'readonly')
    const request = tx.objectStore(SYNC_STORE).getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => resolve([])
  })
}

function dropAction(db, id) {
  return new Promise((resolve) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite')
    tx.objectStore(SYNC_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

async function replayQueue() {
  const db = await syncDb()
  if (!db) return
  const actions = await readQueue(db)
  if (!actions.length) {
    db.close()
    return
  }
  let pending = 0
  for (const action of actions) {
    let ok = false
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers || { 'Content-Type': 'application/json' },
        body: action.body || undefined,
        credentials: 'include',
      })
      // 4xx = permintaan memang tidak valid, jangan diulang terus-menerus.
      ok = response.ok || response.status < 500
    } catch {
      ok = false
    }
    if (ok) await dropAction(db, action.id)
    else pending += 1
  }
  db.close()
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  clientList.forEach((client) => client.postMessage({ type: 'homy:sync-complete', sent: actions.length - pending, pending }))
  if (pending > 0) throw new Error('masih ada aksi tertunda')
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'homy-sync') event.waitUntil(replayQueue())
})

/* ------------------------------------------------------------------ *
 * Periodic Sync — segarkan data notifikasi di latar belakang.
 * Hanya dijalankan browser bila PWA terpasang + izin notifikasi diberikan.
 * ------------------------------------------------------------------ */
self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'homy-refresh') return
  event.waitUntil(
    (async () => {
      try {
        const response = await fetch('/api/notifications', { credentials: 'include', cache: 'no-store' })
        if (response.ok) {
          // Simpan cuplikan terakhir dengan kunci non-privat supaya bisa dibaca
          // halaman offline (/offline.html) tanpa menembus aturan cache privat.
          const payload = await response.clone().json().catch(() => null)
          if (payload) {
            const cache = await caches.open(CACHE_NAME)
            await cache.put(
              '/homy-notifications.json',
              new Response(JSON.stringify({ savedAt: Date.now(), items: (payload.items || payload.notifications || []).slice(0, 5) }), {
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }
        }
      } catch {
        /* offline — coba lagi di jadwal berikutnya */
      }
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      clientList.forEach((client) => client.postMessage({ type: 'homy:refresh' }))
    })(),
  )
})
