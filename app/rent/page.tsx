'use client'

import { useEffect, useMemo, useState } from 'react'
import { SaveSearchButton } from '@/components/save-search-button'
import { BadgeCheck, Building2, CalendarDays, Check, Heart, MapPin, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import {
  DEMO_PROPERTY_IMAGES,
  FURNISHED_LABEL,
  PROPERTY_TYPE_LABEL,
  firstMediaUrl,
  formatPriceWithPeriod,
  formatRupiah,
  propertyLocation,
  type PropertyRecord,
} from '@/lib/property-format'

type Duration = 'monthly' | 'yearly'

const BANDS: Record<Duration, { value: string; label: string; min: number; max: number }[]> = {
  monthly: [
    { value: 'under10', label: 'Di bawah Rp 10 jt/bulan', min: 0, max: 10_000_000 },
    { value: '10to25', label: 'Rp 10 jt — Rp 25 jt/bulan', min: 10_000_000, max: 25_000_000 },
    { value: 'over25', label: 'Di atas Rp 25 jt/bulan', min: 25_000_000, max: Number.POSITIVE_INFINITY },
  ],
  yearly: [
    { value: 'under120', label: 'Di bawah Rp 120 jt/tahun', min: 0, max: 120_000_000 },
    { value: '120to300', label: 'Rp 120 jt — Rp 300 jt/tahun', min: 120_000_000, max: 300_000_000 },
    { value: 'over300', label: 'Di atas Rp 300 jt/tahun', min: 300_000_000, max: Number.POSITIVE_INFINITY },
  ],
}

/** Normalisasi ke tarif bulanan agar pembanding tetap adil (jual vs sewa tidak pernah dicampur). */
function monthlyRate(home: PropertyRecord) {
  const price = Number(home.price ?? 0)
  if (!price) return 0
  if (home.price_period === 'yearly') return Math.round(price / 12)
  return price
}

export default function RentPage() {
  const [saved, setSaved] = useState<string[]>([])
  const [listings, setListings] = useState<PropertyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [duration, setDuration] = useState<Duration>('monthly')
  const [city, setCity] = useState('')
  const [type, setType] = useState('')
  const [furnished, setFurnished] = useState('')
  const [band, setBand] = useState('')
  const [moveIn, setMoveIn] = useState('')
  const [sort, setSort] = useState('newest')
  const [applied, setApplied] = useState({ city: '' })
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initialCity = params.get('city') ?? ''
    setCity(initialCity)
    setApplied({ city: initialCity })
    const initialType = params.get('type') ?? ''
    if (initialType) setType(initialType)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ listing_type: 'rent' })
    if (applied.city) params.set('city', applied.city)
    fetch('/api/properties?' + params.toString())
      .then((response) => response.json())
      .then((payload) => { if (!cancelled) setListings(Array.isArray(payload?.data) ? payload.data : []) })
      .catch(() => { if (!cancelled) setListings([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [applied])

  const shown = useMemo(() => {
    const rows = listings.filter((home) => {
      if ((home.price_period ?? 'monthly') !== duration) return false
      if (type && (home.property_type ?? '') !== type) return false
      if (furnished && (home.furnished ?? '') !== furnished) return false
      if (band) {
        const rule = BANDS[duration].find((item) => item.value === band)
        const price = Number(home.price ?? 0)
        if (rule && (price < rule.min || price > rule.max)) return false
      }
      if (moveIn && home.available_from && new Date(home.available_from).getTime() > new Date(moveIn).getTime()) return false
      return true
    })
    if (sort === 'lowest') rows.sort((a, b) => monthlyRate(a) - monthlyRate(b))
    else if (sort === 'highest') rows.sort((a, b) => monthlyRate(b) - monthlyRate(a))
    return rows
  }, [listings, duration, type, furnished, band, moveIn, sort])

  const cheapest = useMemo(() => (shown.length ? shown.reduce((min, row) => (monthlyRate(row) < monthlyRate(min) ? row : min)) : null), [shown])
  const estimate = cheapest ? Math.round(monthlyRate(cheapest) * 1.15) : 0

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1c1c1c]">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-5 pb-8 pt-12 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Properti untuk disewa</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-serif text-3xl sm:text-5xl text-[#0b3d2e]">Sewa hunian tanpa drama.</h1>
            <p className="mt-3 max-w-2xl text-[#65706c]">Pilih durasi sewa, tipe properti, dan kondisi furnitur. Semua biaya awal ditampilkan transparan sebelum Anda menghubungi pemilik.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white p-1 shadow-sm">
            {(['monthly', 'yearly'] as Duration[]).map((item) => (
              <button key={item} type="button" onClick={() => { setDuration(item); setBand('') }} className={'rounded-full px-5 py-2 text-sm font-semibold transition ' + (duration === item ? 'bg-[#0b3d2e] text-white' : 'text-[#65706c] hover:bg-[#f7f3ec]')}>{item === 'monthly' ? 'Bulanan' : 'Tahunan'}</button>
            ))}
          </div>
        </div>
        <div className="mt-8 grid gap-3 rounded-2xl bg-white p-3 shadow-sm md:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Lokasi<input value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded-lg border border-[#e8dfd3] px-3 text-sm" placeholder="Kota, area" /></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Tipe properti<select value={type} onChange={(e) => setType(e.target.value)} className="h-11 rounded-lg border border-[#e8dfd3] px-3 text-sm"><option value="">Semua tipe</option>{Object.entries(PROPERTY_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Furnitur<select value={furnished} onChange={(e) => setFurnished(e.target.value)} className="h-11 rounded-lg border border-[#e8dfd3] px-3 text-sm"><option value="">Semua kondisi</option><option value="furnished">Furnished</option><option value="semi_furnished">Semi furnished</option><option value="unfurnished">Unfurnished</option></select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Budget ({duration === 'monthly' ? 'per bulan' : 'per tahun'})<select value={band} onChange={(e) => setBand(e.target.value)} className="h-11 rounded-lg border border-[#e8dfd3] px-3 text-sm"><option value="">Semua harga</option>{BANDS[duration].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <Button className="h-11 rounded-lg bg-[#0b3d2e] text-white hover:bg-[#14533f]" onClick={() => setApplied({ city })}><Search data-icon="inline-start" /> Cari</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#65706c]">
          <label className="flex items-center gap-2 font-semibold">Mulai huni<input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} className="h-9 rounded-lg border border-[#e8dfd3] px-3 text-xs font-normal" /></label>
          <label className="flex items-center gap-2 font-semibold">Urutkan<select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 rounded-lg border border-[#e8dfd3] px-3 text-xs font-normal"><option value="newest">Terbaru</option><option value="lowest">Harga terendah</option><option value="highest">Harga tertinggi</option></select></label>
          {(type || furnished || band || moveIn) && <button type="button" onClick={() => { setType(''); setFurnished(''); setBand(''); setMoveIn('') }} className="font-semibold text-[#0b3d2e] underline">Reset filter</button>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 sm:gap-8 px-5 pb-16 lg:grid-cols-[1fr_300px] lg:px-8">
        <div>
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm text-[#65706c]"><strong className="text-[#0b3d2e]">{loading ? '…' : shown.length}</strong> properti sewa ditemukan</p>
            <div className="flex flex-wrap items-center gap-2"><SaveSearchButton listingType="rent" city={applied.city} minPrice={(BANDS[duration].find((item) => item.value === band)?.min) ?? undefined} maxPrice={(BANDS[duration].find((item) => item.value === band)?.max) ?? undefined} /><Button variant="outline" className="border-[#d8ccbb]"><SlidersHorizontal data-icon="inline-start" /> Filter lanjutan</Button></div>
          </div>
          {loading && <div className="grid grid-cols-2 gap-3 sm:gap-6">{[0, 1].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-white" />)}</div>}
          {!loading && shown.length === 0 && (
            <div className="rounded-2xl bg-white p-4 sm:p-6 text-sm text-[#65706c]">
              Belum ada properti sewa yang cocok dengan filter ini. Coba ubah durasi (Bulanan/Tahunan), longgarkan budget, atau gunakan <a className="font-semibold text-[#0b3d2e] underline" href="/ai-assistant">Asisten AI</a> untuk rekomendasi.
            </div>
          )}
          {/* Dua kartu per baris (di HP maupun desktop) supaya daftar properti sewa lebih ringkas. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {shown.map((home, i) => {
              const image = firstMediaUrl(home, supabaseUrl) ?? DEMO_PROPERTY_IMAGES[i % DEMO_PROPERTY_IMAGES.length]
              const isSaved = saved.includes(home.id)
              return (
                <article key={home.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.07)]">
                  <div className="relative aspect-[1.25] overflow-hidden">
                    <img src={image} alt={home.title} className="size-full object-cover transition duration-500 hover:scale-105" />
                    <div className="absolute left-2 top-2 rounded-full bg-[#0b3d2e] px-2 py-1 text-[10px] font-semibold text-[#f6e2a8] sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-xs">{home.price_period === 'yearly' ? 'Sewa Tahunan' : 'Sewa Bulanan'}</div>
                    <button aria-label={'Simpan ' + home.title} onClick={() => setSaved((s) => (isSaved ? s.filter((x) => x !== home.id) : [...s, home.id]))} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-[#0b3d2e] sm:right-4 sm:top-4 sm:size-9"><Heart className={`size-4 sm:size-5 ${isSaved ? 'fill-[#a3282c] text-[#a3282c]' : ''}`} /></button>
                  </div>
                  <div className="flex flex-1 flex-col p-3 sm:p-5">
                    <h2 className="font-serif text-sm leading-tight text-[#0b3d2e] sm:text-2xl">{home.title}</h2>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-[#65706c] sm:text-sm"><MapPin className="size-3.5 shrink-0" /> <span className="truncate">{propertyLocation(home)}</span></p>
                    <p className="mt-2 text-sm font-bold text-[#0b3d2e] sm:mt-4 sm:text-lg">{formatPriceWithPeriod(home.price, home.price_period)}</p>
                    <div className="mt-2 flex flex-wrap gap-1 text-[10px] sm:mt-3 sm:gap-2 sm:text-xs">
                      {home.furnished && <span className="rounded-full bg-[#e2eee7] px-2 py-0.5 font-semibold text-[#0b3d2e] sm:px-3 sm:py-1">{FURNISHED_LABEL[home.furnished] ?? home.furnished}</span>}
                      {home.bedrooms ? <span className="rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[#33433d] sm:px-3 sm:py-1">{home.bedrooms} KT</span> : null}
                      {home.bathrooms ? <span className="rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[#33433d] sm:px-3 sm:py-1">{home.bathrooms} KM</span> : null}
                      {home.min_lease_months ? <span className="rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[#33433d] sm:px-3 sm:py-1">Min. {home.min_lease_months} bulan</span> : null}
                      {home.available_from ? <span className="rounded-full bg-[#fff7e3] px-2 py-0.5 text-[#9b762a] sm:px-3 sm:py-1">Siap huni {new Date(home.available_from).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span> : null}
                    </div>
                    <p className="mt-2 hidden text-sm text-[#65706c] sm:block">{monthlyRate(home) ? 'Setara ' + formatRupiah(monthlyRate(home)) + '/bulan' : 'Harga belum diisi'}</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:mt-auto sm:grid-cols-2 sm:pt-4">
                      <Button className="w-full rounded-lg bg-[#c9a961] text-xs text-[#0b3d2e] hover:bg-[#b7964f] sm:text-sm" onClick={() => window.location.assign('/property/' + home.id)}>Lihat detail</Button>
                      <Button variant="outline" className="w-full rounded-lg border-[#d8ccbb] text-xs sm:text-sm" onClick={() => window.location.assign('/property/' + home.id + '#sewa')}>Ajukan sewa</Button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="h-fit rounded-2xl bg-[#0f2a44] p-4 sm:p-6 text-white">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#c9a961] text-[#0f2a44]"><Building2 /></span><div><p className="font-semibold">Rekomendasi AI</p><p className="text-xs text-white/60">Berdasarkan listing sewa tersedia</p></div></div>
            <p className="mt-6 leading-7 text-white/85">{shown.length ? 'Ada ' + shown.length + ' properti sewa yang cocok. Termurah: ' + (cheapest?.title ?? '-') + ' di ' + (cheapest ? propertyLocation(cheapest) : '-') + '.' : 'Belum ada listing sewa yang cocok dengan filter Anda saat ini.'}</p>
            <div className="mt-5 flex items-start gap-2 text-sm text-white/65"><Check className="mt-1 text-[#c9a961]" /> Durasi {duration === 'monthly' ? 'bulanan' : 'tahunan'}</div>
            <div className="mt-3 flex items-start gap-2 text-sm text-white/65"><CalendarDays className="mt-1 text-[#c9a961]" /> Ketersediaan &amp; min. sewa ditampilkan</div>
            <div className="mt-3 flex items-start gap-2 text-sm text-white/65"><BadgeCheck className="mt-1 text-[#c9a961]" /> Listing sudah melewati moderasi</div>
          </div>

          <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-[0_10px_30px_rgba(20,42,32,.05)]">
            <div className="flex items-center gap-2 text-[#0b3d2e]"><Sparkles className="size-5" /><p className="font-semibold">Estimasi biaya awal</p></div>
            <p className="mt-2 text-xs text-[#718078]">Contoh untuk properti termurah pada filter Anda: sewa periode pertama + deposit (1 bulan) + estimasi service charge 5%.</p>
            <div className="mt-4 space-y-2 text-sm text-[#33433d]">
              <div className="flex justify-between"><span>Sewa periode 1</span><strong>{cheapest ? formatRupiah(cheapest.price) : '—'}</strong></div>
              <div className="flex justify-between"><span>Deposit (setara 1 bulan)</span><strong>{cheapest ? formatRupiah(monthlyRate(cheapest)) : '—'}</strong></div>
              <div className="flex justify-between"><span>Service charge (est. 5%)</span><strong>{cheapest ? formatRupiah(Math.round(monthlyRate(cheapest) * 0.05)) : '—'}</strong></div>
              <div className="mt-2 flex justify-between border-t border-[#f0e9df] pt-3 text-base"><span className="font-semibold">Total perkiraan</span><strong className="text-[#0b3d2e]">{estimate ? formatRupiah(estimate) : '—'}</strong></div>
            </div>
            <Button className="mt-5 w-full rounded-lg bg-[#0b3d2e] text-white hover:bg-[#14553f]" onClick={() => window.location.assign('/ai-assistant')}>Tanya Asisten AI</Button>
          </div>
        </aside>
      </section>
      <SiteFooter />
    </main>
  )
}
