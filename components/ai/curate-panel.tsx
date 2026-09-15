'use client'

import { useState } from 'react'
import { BadgeCheck, Loader2, MapPin, Sparkles, TriangleAlert } from 'lucide-react'

type Recommendation = {
  id: string
  title?: string | null
  city?: string | null
  district?: string | null
  property_type?: string | null
  listing_type?: string | null
  price?: number | string | null
  bedrooms?: number | null
  land_area?: number | null
  building_area?: number | null
  match_score: number
  why: string
  watch_out: string
}

type Result = { summary: string; advice: string; recommendations: Recommendation[]; relaxed?: string[]; disclaimer?: string }

const rupiah = (value?: number | string | null) => {
  const amount = typeof value === 'string' ? Number(value) : value
  if (!amount || Number.isNaN(amount)) return '—'
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}

export function CuratePanel({ compact = false }: { compact?: boolean }) {
  const [form, setForm] = useState({ listing_type: 'sale', budget: '', city: '', district: '', property_type: '', bedrooms: '', needs: '' })
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/ai/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_type: form.listing_type,
          budget: Number(form.budget) || null,
          city: form.city || null,
          district: form.district || null,
          property_type: form.property_type || null,
          bedrooms: Number(form.bedrooms) || null,
          needs: form.needs || null,
          limit: 4,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'AI gagal menyusun rekomendasi.')
      setResult(payload as Result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghubungi AI')
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-lg border border-[#d8ccbb] bg-white px-3 py-2 text-sm text-[#20332c] outline-none focus:border-[#0b3d2e]'
  const label = 'text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]'

  return (
    <div className={compact ? '' : 'space-y-5'}>
      <div className="rounded-2xl border border-[#e5dccd] bg-white p-4 sm:p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-[#0b3d2e] text-[#c9a961]"><Sparkles className="size-4" /></span>
          <div>
            <p className="text-sm font-semibold text-[#0b3d2e]">Rekomendasi AI untuk pembeli</p>
            <p className="text-xs text-[#718078]">Isi kriteria, AI memilih listing paling cocok dari database Homy + memberi alasan.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1"><span className={label}>Tujuan</span>
            <select value={form.listing_type} onChange={(event) => set('listing_type', event.target.value)} className={input}>
              <option value="sale">Beli</option>
              <option value="rent">Sewa</option>
            </select>
          </label>
          <label className="space-y-1"><span className={label}>{form.listing_type === 'rent' ? 'Budget per bulan (Rp)' : 'Budget maksimal (Rp)'}</span>
            <input value={form.budget} onChange={(event) => set('budget', event.target.value.replace(/[^0-9]/g, ''))} placeholder="1500000000" className={input} inputMode="numeric" />
          </label>
          <label className="space-y-1"><span className={label}>Kota / Kabupaten</span>
            <input value={form.city} onChange={(event) => set('city', event.target.value)} placeholder="Sleman" className={input} />
          </label>
          <label className="space-y-1"><span className={label}>Kecamatan (opsional)</span>
            <input value={form.district} onChange={(event) => set('district', event.target.value)} placeholder="Depok" className={input} />
          </label>
          <label className="space-y-1"><span className={label}>Tipe properti</span>
            <select value={form.property_type} onChange={(event) => set('property_type', event.target.value)} className={input}>
              <option value="">Semua tipe</option>
              <option value="house">Rumah</option>
              <option value="apartment">Apartemen</option>
              <option value="villa">Villa</option>
              <option value="land">Tanah</option>
              <option value="boardingHouse">Kos</option>
              <option value="shophouse">Ruko</option>
              <option value="office">Kantor</option>
            </select>
          </label>
          <label className="space-y-1"><span className={label}>Kamar tidur minimal</span>
            <input value={form.bedrooms} onChange={(event) => set('bedrooms', event.target.value.replace(/[^0-9]/g, ''))} placeholder="3" className={input} inputMode="numeric" />
          </label>
        </div>

        <label className="mt-3 block space-y-1"><span className={label}>Kebutuhan khusus</span>
          <textarea value={form.needs} onChange={(event) => set('needs', event.target.value)} rows={2} placeholder="Dekat sekolah & akses tol, ada carport 2 mobil, bisa KPR, lingkungan tenang…" className={input} />
        </label>

        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14553f] disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {busy ? 'AI sedang menilai listing…' : 'Cari rekomendasi AI'}
          </button>
          {!!result?.relaxed?.length && <span className="text-xs text-[#9b762a]">Filter dilonggarkan: {result.relaxed.join(', ')}</span>}
        </div>
        {error && <p className="mt-3 rounded-lg bg-[#fbeeec] px-3 py-2 text-xs text-[#b45c50]">{error}</p>}
      </div>

      {result && (
        <div className="space-y-3">
          {result.summary && (
            <div className="rounded-2xl border border-[#e5dccd] bg-[#f7f3ec] p-4 text-sm text-[#20332c]">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Ringkasan AI</p>
              {result.summary}
            </div>
          )}

          {result.recommendations.map((item) => (
            <a key={item.id} href={`/property/${item.id}`} className="block rounded-2xl border border-[#e5dccd] bg-white p-4 shadow-[0_10px_30px_rgba(20,42,32,.04)] transition hover:border-[#0b3d2e]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#0b3d2e]">{item.title ?? 'Properti'}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[#718078]">
                    <MapPin className="size-3" /> {[item.district, item.city].filter(Boolean).join(', ') || '—'}
                    {item.bedrooms != null && <> · {item.bedrooms} KT</>}
                    {item.building_area != null && <> · {item.building_area} m²</>}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#edf2ed] px-2.5 py-1 text-xs font-semibold text-[#4e866d]">Skor {item.match_score}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[#0b3d2e]">{rupiah(item.price)}{item.listing_type === 'rent' ? ' / bulan' : ''}</p>
              <p className="mt-2 text-sm text-[#33433d]"><BadgeCheck className="mr-1 inline size-3.5 text-[#4e866d]" />{item.why}</p>
              {item.watch_out && <p className="mt-1 text-xs text-[#9b762a]"><TriangleAlert className="mr-1 inline size-3.5" />{item.watch_out}</p>}
            </a>
          ))}

          {result.advice && (
            <div className="rounded-2xl border border-[#e5dccd] bg-white p-4 text-sm text-[#33433d]">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Langkah berikutnya</p>
              <p className="whitespace-pre-wrap">{result.advice}</p>
            </div>
          )}
          {result.disclaimer && <p className="text-xs text-[#8a9a92]">{result.disclaimer}</p>}
        </div>
      )}
    </div>
  )
}
