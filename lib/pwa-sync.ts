'use client'

/**
 * Homy — Sinkronisasi latar (Background Sync) & Sinkronisasi berkala (Periodic Sync).
 *
 * Aksi pengguna (mis. menyimpan favorit) yang gagal karena jaringan TIDAK dibuang:
 * disimpan dulu di IndexedDB, lalu service worker mengirim ulang otomatis saat
 * koneksi kembali (event `sync`) — bahkan kalau tab sudah ditutup.
 *
 * Periodic Sync dipakai untuk menyegarkan data notifikasi di latar belakang
 * (event `periodicsync`) supaya lonceng notifikasi dan halaman offline tetap segar.
 */

export const SYNC_TAG = 'homy-sync'
export const PERIODIC_TAG = 'homy-refresh'
export const PERIODIC_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 jam

const DB_NAME = 'homy-sync'
const STORE = 'actions'

export type QueuedAction = {
  url: string
  method: string
  body?: string | null
  headers?: Record<string, string>
  label?: string
  createdAt?: number
}

type SyncManager = { register: (tag: string) => Promise<void> }
type PeriodicSyncManager = { register: (tag: string, options: { minInterval: number }) => Promise<void> }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Simpan satu aksi untuk dikirim ulang saat online. */
export async function queueAction(action: QueuedAction): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ ...action, createdAt: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  await registerBackgroundSync()
}

/** Minta browser menjadwalkan pengiriman ulang (Background Sync API). */
export async function registerBackgroundSync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & { sync?: SyncManager }
    if (!registration.sync) return false
    await registration.sync.register(SYNC_TAG)
    return true
  } catch {
    return false
  }
}

/**
 * Daftarkan Periodic Sync (hanya boleh dipanggil setelah izin notifikasi diberikan
 * dan PWA terpasang — syarat dari Chrome). Gagal = tidak masalah, hanya fitur tambahan.
 */
export async function registerPeriodicSync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager }
    if (!registration.periodicSync) return false
    const status = await (navigator as Navigator & { permissions?: Permissions }).permissions?.query({ name: 'periodic-background-sync' as PermissionName })
    if (status && status.state !== 'granted') return false
    await registration.periodicSync.register(PERIODIC_TAG, { minInterval: PERIODIC_MIN_INTERVAL_MS })
    return true
  } catch {
    return false
  }
}

/** Kirim ulang aksi yang tertunda dari sisi halaman (cadangan kalau Background Sync tidak didukung). */
export async function flushQueue(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0
  const db = await openDb()
  const actions = await new Promise<(QueuedAction & { id: number })[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).getAll()
    request.onsuccess = () => resolve(request.result as (QueuedAction & { id: number })[])
    request.onerror = () => reject(request.error)
  })
  let sent = 0
  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers ?? { 'Content-Type': 'application/json' },
        body: action.body ?? undefined,
        credentials: 'include',
      })
      if (!response.ok && response.status >= 500) continue
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(action.id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      })
      sent += 1
    } catch {
      /* masih offline — biarkan di antrean */
    }
  }
  db.close()
  return sent
}
