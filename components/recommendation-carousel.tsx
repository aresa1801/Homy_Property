'use client'

/**
 * Carousel "Pilihan khusus untuk Anda".
 *
 * Menampilkan hingga 10 rekomendasi properti dari `GET /api/properties/recommendations`.
 * Rekomendasi diprioritaskan pada properti di kota/kecamatan pengguna:
 *  1. kota dari pencarian yang tersimpan di perangkat (localStorage `homy.city`)
 *  2. perkiraan kota dari IP (header `x-vercel-ip-city` — diisi otomatis oleh Vercel)
 *  3. kalau izin lokasi sudah pernah diberikan, pakai koordinat perangkat
 *     (di-reverse-geocode tanpa API key)
 *
 * Perilaku carousel:
 *  - otomatis bergeser tiap 5 detik HANYA bila rekomendasi lebih dari 2
 *  - berhenti sementara saat kursor menyentuh / jari men-drag / tab disembunyikan
 *  - klik kartu langsung membuka halaman properti (detail) miliknya
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, Image as ImageIcon, Loader2, MapPin } from 'lucide-react'
import { DEMO_PROPERTY_IMAGES, firstMediaUrl, formatPriceWithPeriod, propertyLocation, propertyMeta, type PropertyRecord } from '@/lib/property-format'

const CITY_KEY = 'homy.city'
const AUTO_MS = 5000

type RecommendationRow = PropertyRecord & {
  listing_type?: string | null
  property_media?: { storage_path: string; media_type?: string | null; sort_order?: number | null }[] | null
}

type Card = {
  id: string
  title: string
  location: string
  price: string
  meta: string
  image: string | null
  tag: string
  type: string
}

const tagFor = (row: RecommendationRow, nearby: boolean) => {
  const kind = row.listing_type === 'rent' ? 'Sewa' : 'Jual'
  return `${nearby ? 'Sekitar Anda' : 'Rekomendasi'} · ${kind}`
}

export function RecommendationCarousel() {
  const [cards, setCards] = useState<Card[]>([])
  const [city, setCity] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [failed, setFailed] = useState(false)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const indexRef = useRef(0)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  useEffect(() => { indexRef.current = index }, [index])

  const load = useCallback(async (withSavedCity = true) => {
    setBusy(true)
    setFailed(false)
    try {
      let saved = ''
      try { saved = withSavedCity ? (window.localStorage.getItem(CITY_KEY) ?? '') : '' } catch { saved = '' }
      const response = await fetch(`/api/properties/recommendations?limit=10${saved ? `&city=${encodeURIComponent(saved)}` : ''}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'gagal')
      const rows: RecommendationRow[] = Array.isArray(payload?.data) ? payload.data : []
      const resolvedCity: string | null = payload?.city ?? null
      const nearbyCount = Number(payload?.matched ?? 0)
      setCity(resolvedCity)
      if (resolvedCity) { try { window.localStorage.setItem(CITY_KEY, resolvedCity) } catch {} }
      setCards(rows.map((row, position) => ({
        id: row.id,
        title: row.title,
        location: propertyLocation(row),
        price: formatPriceWithPeriod(row.price, row.price_period),
        meta: propertyMeta(row),
        image: firstMediaUrl(row, supabaseUrl) ?? DEMO_PROPERTY_IMAGES[position % DEMO_PROPERTY_IMAGES.length] ?? null,
        tag: tagFor(row, position < nearbyCount),
        type: row.listing_type === 'rent' ? 'Sewa' : 'Jual',
      })))
      setIndex(0)
      indexRef.current = 0
      trackRef.current?.scrollTo({ left: 0, behavior: 'auto' })
      return { rows: rows.length, city: resolvedCity }
    } catch {
      setFailed(true)
      return { rows: 0, city: null }
    } finally {
      setBusy(false)
    }
  }, [supabaseUrl])

  useEffect(() => { void load() }, [load])

  // Kalau kota belum diketahui (mis. akses lokal tanpa header Vercel) dan izin lokasi
  // sudah pernah diberikan, coba pakai koordinat perangkat → reverse geocode (tanpa prompt).
  useEffect(() => {
    if (busy || city) return
    let cancelled = false
    const run = async () => {
      if (!('geolocation' in navigator) || !navigator.geolocation) return
      let granted = false
      try {
        const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
        granted = status?.state === 'granted'
      } catch { granted = false }
      if (!granted) return
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const { latitude, longitude } = position.coords
          const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`)
          const payload = await response.json().catch(() => ({}))
          const detected = String(payload?.city ?? payload?.locality ?? payload?.principalSubdivision ?? '').trim()
          if (!cancelled && detected) { try { window.localStorage.setItem(CITY_KEY, detected) } catch {} ; void load() }
        } catch { /* abaikan — rekomendasi tetap tampil tanpa filter kota */ }
      }, () => {}, { timeout: 8000, maximumAge: 600000 })
    }
    void run()
    return () => { cancelled = true }
  }, [busy, city, load])

  const step = useCallback(() => {
    const track = trackRef.current
    if (!track) return 0
    const first = track.querySelector<HTMLElement>('[data-carousel-card]')
    if (!first) return track.clientWidth
    const margin = Number.parseFloat(window.getComputedStyle(track).columnGap || '0') || 12
    return first.offsetWidth + margin
  }, [])

  const goTo = useCallback((position: number) => {
    const track = trackRef.current
    if (!track) return
    const total = cards.length
    if (!total) return
    const clamped = Math.max(0, Math.min(total - 1, position))
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    track.scrollTo({ left: clamped * step(), behavior: reduced ? 'auto' : 'smooth' })
    indexRef.current = clamped
    setIndex(clamped)
  }, [cards.length, step])

  // Autoplay: hanya saat ada lebih dari 2 rekomendasi, dan jeda saat disentuh.
  useEffect(() => {
    if (cards.length <= 2 || paused) return
    const timer = setInterval(() => {
      const next = indexRef.current >= cards.length - 1 ? 0 : indexRef.current + 1
      goTo(next)
    }, AUTO_MS)
    return () => clearInterval(timer)
  }, [cards.length, paused, goTo])

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const holdThenResume = () => {
    setPaused(true)
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => setPaused(false), 10_000)
  }

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current) }, [])

  const onScroll = () => {
    const track = trackRef.current
    if (!track) return
    const size = step() || 1
    const next = Math.max(0, Math.min(cards.length - 1, Math.round(track.scrollLeft / size)))
    if (next !== indexRef.current) { indexRef.current = next; setIndex(next) }
  }



  return (
    <section id="properties" className="mx-auto max-w-[1280px] px-4 pb-14 pt-48 sm:px-5 sm:pb-20 sm:pt-36 lg:px-8">
      <div className="mb-5 flex items-end justify-between gap-4 sm:mb-8">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Pilihan khusus untuk Anda</p>
          <h2 className="font-serif text-2xl text-[#0b3d2e] sm:text-4xl md:text-5xl">Properti yang mungkin Anda sukai</h2>
          <p className="mt-3 text-[#65706c]">
            {city ? <>Rekomendasi utama di sekitar <span className="font-semibold text-[#0b3d2e]">{city}</span>, lalu properti terbaru lainnya.</> : 'Pilihan personal berdasarkan kebutuhan Anda.'}
          </p>
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button type="button" aria-label="Rekomendasi sebelumnya" onClick={() => { holdThenResume(); goTo(indexRef.current - 1) }} disabled={cards.length <= 1} className="grid size-10 place-items-center rounded-full border border-[#d8ccbb] text-[#0b3d2e] transition hover:border-[#0b3d2e] disabled:opacity-40"><ChevronLeft className="size-5" /></button>
          <button type="button" aria-label="Rekomendasi berikutnya" onClick={() => { holdThenResume(); goTo(indexRef.current + 1) }} disabled={cards.length <= 1} className="grid size-10 place-items-center rounded-full border border-[#d8ccbb] text-[#0b3d2e] transition hover:border-[#0b3d2e] disabled:opacity-40"><ChevronRight className="size-5" /></button>
        </div>
      </div>

      {busy && (
        <div className="flex gap-3 overflow-hidden sm:gap-6">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-72 w-[78%] shrink-0 animate-pulse rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.07)] sm:w-[46%] lg:w-[31.8%]" />
          ))}
        </div>
      )}

      {!busy && !cards.length && (
        <div className="rounded-2xl bg-white p-6 text-center shadow-[0_10px_35px_rgba(20,42,32,.07)] sm:p-8">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#edf2ed] text-[#0b3d2e]"><ImageIcon className="size-5" /></span>
          <p className="mt-4 font-serif text-xl text-[#0b3d2e]">{failed ? 'Rekomendasi belum bisa dimuat' : 'Belum ada properti tayang'}</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#65706c]">
            {failed ? 'Coba muat ulang halaman sebentar lagi.' : 'Begitu ada properti yang tayang, rekomendasinya otomatis muncul di sini sesuai lokasi Anda.'}
          </p>
          <a href="/buy" className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#0b3d2e] px-4 text-sm font-semibold text-white hover:bg-[#14553f]">Jelajahi properti</a>
        </div>
      )}

      {!busy && cards.length > 0 && (
        <>
          <div
            ref={trackRef}
            onScroll={onScroll}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={holdThenResume}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
            className="homy-carousel flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-6"
            role="region"
            aria-label="Carousel rekomendasi properti"
          >
            {cards.map((property) => (
              <article
                key={property.id}
                data-carousel-card
                className="group flex w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(20,42,32,.14)] sm:w-[46%] lg:w-[31.8%]"
              >
                <a href={`/property/${property.id}`} className="relative block aspect-[1.3] overflow-hidden" aria-label={`Lihat detail ${property.title}`}>
                  {property.image
                    ? <img src={property.image} alt={property.title} className="size-full object-cover transition duration-500 group-hover:scale-105" />
                    : <span className="grid size-full place-items-center bg-[#f2f0ea] text-[#a18a61]"><ImageIcon className="size-6" /></span>}
                  <span className="absolute left-2 top-2 rounded-full bg-[#0b3d2e] px-2 py-1 text-[10px] font-semibold text-[#f6e2a8] sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-xs">{property.tag}</span>
                  <span className="pointer-events-none absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-[#0b3d2e] sm:right-4 sm:top-4 sm:size-9" aria-hidden>
                    <Heart className="size-4 sm:size-5" />
                  </span>
                </a>
                <a href={`/property/${property.id}`} className="flex flex-1 flex-col p-3 sm:p-5">
                  <h3 className="font-serif text-sm leading-tight text-[#0b3d2e] sm:text-lg lg:text-xl">{property.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[#65706c] sm:text-sm"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{property.location}</span></p>
                  <p className="mt-2 text-sm font-bold text-[#0b3d2e] sm:mt-4 sm:text-lg">{property.price}</p>
                  <p className="mt-1 hidden text-xs text-[#8a928e] sm:block">{property.meta}</p>
                </a>
              </article>
            ))}
          </div>

          {cards.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              {cards.map((property, position) => (
                <button
                  key={property.id}
                  type="button"
                  aria-label={`Ke rekomendasi ${position + 1}`}
                  onClick={() => { holdThenResume(); goTo(position) }}
                  className={`h-1.5 rounded-full transition-all ${position === Math.min(index, cards.length - 1) ? 'w-5 bg-[#0b3d2e]' : 'w-1.5 bg-[#d8ccbb]'}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
