'use client'

import { useEffect, useMemo, useState } from 'react'
import { BedDouble, Building2, Check, Heart, Home, Map, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DEMO_PROPERTY_IMAGES,
  FURNISHED_LABEL,
  PROPERTY_TYPE_LABEL,
  firstMediaUrl,
  formatPriceWithPeriod,
  propertyLocation,
  propertyMeta,
  type PropertyRecord,
} from '@/lib/property-format'

const DEMO_HOMES: PropertyRecord[] = [
  { id: 'demo-1', title: 'Modern Tropical Villa', city: 'Canggu, Bali', price: 4850000000, bedrooms: 4, bathrooms: 3, building_area: 280 },
  { id: 'demo-2', title: 'Skyline Apartment', city: 'SCBD, Jakarta Selatan', price: 3200000000, bedrooms: 2, bathrooms: 2, building_area: 95 },
  { id: 'demo-3', title: 'The Green Residence', city: 'Dago, Bandung', price: 2750000000, bedrooms: 3, bathrooms: 2, building_area: 180 },
]

export default function BuyPage() {
  const [saved, setSaved] = useState<string[]>([])
  const [homes, setHomes] = useState<PropertyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('')
  const [type, setType] = useState('')
  const [priceBand, setPriceBand] = useState('')
  const [applied, setApplied] = useState<{ city: string; type: string; priceBand: string }>({ city: '', type: '', priceBand: '' })
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initialCity = params.get('city') ?? ''
    const initialType = params.get('type') ?? ''
    setCity(initialCity)
    setType(initialType)
    setApplied({ city: initialCity, type: initialType, priceBand: '' })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setHomes([])
    const params = new URLSearchParams({ listing_type: 'sale' })
    if (applied.city) params.set('city', applied.city)
    fetch(`/api/properties?${params.toString()}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return
        const rows: PropertyRecord[] = Array.isArray(payload?.data) ? payload.data : []
        setHomes(rows.length > 0 ? rows : DEMO_HOMES)
      })
      .catch(() => { if (!cancelled) setHomes(DEMO_HOMES) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [applied])

  const filtered = useMemo(() => {
    return homes.filter((home) => {
      if (applied.type && (home.property_type ?? '') !== applied.type) return false
      if (applied.priceBand === 'under3' && (home.price ?? 0) >= 3000000000) return false
      if (applied.priceBand === '3to5' && ((home.price ?? 0) < 3000000000 || (home.price ?? 0) > 5000000000)) return false
      if (applied.priceBand === 'over5' && (home.price ?? 0) <= 5000000000) return false
      return true
    })
  }, [homes, applied])

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1c1c1c]">
      <header className="border-b border-[#e8dfd3] bg-[#0b3d2e] text-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="/" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#c9a961] text-[#0b3d2e]"><Home /></span><span className="font-serif text-2xl font-bold">Homy<span className="text-[#c9a961]">.</span></span></a>
          <nav className="hidden gap-8 text-sm text-white/75 md:flex"><a className="text-[#c9a961]" href="/buy">Jual</a><a href="/rent">Sewa</a><a href="/list">Pasang Properti</a><a href="/message">Pesan</a></nav>
          <Button className="rounded-full bg-[#c9a961] text-[#0b3d2e] hover:bg-[#e1c67e]" onClick={() => window.location.assign('/auth/login')}>Masuk</Button>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 pb-8 pt-12 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Properti untuk dijual</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-5"><div><h1 className="font-serif text-5xl text-[#0b3d2e]">Temukan hunian impian Anda.</h1><p className="mt-3 text-[#65706c]">Jelajahi hunian pilihan yang sesuai dengan gaya hidup dan tujuan Anda.</p></div><Button variant="outline" className="border-[#d8ccbb]"><Map data-icon="inline-start" /> Tampilan peta</Button></div>
        <div className="mt-8 grid gap-3 rounded-2xl bg-white p-3 shadow-sm md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Location<input value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded-lg border border-[#e8dfd3] px-3 text-sm" placeholder="Kota, area" /></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Property type<select value={type} onChange={(e) => setType(e.target.value)} className="h-11 rounded-lg border border-[#e8dfd3] px-3 text-sm"><option value="">All property types</option><option value="house">House</option><option value="apartment">Apartment</option><option value="villa">Villa</option><option value="land">Land</option><option value="shopHouse">Ruko</option></select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Price range<select value={priceBand} onChange={(e) => setPriceBand(e.target.value)} className="h-11 rounded-lg border border-[#e8dfd3] px-3 text-sm"><option value="">Any price</option><option value="under3">Under Rp 3B</option><option value="3to5">Rp 3B — Rp 5B</option><option value="over5">Over Rp 5B</option></select></label>
          <Button className="h-11 rounded-lg bg-[#0b3d2e] text-white hover:bg-[#14533f]" onClick={() => setApplied({ city, type, priceBand })}><Search data-icon="inline-start" /> Search</Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-16 lg:grid-cols-[1fr_300px] lg:px-8">
        <div>
          <div className="mb-5 flex items-center justify-between"><p className="text-sm text-[#65706c]"><strong className="text-[#0b3d2e]">{loading ? '…' : filtered.length}</strong> properti ditemukan</p><Button variant="outline" className="border-[#d8ccbb]"><SlidersHorizontal data-icon="inline-start" /> Advanced filters</Button></div>
          {!loading && filtered.length === 0 && <p className="rounded-2xl bg-white p-6 text-sm text-[#65706c]">Belum ada properti untuk filter ini.</p>}
          <div className="grid gap-6 sm:grid-cols-2">
            {filtered.map((home, i) => {
              const image = firstMediaUrl(home, supabaseUrl) ?? DEMO_PROPERTY_IMAGES[i % DEMO_PROPERTY_IMAGES.length]
              const isSaved = saved.includes(home.id)
              return (
                <article key={home.id} className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.07)]">
                  <div className="relative aspect-[1.25] overflow-hidden">
                    <img src={image} alt={home.title} className="size-full object-cover transition duration-500 hover:scale-105" />
                    <button aria-label={`Save ${home.title}`} onClick={() => setSaved((s) => isSaved ? s.filter((x) => x !== home.id) : [...s, home.id])} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/90 text-[#0b3d2e]"><Heart className={isSaved ? 'fill-[#a3282c] text-[#a3282c]' : ''} /></button>
                  </div>
                  <div className="p-5">
                    <h2 className="font-serif text-2xl text-[#0b3d2e]">{home.title}</h2>
                    <p className="mt-1 flex items-center gap-1 text-sm text-[#65706c]"><MapPin /> {propertyLocation(home)}</p>
                    <p className="mt-4 text-lg font-bold text-[#0b3d2e]">{formatPriceWithPeriod(home.price, home.price_period)}</p>
                    <p className="mt-2 text-sm text-[#65706c]">{propertyMeta(home)}</p>
                    <Button className="mt-5 w-full rounded-lg bg-[#c9a961] text-[#0b3d2e] hover:bg-[#b7964f]" onClick={() => window.location.assign(`/property/${home.id}`)}>Lihat detail</Button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
        <aside className="h-fit rounded-2xl bg-[#0f2a44] p-6 text-white">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#c9a961] text-[#0f2a44]"><Building2 /></span><div><p className="font-semibold">Rekomendasi AI</p><p className="text-xs text-white/60">Transparan & personal</p></div></div>
          <p className="mt-6 leading-7 text-white/85">Berdasarkan pencarian Anda, properti ini cocok dengan minat Anda pada hunian luas dan siap huni.</p>
          <div className="mt-5 flex items-start gap-2 text-sm text-white/65"><Check className="mt-1 text-[#c9a961]" /> Preferensi lokasi</div>
          <div className="mt-3 flex items-start gap-2 text-sm text-white/65"><BedDouble className="mt-1 text-[#c9a961]" /> Kesesuaian kamar & luas</div>
          <Button className="mt-7 w-full rounded-lg bg-[#c9a961] text-[#0f2a44] hover:bg-[#e1c67e]">Bandingkan properti</Button>
        </aside>
      </section>
    </main>
  )
}
