'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Building2, ChevronDown, ExternalLink, Loader2, MapPin, MessageSquare, RefreshCw, Sparkles } from 'lucide-react'
import { AiChat } from '@/components/ai/ai-chat'
import { CuratePanel } from '@/components/ai/curate-panel'
import { rupiah, ui, type DashboardPayload } from '@/lib/dashboard-client'

type BoardProps = { data: DashboardPayload; loading: boolean; reload: () => void; type: string }

type Suggestion = {
  recommended: number | null
  range_low: number | null
  range_high: number | null
  price_per_m2: number | null
  confidence: string
  rationale: string
  factors: string[]
  tips: string[]
}

type Stats = {
  total: number
  avg: number | null
  median: number | null
  min: number | null
  max: number | null
  avgPerM2: number | null
  byDistrict: { district: string; count: number; avg: number; avgPerM2: number | null }[]
  scope: string
}

type Result = {
  stats: Stats
  scope: string
  sampleSize: number
  comparables: { id: string; title?: string | null; city?: string | null; district?: string | null; price?: number | string | null; land_area?: number | null; building_area?: number | null; bedrooms?: number | null }[]
  suggestion: Suggestion
  disclaimer?: string
}

const CONFIDENCE: Record<string, string> = {
  rendah: 'bg-[#fbeeec] text-[#b45c50]',
  sedang: 'bg-[#fff7e3] text-[#9b762a]',
  tinggi: 'bg-[#edf2ed] text-[#4e866d]',
}

/** Papan AI untuk Agen & Pemilik: saran harga berbasis data pasar + tanya-jawab. */
export function AiBoard({ data }: BoardProps) {
  const properties = data.properties ?? []
  const [form, setForm] = useState({
    listing_type: 'sale',
    property_type: 'house',
    city: '',
    district: '',
    land_area: '',
    building_area: '',
    bedrooms: '',
    bathrooms: '',
    furnished: '',
    property_condition: '',
    certificate: '',
    extra_notes: '',
  })
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  function prefill() {
    const first = properties.find((item) => item.city || item.district)
    if (!first) return
    setForm((prev) => ({
      ...prev,
      listing_type: first.listing_type === 'rent' ? 'rent' : prev.listing_type,
      property_type: first.property_type ?? prev.property_type,
      city: first.city ?? prev.city,
      district: first.district ?? prev.district,
    }))
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/ai/price-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_type: form.listing_type,
          property_type: form.property_type,
          city: form.city || null,
          district: form.district || null,
          land_area: Number(form.land_area) || null,
          building_area: Number(form.building_area) || null,
          bedrooms: Number(form.bedrooms) || null,
          bathrooms: Number(form.bathrooms) || null,
          furnished: form.furnished || null,
          property_condition: form.property_condition || null,
          certificate: form.certificate || null,
          extra_notes: form.extra_notes || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'AI gagal menghitung saran harga.')
      setResult(payload as Result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghubungi AI')
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={ui.card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#0b3d2e]">Saran harga AI dari data pasar</p>
            <p className="text-xs text-[#718078]">Hitung harga jual/sewa wajar berdasarkan listing terbit di kecamatan/kota yang sama.</p>
          </div>
          {properties.length > 0 && (
            <button type="button" onClick={prefill} className={ui.ghost}>Isi dari listing saya</button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1"><span className={ui.eyebrow}>Tujuan</span>
            <select value={form.listing_type} onChange={(event) => set('listing_type', event.target.value)} className={ui.input}>
              <option value="sale">Dijual</option>
              <option value="rent">Disewakan</option>
            </select>
          </label>
          <label className="space-y-1"><span className={ui.eyebrow}>Tipe properti</span>
            <select value={form.property_type} onChange={(event) => set('property_type', event.target.value)} className={ui.input}>
              <option value="house">Rumah</option>
              <option value="apartment">Apartemen</option>
              <option value="villa">Villa</option>
              <option value="land">Tanah</option>
              <option value="boardingHouse">Kos</option>
              <option value="shophouse">Ruko</option>
              <option value="office">Kantor</option>
            </select>
          </label>
          <label className="space-y-1"><span className={ui.eyebrow}>Kota / Kabupaten</span>
            <input value={form.city} onChange={(event) => set('city', event.target.value)} placeholder="Sleman" className={ui.input} />
          </label>
          <label className="space-y-1"><span className={ui.eyebrow}>Kecamatan / Kelurahan</span>
            <input value={form.district} onChange={(event) => set('district', event.target.value)} placeholder="Depok" className={ui.input} />
          </label>
          <label className="space-y-1"><span className={ui.eyebrow}>Luas tanah (m²)</span>
            <input value={form.land_area} onChange={(event) => set('land_area', event.target.value.replace(/[^0-9]/g, ''))} placeholder="120" className={ui.input} inputMode="numeric" />
          </label>
          <label className="space-y-1"><span className={ui.eyebrow}>Luas bangunan (m²)</span>
            <input value={form.building_area} onChange={(event) => set('building_area', event.target.value.replace(/[^0-9]/g, ''))} placeholder="90" className={ui.input} inputMode="numeric" />
          </label>
          <label className="space-y-1"><span className={ui.eyebrow}>Kamar tidur</span>
            <input value={form.bedrooms} onChange={(event) => set('bedrooms', event.target.value.replace(/[^0-9]/g, ''))} placeholder="3" className={ui.input} inputMode="numeric" />
          </label>
          <label className="space-y-1"><span className={ui.eyebrow}>Kamar mandi</span>
            <input value={form.bathrooms} onChange={(event) => set('bathrooms', event.target.value.replace(/[^0-9]/g, ''))} placeholder="2" className={ui.input} inputMode="numeric" />
          </label>
          <label className="space-y-1"><span className={ui.eyebrow}>Kondisi</span>
            <select value={form.property_condition} onChange={(event) => set('property_condition', event.target.value)} className={ui.input}>
              <option value="">—</option>
              <option value="new">Baru</option>
              <option value="good">Baik</option>
              <option value="renovated">Baru direnovasi</option>
              <option value="needsRenovation">Perlu renovasi</option>
            </select>
          </label>
          <label className="space-y-1"><span className={ui.eyebrow}>Sertifikat</span>
            <input value={form.certificate} onChange={(event) => set('certificate', event.target.value)} placeholder="SHM" className={ui.input} />
          </label>
          <label className="space-y-1"><span className={ui.eyebrow}>Perabot</span>
            <select value={form.furnished} onChange={(event) => set('furnished', event.target.value)} className={ui.input}>
              <option value="">—</option>
              <option value="unfurnished">Tanpa perabot</option>
              <option value="semi">Semi perabot</option>
              <option value="furnished">Full perabot</option>
            </select>
          </label>
        </div>

        <label className="mt-3 block space-y-1"><span className={ui.eyebrow}>Catatan tambahan</span>
          <textarea value={form.extra_notes} onChange={(event) => set('extra_notes', event.target.value)} rows={2} placeholder="Dekat kampus, ada carport 2 mobil, listrik 2200 VA…" className={ui.input} />
        </label>

        <button type="button" onClick={submit} disabled={busy} className={`${ui.btn} mt-4 px-4 py-2 text-sm`}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? 'Menghitung dari data pasar…' : 'Hitung saran harga AI'}
        </button>
        {error && <p className="mt-3 rounded-lg bg-[#fbeeec] px-3 py-2 text-xs text-[#b45c50]">{error}</p>}
      </div>

      {result && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={ui.card}>
              <p className={ui.eyebrow}>Harga rekomendasi</p>
              <p className="mt-1 text-xl sm:text-2xl font-semibold text-[#0b3d2e]">{rupiah(result.suggestion.recommended)}</p>
              <span className={`${ui.badge} mt-2 inline-block ${CONFIDENCE[result.suggestion.confidence] ?? CONFIDENCE.sedang}`}>Keyakinan {result.suggestion.confidence}</span>
            </div>
            <div className={ui.card}>
              <p className={ui.eyebrow}>Rentang wajar</p>
              <p className="mt-1 text-sm font-semibold text-[#20332c]">{rupiah(result.suggestion.range_low)} — {rupiah(result.suggestion.range_high)}</p>
              <p className="mt-2 text-xs text-[#718078]">Per m²: {rupiah(result.suggestion.price_per_m2)}</p>
            </div>
            <div className={ui.card}>
              <p className={ui.eyebrow}>Data pembanding</p>
              <p className="mt-1 text-xl sm:text-2xl font-semibold text-[#0b3d2e]">{result.sampleSize}</p>
              <p className="mt-2 text-xs text-[#718078]">{result.scope}</p>
            </div>
            <div className={ui.card}>
              <p className={ui.eyebrow}>Harga pasar</p>
              <p className="mt-1 text-sm text-[#20332c]">Median {rupiah(result.stats.median)}</p>
              <p className="mt-1 text-xs text-[#718078]">Rata-rata {rupiah(result.stats.avg)} · {rupiah(result.stats.avgPerM2)}/m²</p>
            </div>
          </div>

          {result.suggestion.rationale && (
            <div className={ui.card}>
              <p className={ui.eyebrow}>Analisis AI</p>
              <p className="mt-2 text-sm text-[#33433d]">{result.suggestion.rationale}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {!!result.suggestion.factors?.length && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Faktor harga</p>
                    <ul className="mt-2 space-y-1 text-sm text-[#33433d]">{result.suggestion.factors.map((factor) => <li key={factor}>• {factor}</li>)}</ul>
                  </div>
                )}
                {!!result.suggestion.tips?.length && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Saran agar cepat terjual</p>
                    <ul className="mt-2 space-y-1 text-sm text-[#33433d]">{result.suggestion.tips.map((tip) => <li key={tip}>• {tip}</li>)}</ul>
                  </div>
                )}
              </div>
              {result.disclaimer && <p className="mt-3 text-xs text-[#8a9a92]">{result.disclaimer}</p>}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={ui.card}>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><BarChart3 className="size-4" /> Harga rata-rata per daerah</p>
              {result.stats.byDistrict.length ? (
                <div className="mt-3 space-y-2">
                  {result.stats.byDistrict.map((item) => (
                    <div key={item.district} className="flex items-center justify-between rounded-lg bg-[#f7f3ec] px-3 py-2 text-sm">
                      <span className="text-[#20332c]">{item.district} <span className="text-xs text-[#718078]">({item.count} listing)</span></span>
                      <span className="text-right text-[#0b3d2e]">{rupiah(item.avg)}{item.avgPerM2 ? <span className="block text-[11px] text-[#718078]">{rupiah(item.avgPerM2)}/m²</span> : null}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-[#718078]">Belum ada data harga di area ini.</p>}
            </div>

            <div className={ui.card}>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><Building2 className="size-4" /> Listing pembanding</p>
              {result.comparables.length ? (
                <div className="mt-3 space-y-2">
                  {result.comparables.map((item) => (
                    <a key={item.id} href={`/property/${item.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-[#f7f3ec] px-3 py-2 text-sm hover:bg-[#f1ebdf]">
                      <span className="min-w-0">
                        <span className="block truncate text-[#20332c]">{item.title ?? 'Properti'}</span>
                        <span className="flex items-center gap-1 text-xs text-[#718078]"><MapPin className="size-3" />{[item.district, item.city].filter(Boolean).join(', ') || '—'}{item.building_area ? ` · ${item.building_area} m²` : ''}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-[#0b3d2e]">{rupiah(item.price)}</span>
                    </a>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-[#718078]">Belum ada listing pembanding.</p>}
            </div>
          </div>
        </div>
      )}

      <div className={ui.card}>
        <AiChat
          compact
          intro="Tanya bebas: harga wajar, cara promosi listing, atau bandingkan dengan listing lain di Homy"
          placeholder="Contoh: berapa harga sewa wajar rumah 3 kamar di Depok Sleman?"
          suggestions={['Harga wajar rumah 3 kamar di Sleman?', 'Tips agar listing saya cepat terjual', 'Apakah harga listing saya sudah kompetitif?']}
        />
      </div>
    </div>
  )
}

/** Papan rekomendasi AI untuk pembeli/penyewa (dashboard Pengguna). */
export function CurateBoard(_props: BoardProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <CuratePanel />
      <div className={ui.card}>
        <AiChat
          compact
          intro="Homy AI membaca seluruh listing terbit untuk membantu Anda"
          placeholder="Contoh: bandingkan rumah 2 kamar di Bandung budget 900 juta"
          suggestions={['Bandingkan 3 properti termurah di Bandung', 'Sewa apartemen Jakarta per bulan berapa?', 'Properti mana yang terbaik untuk investasi?']}
        />
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------- */
/* Rekam percakapan pengguna <-> Homy AI tentang listing milik agen/pemilik      */
/* --------------------------------------------------------------------------- */

type ConversationRow = {
  id: string
  propertyId: string | null
  propertyTitle: string | null
  propertyCity: string | null
  propertyDistrict: string | null
  listingType: string | null
  userEmail: string | null
  isMine: boolean
  mode: string
  question: string
  answer: string
  createdAt: string
}

function shortDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function maskEmail(value?: string | null) {
  const text = String(value ?? '').trim()
  if (!text.includes('@')) return text || 'Tamu (belum masuk)'
  const [name, domain] = text.split('@')
  const visible = name.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`
}

/** Papan "Rekam Percakapan": riwayat tanya-jawab pembeli dengan Homy AI per listing. */
export function AiConversationsBoard({ data, loading }: BoardProps) {
  const properties = data.properties ?? []
  const [propertyId, setPropertyId] = useState('')
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const query = propertyId ? `?propertyId=${propertyId}&limit=80` : '?limit=80'
      const response = await fetch(`/api/ai/conversations${query}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload?.error ?? 'Gagal memuat rekaman percakapan.')
        setRows([])
        return
      }
      setRows((payload.conversations ?? []) as ConversationRow[])
    } catch {
      setError('Tidak bisa menghubungi server. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }, [propertyId])

  useEffect(() => { void load() }, [load])

  const grouped = new Map<string, ConversationRow[]>()
  rows.forEach((row) => {
    const key = row.propertyId ?? 'lainnya'
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  })

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className={ui.card}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><MessageSquare className="size-4" /> Rekam percakapan pembeli dengan Homy AI</p>
            <p className="mt-1 text-sm text-[#718078]">
              Semua tanya-jawab antara calon pembeli/penyewa dan Homy AI tentang listing Anda tercatat di sini. Pakai untuk tahu apa yang paling sering ditanyakan pembeli.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Listing
              <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className="h-10 min-w-52 rounded-lg border border-[#e8dfd3] px-3 text-sm">
                <option value="">Semua listing saya</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.title ?? 'Listing'}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8ccbb] px-3 text-sm font-semibold text-[#33433d] disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Muat ulang
            </button>
          </div>
        </div>
      </div>

      {error && <p className="rounded-xl bg-[#fbeeec] px-4 py-3 text-sm font-medium text-[#b45c50]">{error}</p>}

      {!busy && !rows.length && !error && (
        <div className={ui.card}>
          <p className="text-sm text-[#718078]">Belum ada percakapan tercatat. Rekaman muncul otomatis begitu pembeli bertanya ke Homy AI tentang listing Anda.</p>
        </div>
      )}

      {Array.from(grouped.entries()).map(([key, items]) => {
        const first = items[0]
        return (
          <div key={key} className={ui.card}>
            <p className="text-sm font-semibold text-[#0b3d2e]">{first.propertyTitle ?? 'Percakapan umum (tanpa listing)'}</p>
            <p className="mt-0.5 text-xs text-[#718078]">
              {[first.propertyDistrict, first.propertyCity].filter(Boolean).join(', ') || 'Tanpa lokasi'} · {items.length} percakapan
            </p>
            <div className="mt-3 space-y-2">
              {items.map((row) => {
                const open = openId === row.id
                return (
                  <div key={row.id} className="rounded-xl bg-[#f7f3ec] p-3">
                    <button type="button" onClick={() => setOpenId(open ? null : row.id)} className="flex w-full items-start justify-between gap-3 text-left">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[#20332c]">{row.question}</span>
                        <span className="mt-0.5 block text-xs text-[#718078]">{maskEmail(row.userEmail)} · {shortDateTime(row.createdAt)} · {row.mode === 'property' ? 'tentang listing ini' : row.mode === 'market' ? 'pasar umum' : 'pencarian'}</span>
                      </span>
                      <ChevronDown className={'mt-0.5 size-4 shrink-0 text-[#65706c] transition ' + (open ? 'rotate-180' : '')} />
                    </button>
                    {open && (
                      <div className="mt-3 space-y-2 border-t border-[#e8dfd3] pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#a18a61]">Jawaban Homy AI</p>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-[#33433d]">{row.answer}</p>
                        {row.propertyId && (
                          <a href={`/property/${row.propertyId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0b3d2e]">
                            <ExternalLink className="size-3" /> Lihat listing
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
