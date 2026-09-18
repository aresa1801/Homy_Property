'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Heart, Loader2 } from 'lucide-react'
import { queueAction } from '@/lib/pwa-sync'

const KEY = '/api/favorites'
const fetcher = (url: string) => fetch(url).then((response) => response.json())

type Props = {
  propertyId: string
  /** Kunci cache SWR dipakai bersama untuk menampilkan judul properti di konfirmasi. */
  propertyTitle?: string
  size?: 'sm' | 'md'
  className?: string
  /** 'card' = bulatan putih di atas foto, 'plain' = tombol teks. */
  variant?: 'card' | 'plain'
  /** Dipanggil setelah status favorit berubah (mis. untuk menyegarkan dashboard). */
  onChange?: (favorite: boolean) => void
}

/**
 * Tombol hati pada kartu listing: menyimpan properti ke favorit pengguna.
 * Daftar favorit dibaca dari `/api/favorites` (data asli di tabel `favorites`),
 * jadi apa yang ditandai hati akan muncul di Dasbor Pengguna → Favorit.
 */
export function FavoriteButton({ propertyId, propertyTitle, size = 'md', className = '', variant = 'card', onChange }: Props) {
  const { data, mutate } = useSWR(KEY, fetcher, { revalidateOnFocus: false })
  const saved = Boolean(data?.ids?.includes(propertyId))
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function toggle(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (busy) return
    setBusy(true)
    setNote(null)
    const next = !saved
    // Optimistis: hati langsung berubah, baru dikonfirmasi server.
    void mutate({ ...(data ?? {}), ids: next ? [...(data?.ids ?? []), propertyId] : (data?.ids ?? []).filter((id: string) => id !== propertyId) }, false)
    try {
      const response = await fetch(KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, action: next ? 'add' : 'remove' }),
      })
      if (response.status === 401) {
        window.location.assign('/auth/login?next=' + encodeURIComponent(window.location.pathname + window.location.search))
        return
      }
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'Gagal menyimpan favorit.')
      setNote(next ? 'Disimpan ke favorit Anda.' : 'Dihapus dari favorit.')
      onChange?.(Boolean(payload?.favorite ?? next))
    } catch (error) {
      // Tidak ada koneksi? Simpan di antrean Background Sync supaya tetap tersimpan
      // otomatis begitu jaringan kembali (service worker yang mengirim ulang).
      if (error instanceof TypeError) {
        await queueAction({ url: KEY, method: 'POST', body: JSON.stringify({ propertyId, action: next ? 'add' : 'remove' }), label: 'favorit' }).catch(() => undefined)
        setNote('Tidak ada koneksi — favorit akan tersimpan otomatis saat online.')
      } else {
        setNote(error instanceof Error ? error.message : 'Gagal menyimpan favorit.')
      }
    } finally {
      setBusy(false)
      void mutate()
      window.setTimeout(() => setNote(null), 2600)
    }
  }

  const heart = saved ? 'fill-[#a3282c] text-[#a3282c]' : 'text-[#0b3d2e]'
  const label = saved ? 'Hapus dari favorit' : 'Simpan ke favorit'

  if (variant === 'plain') {
    return (
      <span className={'relative inline-flex flex-col items-end ' + className}>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={saved}
          aria-label={`${label}${propertyTitle ? ' — ' + propertyTitle : ''}`}
          className={'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition sm:text-sm ' + (saved ? 'border-[#a3282c] bg-[#fbeeec] text-[#a3282c]' : 'border-[#d8ccbb] bg-white text-[#0b3d2e] hover:border-[#c9a961]')}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Heart className={'size-4 ' + heart} />}
          {saved ? 'Favorit' : 'Simpan'}
        </button>
        {note && <span className="mt-1 max-w-[16rem] text-right text-[11px] leading-4 text-[#4e866d]">{note}</span>}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        aria-label={`${label}${propertyTitle ? ' — ' + propertyTitle : ''}`}
        title={label}
        className={(size === 'sm' ? 'size-8 ' : 'size-8 sm:size-9 ') + 'grid place-items-center rounded-full bg-white/90 shadow-sm transition hover:scale-105 ' + className}
      >
        {busy
          ? <Loader2 className={(size === 'sm' ? 'size-3.5' : 'size-4 sm:size-5') + ' animate-spin text-[#0b3d2e]'} />
          : <Heart className={(size === 'sm' ? 'size-4 ' : 'size-4 sm:size-5 ') + heart} />}
      </button>
      {note && <span className="sr-only" role="status">{note}</span>}
    </>
  )
}
