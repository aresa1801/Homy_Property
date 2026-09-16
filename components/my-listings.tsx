'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ExternalLink, Image as ImageIcon, Pencil, RefreshCw } from 'lucide-react'
import { firstMediaUrl } from '@/lib/property-format'

type Listing = {
  id: string
  title?: string
  city?: string
  province?: string
  status?: string
  listing_type?: string
  property_type?: string
  price?: number | string
  created_at?: string
  moderation_note?: string | null
  property_media?: { storage_path: string; media_type?: string | null; sort_order?: number | null }[] | null
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Menunggu moderasi', className: 'bg-[#fff7e3] text-[#9b762a]' },
  published: { label: 'Tayang', className: 'bg-[#edf2ed] text-[#4e866d]' },
  rejected: { label: 'Ditolak', className: 'bg-[#fbeeec] text-[#b45c50]' },
  draft: { label: 'Draf', className: 'bg-[#f2f0ea] text-[#718078]' },
  archived: { label: 'Diarsipkan', className: 'bg-[#f2f0ea] text-[#718078]' },
}

function rupiah(value: number | string | undefined) {
  const amount = typeof value === 'string' ? Number(value) : value
  if (!amount || Number.isNaN(amount)) return 'Harga belum diisi'
  return `Rp ${amount.toLocaleString('id-ID')}`
}

function formatDate(value?: string) {
  if (!value) return 'baru-baru ini'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Daftar listing milik agen/pemilik + tombol "Ajukan ulang" untuk listing yang ditolak. */
export function MyListings({ items }: { items: Listing[] }) {
  const [rows, setRows] = useState<Listing[]>(items ?? [])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => { setRows(items ?? []) }, [items])

  async function resubmit(id: string) {
    setBusy(id)
    setMessage(null)
    try {
      const response = await fetch(`/api/listings/${id}/resubmit`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage({ tone: 'err', text: payload?.error ?? 'Gagal mengajukan ulang listing.' })
        return
      }
      setRows((current) => current.map((row) => (row.id === id ? { ...row, status: 'pending', moderation_note: null } : row)))
      setMessage({ tone: 'ok', text: 'Listing diajukan ulang dan masuk antrean moderasi. 😊' })
    } catch {
      setMessage({ tone: 'err', text: 'Tidak bisa menghubungi server. Coba lagi.' })
    } finally {
      setBusy(null)
    }
  }

  if (!rows.length) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-[#f7f3ec] p-4 text-sm text-[#718078]">Belum ada listing. Mulai pasang properti pertama Anda.</p>
        <a href="/list" className="inline-flex rounded-lg bg-[#0b3d2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14553f]">Buat listing</a>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {message && (
        <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>
      )}
      {/* Satu kartu per baris (1 kolom) + foto properti agar mudah dibaca di HP. */}
      <div className="grid gap-3">
      {rows.map((item) => {
        const state = STATUS_STYLE[String(item.status ?? 'draft')] ?? STATUS_STYLE.draft
        const rejected = item.status === 'rejected'
        const image = firstMediaUrl(item, process.env.NEXT_PUBLIC_SUPABASE_URL)
        return (
          <div key={item.id} className="rounded-xl border border-[#eee7dc] bg-white p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-[#f2f0ea] sm:aspect-[4/3] sm:w-52">
                {image ? (
                  <img src={image} alt={item.title ?? 'Foto properti'} className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-[#a18a61]"><ImageIcon className="size-6" /><span className="mt-1 text-xs font-semibold">Belum ada foto</span></div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold leading-snug text-[#20332c] sm:text-base">{item.title ?? 'Listing properti'}</p>
                  <span className={`h-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:px-3 sm:py-1 ${state.className}`}>{state.label}</span>
                </div>
                <p className="mt-1 text-xs text-[#718078] sm:text-sm">
                  {[item.city, item.province].filter(Boolean).join(', ') || 'Lokasi belum diisi'} · {String(item.listing_type ?? 'properti')} · {rupiah(item.price)}
                </p>
                <p className="mt-1 text-xs text-[#718078]">Dikirim {formatDate(item.created_at)}</p>

            {rejected && item.moderation_note && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff7e3] p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#9b762a]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#9b762a]">Catatan moderator</p>
                  <p className="mt-1 text-sm leading-6 text-[#5b4a1f]">{item.moderation_note}</p>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-auto sm:pt-3">
              {rejected && (
                <button
                  type="button"
                  onClick={() => resubmit(item.id)}
                  disabled={busy === item.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14553f] disabled:opacity-60"
                >
                  <RefreshCw className={`size-3.5 ${busy === item.id ? 'animate-spin' : ''}`} />
                  {busy === item.id ? 'Mengajukan…' : 'Ajukan ulang'}
                </button>
              )}
              {item.status === 'published' && (
                <a href={`/property/${item.id}`} className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccbb] px-3 py-1.5 text-xs font-semibold text-[#33433d]">
                  <ExternalLink className="size-3.5" />
                  Lihat listing
                </a>
              )}
              {item.status !== 'rejected' && (
                <a href={`/listing/${item.id}/edit`} className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14553f]">
                  <Pencil className="size-3.5" /> Edit listing (foto & titik peta)
                </a>
              )}
            </div>
              </div>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
