const CACHE_NAME = 'homy-shell-v5'
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
