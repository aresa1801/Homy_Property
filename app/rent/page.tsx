'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronDown, Heart, Home, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DEMO_PROPERTY_IMAGES,
  FURNISHED_LABEL,
  firstMediaUrl,
  formatPriceWithPeriod,
  propertyLocation,
  propertyMeta,
  type PropertyRecord,
} from '@/lib/property-format'

const DEMO_LISTINGS: PropertyRecord[] = [
  { id: 'demo-r1', title: 'Japandi House in Canggu', city: 'Canggu, Bali', price: 28000000, price_period: 'monthly', bedrooms: 3, bathrooms: 2, building_area: 180, furnished: 'furnished' },
  { id: 'demo-r2', title: 'Skyline Residence', city: 'Kuningan, Jakarta Selatan', price: 16000000, price_period: 'monthly', bedrooms: 2, bathrooms: 2, building_area: 92, furnished: 'furnished' },
  { id: 'demo-r3', title: 'Quiet Villa Ubud', city: 'Ubud, Bali', price: 240000000, price_period: 'yearly', bedrooms: 2, bathrooms: 2, building_area: 145, furnished: 'semi_furnished' },
]

export default function RentPage() {
  const [duration, setDuration] = useState('Monthly')
  const [saved, setSaved] = useState<string[]>([])
  const [listings, setListings] = useState<PropertyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('')
  const [moveIn, setMoveIn] = useState('')
  const [appliedCity, setAppliedCity] = useState('')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initialCity = params.get('city') ?? ''
    setCity(initialCity)
    setAppliedCity(initialCity)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ listing_type: 'rent' })
    if (appliedCity) params.set('city', appliedCity)
    fetch(`/api/properties?${params.toString()}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return
        const rows: PropertyRecord[] = Array.isArray(payload?.data) ? payload.data : []
        setListings(rows.length > 0 ? rows : DEMO_LISTINGS)
      })
      .catch(() => { if (!cancelled) setListings(DEMO_LISTINGS) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [appliedCity])

  const shown = useMemo(() => listings, [listings])

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1c1c1c]">
      <header className="border-b border-[#e8dfd3] bg-[#0b3d2e] text-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="/" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#c9a961] text-[#0b3d2e]"><Home /></span><span className="font-serif text-2xl font-bold">Homy<span className="text-[#c9a961]">.</span></span></a>
          <nav className="hidden gap-8 text-sm text-white/75 md:flex"><a href="/buy">Jual</a><a className="text-[#c9a961]" href="/rent">Sewa</a><a href="/list">Pasang Properti</a><a href="/message">Pesan</a></nav>
          <Button className="rounded-full bg-[#c9a961] text-[#0b3d2e] hover:bg-[#e1c67e]" onClick={() => window.location.assign('/auth/login')}>Masuk</Button>
        </div>
      </header>
      <section className="bg-[#0b3d2e] px-5 pb-16 pt-14 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#c9a961]">Sewa dengan tenang</p>
          <h1 className="font-serif text-5xl sm:text-6xl">Temukan hunian untuk<br /><span className="text-[#c9a961]">tahap hidup Anda berikutnya.</span></h1>
          <p className="mt-5 max-w-xl text-white/70">Sewa fleksibel, biaya transparan, dan hunian siap saat Anda membutuhkannya.</p>
          <div className="mt-10 grid gap-3 rounded-2xl bg-white p-3 text-[#1c1c1c] shadow-2xl md:grid-cols-[1.5fr_1fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Location<input value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded-lg border border-[#e8dfd3] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c9a961]" placeholder="Kota atau area" /></label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Duration<select value={duration} onChange={(e) => setDuration(e.target.value)} className="h-11 rounded-lg border border-[#e8dfd3] px-3 text-sm"><option>Monthly</option><option>Yearly</option></select></label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Move-in date<input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} className="h-11 rounded-lg border border-[#e8dfd3] px-3 text-sm" /></label>
            <Button className="h-11 rounded-lg bg-[#c9a961] text-[#0b3d2e] hover:bg-[#b7964f]" onClick={() => setAppliedCity(city)}><Search data-icon="inline-start" /> Search</Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Curated rentals</p><h2 className="mt-2 font-serif text-4xl text-[#0b3d2e]">Homes available now</h2></div>
          <div className="flex gap-2"><Button variant="outline" className="border-[#d8ccbb]"><SlidersHorizontal data-icon="inline-start" /> Filters</Button><Button variant="outline" className="border-[#d8ccbb]">Recommended <ChevronDown data-icon="inline-end" /></Button></div>
        </div>
        {!loading && shown.length === 0 && <p className="mt-8 rounded-2xl bg-white p-6 text-sm text-[#65706c]">Belum ada properti sewa untuk filter ini.</p>}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {shown.map((item, i) => {
            const image = firstMediaUrl(item, supabaseUrl) ?? DEMO_PROPERTY_IMAGES[i % DEMO_PROPERTY_IMAGES.length]
            const isSaved = saved.includes(item.id)
            const monthly = item.price_period === 'yearly' ? Math.round((item.price ?? 0) / 12) : item.price
            const shownPrice = duration === 'Yearly' ? (item.price_period === 'yearly' ? item.price : (item.price ?? 0) * 12) : monthly
            return (
              <article key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.07)]">
                <div className="relative aspect-[1.3] overflow-hidden">
                  <img src={image} alt={item.title} className="size-full object-cover transition duration-500 hover:scale-105" />
                  <span className="absolute left-4 top-4 rounded-full bg-[#0b3d2e] px-3 py-1 text-xs font-semibold text-[#f6e2a8]">Available now</span>
                  <button aria-label={`Save ${item.title}`} onClick={() => setSaved((s) => isSaved ? s.filter((x) => x !== item.id) : [...s, item.id])} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/90 text-[#0b3d2e]"><Heart className={isSaved ? 'fill-[#a3282c] text-[#a3282c]' : ''} /></button>
                </div>
                <div className="p-5">
                  <h3 className="font-serif text-2xl text-[#0b3d2e]">{item.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-[#65706c]"><MapPin /> {propertyLocation(item)}</p>
                  <p className="mt-4 text-lg font-bold text-[#0b3d2e]">{formatPriceWithPeriod(shownPrice, duration === 'Yearly' ? 'yearly' : 'monthly')}</p>
                  <p className="mt-2 text-sm text-[#65706c]">{propertyMeta(item)}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {item.furnished && <span className="inline-flex items-center gap-1 rounded-full bg-[#edf2ed] px-3 py-1 text-[#0b3d2e]"><Check className="size-3" /> {FURNISHED_LABEL[item.furnished] ?? item.furnished}</span>}
                    <span className="rounded-full bg-[#f7f3ec] px-3 py-1 text-[#65706c]">Utilities optional</span>
                  </div>
                  <Button className="mt-6 w-full rounded-lg bg-[#0b3d2e] text-white hover:bg-[#14533f]" onClick={() => window.location.assign(`/property/${item.id}`)}>Ajukan sewa</Button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
      <section className="border-y border-[#e8dfd3] bg-[#fbf8f3] px-5 py-14">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3"><CalendarDays className="text-[#c09b54]" /><h2 className="font-serif text-3xl text-[#0b3d2e]">Renting, made transparent.</h2></div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-5"><p className="font-semibold text-[#0b3d2e]">Know the full cost</p><p className="mt-2 text-sm text-[#65706c]">Deposit, service charge, dan maintenance ditampilkan di awal.</p></div>
            <div className="rounded-xl bg-white p-5"><p className="font-semibold text-[#0b3d2e]">Digital contract</p><p className="mt-2 text-sm text-[#65706c]">Tinjau dan tanda tangani perjanjian Anda dengan aman secara online.</p></div>
            <div className="rounded-xl bg-white p-5"><p className="font-semibold text-[#0b3d2e]">Payment reminders</p><p className="mt-2 text-sm text-[#65706c]">Tidak pernah lewatkan pembayaran sewa berulang.</p></div>
          </div>
        </div>
      </section>
    </main>
  )
}
