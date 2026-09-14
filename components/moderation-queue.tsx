'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react'

type Listing = {
  id: string
  title: string | null
  city: string | null
  province: string | null
  district: string | null
  listing_type: string | null
  property_type: string | null
  status: string
  price: number | null
  price_period: string | null
  owner_id: string | null
  created_at: string | null
  moderation_note: string | null
  moderated_at: string | null
  ai_summary: string | null
  property_media?: { storage_path: string; media_type: string; sort_order: number }[] | null
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_ANON_URL || ''

function rupiah(value: number | null, period: string | null) {
  if (!value) return '—'
  const base = `Rp ${Number(value).toLocaleString('id-ID')}`
  return period === 'monthly' ? `${base}/bln` : base
}

function photoUrl(listing: Listing) {
  const media = (listing.property_media ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
  if (!media || !SUPABASE_URL) return null
  return `${SUPABASE_URL}/storage/v1/object/public/property-media/${media.storage_path}`
}

const TABS: { id: string; label: string }[] = [
  { id: 'pending', label: 'Menunggu moderasi' },
  { id: 'published', label: 'Sudah terbit' },
  { id: 'rejected', label: 'Ditolak' },
]

export function ModerationQueue() {
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState('pending')
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/listings', { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const payload = await response.json()
      setItems(Array.isArray(payload.data) ? payload.data : [])
    } catch {
      setError('Tidak bisa memuat antrean moderasi. Pastikan akun Anda punya role admin.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => ({
    pending: items.filter((i) => i.status === 'pending').length,
    published: items.filter((i) => i.status === 'published').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
  }), [items])

  const visible = items.filter((i) => i.status === tab)

  async function act(id: string, action: 'approve' | 'reject', reason = '') {
    setBusyId(id)
    setError(null)
    try {
      const response = await fetch('/api/admin/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note: reason }),
      })
      if (!response.ok) throw new Error(String(response.status))
      const payload = await response.json()
      const nextStatus = payload?.data?.status ?? (action === 'approve' ? 'published' : 'rejected')
      setItems((current) => current.map((item) => item.id === id ? { ...item, status: nextStatus, moderation_note: reason || null, moderated_at: new Date().toISOString() } : item))
      setToast(action === 'approve' ? 'Listing disetujui & tayang.' : 'Listing ditolak.')
      setNoteFor(null)
      setNote('')
    } catch {
      setError('Gagal memperbarui listing. Coba lagi.')
    } finally {
      setBusyId(null)
      setTimeout(() => setToast(null), 3500)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${tab === item.id ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white' : 'border-[#d8ccbb] bg-white text-[#33433d] hover:border-[#c9a961]'}`}>
              {item.label} · {counts[item.id as keyof typeof counts] ?? 0}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccbb] bg-white px-3 py-1.5 text-xs font-semibold text-[#33433d] hover:border-[#c9a961]">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Muat ulang
        </button>
      </div>

      {toast && <p role="status" className="rounded-xl bg-[#e2eee7] p-3 text-sm text-[#0b3d2e]">{toast}</p>}
      {error && <p role="alert" className="rounded-xl bg-[#fbe9e7] p-3 text-sm text-[#a3282c]">{error}</p>}

      {loading && <p className="flex items-center gap-2 rounded-xl bg-[#f7f3ec] p-4 text-sm text-[#718078]"><Loader2 className="size-4 animate-spin" /> Memuat listing...</p>}

      {!loading && visible.length === 0 && (
        <p className="rounded-xl bg-[#f7f3ec] p-4 text-sm text-[#718078]">
          {tab === 'pending' ? 'Tidak ada listing yang menunggu moderasi. 🎉' : 'Belum ada listing di kategori ini.'}
        </p>
      )}

      {!loading && visible.map((listing) => {
        const photo = photoUrl(listing)
        const busy = busyId === listing.id
        return (
          <div key={listing.id} className="rounded-2xl border border-[#eee7dc] bg-white p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-[#f7f3ec] sm:w-40">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={listing.title ?? 'Foto properti'} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-[#a18a61]">Tanpa foto</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#20332c]">{listing.title ?? 'Listing properti'}</p>
                    <p className="mt-1 text-sm text-[#718078]">
                      {[listing.district, listing.city, listing.province].filter(Boolean).join(', ') || 'Lokasi belum diisi'} · {listing.property_type ?? '—'} · {listing.listing_type === 'rent' ? 'Sewa' : listing.listing_type === 'both' ? 'Jual & Sewa' : 'Dijual'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#0b3d2e]">{rupiah(listing.price, listing.price_period)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${listing.status === 'published' ? 'bg-[#e2eee7] text-[#0b3d2e]' : listing.status === 'rejected' ? 'bg-[#fbeeec] text-[#a3282c]' : 'bg-[#fff7e3] text-[#9b762a]'}`}>{listing.status}</span>
                </div>

                {listing.ai_summary && <p className="mt-3 line-clamp-3 text-xs leading-6 text-[#718078]">{listing.ai_summary}</p>}
                {listing.moderation_note && <p className="mt-2 rounded-lg bg-[#f7f3ec] p-2 text-xs text-[#5b6a63]">Catatan moderator: {listing.moderation_note}</p>}
                <p className="mt-2 text-xs text-[#a18a61]">Dikirim {listing.created_at ? new Date(listing.created_at).toLocaleString('id-ID') : '—'}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {listing.status !== 'published' && (
                    <button type="button" disabled={busy} onClick={() => void act(listing.id, 'approve')} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b3d2e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14553f] disabled:opacity-60">
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Setujui &amp; tayangkan
                    </button>
                  )}
                  {listing.status !== 'rejected' && (
                    <button type="button" disabled={busy} onClick={() => { setNoteFor(noteFor === listing.id ? null : listing.id); setNote('') }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0b4ae] bg-white px-3 py-1.5 text-xs font-semibold text-[#a3282c] hover:bg-[#fbeeec] disabled:opacity-60">
                      <X className="size-3.5" /> Tolak
                    </button>
                  )}
                  {listing.status === 'published' && (
                    <a href={`/property/${listing.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ccbb] bg-white px-3 py-1.5 text-xs font-semibold text-[#33433d] hover:border-[#c9a961]">
                      <ExternalLink className="size-3.5" /> Lihat halaman
                    </a>
                  )}
                </div>

                {noteFor === listing.id && (
                  <div className="mt-3 rounded-xl bg-[#f7f3ec] p-3">
                    <p className="text-xs font-semibold text-[#33433d]">Alasan penolakan (dikirim ke pemilik)</p>
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-[#e8dfd3] p-3 text-sm outline-none focus:border-[#0b3d2e]" placeholder="Contoh: Foto kurang jelas, harga tidak wajar, data lokasi tidak lengkap." />
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={busy} onClick={() => void act(listing.id, 'reject', note)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#a3282c] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Kirim penolakan</button>
                      <button type="button" onClick={() => setNoteFor(null)} className="rounded-lg border border-[#d8ccbb] bg-white px-3 py-1.5 text-xs font-semibold text-[#33433d]">Batal</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <p className="flex items-center gap-2 rounded-xl bg-[#edf2ed] p-3 text-xs text-[#0b3d2e]">
        <ShieldCheck className="size-4" /> Moderasi berjalan di server dengan hak terbatas — hanya akun ber-role admin/super-admin yang bisa menyetujui listing.
      </p>
    </div>
  )
}
