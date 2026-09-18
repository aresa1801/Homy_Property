'use client'

/**
 * Tombol "Aktifkan notifikasi HP" untuk pengguna yang sudah login.
 * Mendaftarkan service worker → minta izin → subscribe Web Push → simpan ke server.
 */
import { useCallback, useEffect, useState } from 'react'
import { BellOff, BellRing, Loader2 } from 'lucide-react'

function supported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** VAPID public key (base64url) → Uint8Array sesuai spesifikasi Push API. */
function toUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

type State = 'loading' | 'unsupported' | 'off' | 'on' | 'denied'

export function PushOptIn({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [publicKey, setPublicKey] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [testing, setTesting] = useState(false)

  const refresh = useCallback(async () => {
    if (!supported()) {
      setState('unsupported')
      return
    }
    try {
      const response = await fetch('/api/push', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (payload?.authenticated === false) {
        setState('unsupported')
        return
      }
      setPublicKey(String(payload?.publicKey ?? ''))
      if (Notification.permission === 'denied') {
        setState('denied')
        return
      }
      const registration = await navigator.serviceWorker.getRegistration()
      const existing = await registration?.pushManager.getSubscription()
      setState(existing ? 'on' : 'off')
    } catch {
      setState('off')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function enable() {
    if (busy) return
    setBusy(true)
    setNote('')
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        setNote('Izin notifikasi diblokir. Aktifkan lewat pengaturan browser.')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toUint8Array(publicKey),
        }))
      const response = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), userAgent: navigator.userAgent }),
      })
      if (!response.ok) {
        setNote('Gagal menyimpan langganan. Coba lagi.')
        return
      }
      setState('on')
      setNote('Notifikasi HP aktif di perangkat ini.')
    } catch {
      setNote('Tidak bisa mengaktifkan notifikasi di perangkat ini.')
    } finally {
      setBusy(false)
    }
  }

  async function testPush() {
    if (testing) return
    setTesting(true)
    setNote('')
    try {
      const response = await fetch('/api/push/test', { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (payload?.ok) setNote('Notifikasi tes terkirim ke ' + payload.sent + ' perangkat. Cek layar HP Anda.')
      else setNote(String(payload?.error ?? 'Tes gagal dikirim.'))
    } catch {
      setNote('Tes gagal dikirim.')
    } finally {
      setTesting(false)
    }
  }

  async function disable() {
    if (busy) return
    setBusy(true)
    setNote('')
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        })
        await subscription.unsubscribe().catch(() => undefined)
      }
      setState('off')
      setNote('Notifikasi HP dimatikan di perangkat ini.')
    } catch {
      setNote('Gagal mematikan notifikasi.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || state === 'unsupported') return null

  const on = state === 'on'
  const icon = busy ? <Loader2 className="size-4 animate-spin" /> : on ? <BellRing className="size-4" /> : <BellOff className="size-4" />

  return (
    <div className={compact ? 'px-4 py-3' : 'rounded-2xl border border-[#e5dccd] bg-white p-4'}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: on ? '#e2eee7' : '#f2f0ea', color: on ? '#0b3d2e' : '#8a8f8b' }}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#20332c]">{on ? 'Notifikasi HP aktif' : 'Notifikasi HP belum aktif'}</p>
          <p className="mt-0.5 text-xs leading-5 text-[#718078]">
            {on
              ? 'Pertanyaan pembeli, jadwal kunjungan, dan listing yang cocok akan langsung masuk ke HP Anda.'
              : 'Dapatkan pemberitahuan langsung ke HP saat ada pertanyaan pembeli atau jadwal kunjungan baru.'}
          </p>
          {note && <p className="mt-1 text-[11px] leading-4 text-[#8a6d21]">{note}</p>}
          {state === 'denied' && <p className="mt-1 text-[11px] leading-4 text-[#a34438]">Izin diblokir di browser. Buka setelan situs → Notifikasi → Izinkan.</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => (on ? void disable() : void enable())}
              className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ' + (on ? 'border border-[#e5dccd] bg-white text-[#a34438] hover:bg-[#fbeeec]' : 'bg-[#0b3d2e] text-white hover:bg-[#0f4a38]')}
            >
              {busy ? 'Memproses…' : on ? 'Matikan di perangkat ini' : 'Aktifkan notifikasi HP'}
            </button>
            {on && (
              <button
                type="button"
                disabled={testing}
                onClick={() => { void testPush() }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#d8ccbb] bg-[#fbfaf7] px-3 py-1.5 text-xs font-semibold text-[#0b3d2e] transition hover:border-[#c9a961] disabled:opacity-60"
              >
                {testing ? 'Mengirim…' : 'Kirim tes notifikasi'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
