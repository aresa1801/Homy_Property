'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowRight,
  BedDouble,
  Building2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Heart,
  Home as HomeIcon,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Waves,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DEMO_PROPERTY_IMAGES,
  firstMediaUrl,
  formatPriceWithPeriod,
  propertyLocation,
  propertyMeta,
  type PropertyRecord,
} from '@/lib/property-format'

type Card = {
  id: string
  title: string
  location: string
  price: string
  meta: string
  image: string
  tag: string
}

const DEMO_PROPERTIES: PropertyRecord[] = [
  { id: 'demo-1', title: 'Modern Tropical Villa', city: 'Canggu, Bali', price: 4850000000, bedrooms: 4, bathrooms: 3, building_area: 280 },
  { id: 'demo-2', title: 'Skyline Apartment', city: 'SCBD, Jakarta Selatan', price: 3200000000, bedrooms: 2, bathrooms: 2, building_area: 95 },
  { id: 'demo-3', title: 'The Green Residence', city: 'Dago, Bandung', price: 2750000000, bedrooms: 3, bathrooms: 2, building_area: 180 },
]

const TAGS = ['AI Pick', 'Featured', 'Baru']

function toCard(p: PropertyRecord, index: number, supabaseUrl?: string): Card {
  const mediaUrl = firstMediaUrl(p, supabaseUrl)
  return {
    id: p.id,
    title: p.title,
    location: propertyLocation(p),
    price: formatPriceWithPeriod(p.price, p.price_period),
    meta: propertyMeta(p),
    image: mediaUrl ?? DEMO_PROPERTY_IMAGES[index % DEMO_PROPERTY_IMAGES.length],
    tag: TAGS[index % TAGS.length],
  }
}

const categories = [
  { key: 'house', icon: HomeIcon },
  { key: 'apartment', icon: Building2 },
  { key: 'land', icon: Waves },
  { key: 'shopHouse', icon: Building2 },
  { key: 'villa', icon: HomeIcon },
  { key: 'boardingHouse', icon: BedDouble },
]

export default function Home() {
  const t = (key: string) => ({ sale: 'Jual', rent: 'Sewa', explore: 'Jelajahi', messages: 'Pesan', dashboard: 'Dasbor', signIn: 'Masuk', listProperty: 'Pasang Properti', becomePartner: 'Daftar sebagai Agen atau Pemilik', aiPropertySearch: 'Pencarian properti berbasis AI', findPlace: 'Temukan tempat untuk disebut rumah.', heroDescription: 'Temukan properti pilihan yang sesuai dengan gaya hidup dan tujuan Anda.', tellUs: 'Ceritakan hunian yang Anda cari', location: 'Lokasi', propertyType: 'Tipe properti', budget: 'Anggaran', anyType: 'Semua tipe', anyBudget: 'Semua anggaran', searchNow: 'Cari sekarang', curatedForYou: 'Pilihan khusus untuk Anda', propertiesYouLove: 'Properti yang mungkin Anda sukai', personalizedPicks: 'Pilihan personal berdasarkan kebutuhan Anda.', exploreByType: 'Jelajahi berdasarkan tipe', whatLookingFor: 'Apa yang sedang Anda cari?', viewAll: 'Lihat semua', planConfidence: 'Rencanakan dengan yakin', moveClarity: 'Ambil keputusan dengan jelas.', kprCalculator: 'Kalkulator KPR', estimateInstallment: 'Perkirakan cicilan bulanan Anda', nextChapter: 'Babak berikutnya dimulai di sini.', talkAssistant: 'Bicara dengan asisten AI', house: 'Rumah', apartment: 'Apartemen', land: 'Tanah', shopHouse: 'Ruko', villa: 'Vila', boardingHouse: 'Kost' }[key] ?? key)
  const language = 'id'
  const [mode, setMode] = useState('Sale')
  const [location, setLocation] = useState('')
  const [favorites, setFavorites] = useState<string[]>([])
  const [price, setPrice] = useState(1500000000)
  const [downPayment, setDownPayment] = useState(20)
  const [tenor, setTenor] = useState(15)
  const [activeSlide, setActiveSlide] = useState(0)
  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await createClient().from('profiles').select('role').eq('id', data.user.id).maybeSingle()
      setProfileRole(profile?.role ?? 'user')
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/properties')
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return
        const rows: PropertyRecord[] = Array.isArray(payload?.data) ? payload.data : []
        const source = rows.length > 0 ? rows : DEMO_PROPERTIES
        setCards(source.slice(0, 6).map((p, index) => toCard(p, index, supabaseUrl)))
      })
      .catch(() => {
        if (!cancelled) setCards(DEMO_PROPERTIES.map((p, index) => toCard(p, index, supabaseUrl)))
      })
    return () => { cancelled = true }
  }, [supabaseUrl])

  const installment = useMemo(() => {
    const principal = price * (1 - downPayment / 100)
    const monthlyRate = 0.085 / 12
    const months = tenor * 12
    return Math.round((principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1))
  }, [price, downPayment, tenor])

  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f3ec] text-[#1c1c1c]">
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/15 bg-[#0b3d2e]/90 text-white backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:h-[76px] sm:px-5 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Homy Property home">
            <span className="grid size-10 place-items-center rounded-xl bg-[#c9a961] text-[#0b3d2e]"><HomeIcon /></span>
            <span className="font-serif text-xl font-bold tracking-tight sm:text-2xl">Homy<span className="text-[#c9a961]">.</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-white/75 md:flex">
            <a href="/buy" className="transition hover:text-[#c9a961]">{t('sale')}</a><a href="/rent" className="transition hover:text-[#c9a961]">{t('rent')}</a><a href="#categories" className="transition hover:text-[#c9a961]">{t('explore')}</a><a href="/message" className="transition hover:text-[#c9a961]">{t('messages')}</a>
          </nav>
          <div className="flex items-center gap-3"><a href={profileRole ? (profileRole === 'agent' ? '/dashboard/agent' : profileRole === 'property_owner' ? '/dashboard/property-owner' : profileRole === 'admin' ? '/dashboard/admin' : profileRole === 'super_admin' ? '/dashboard/super-admin' : '/dashboard/user') : '/auth/login'} className="rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-white/10">{profileRole ? t('dashboard') : t('signIn')}</a></div>
        </div>
      </header>

      <section id="top" className="relative min-h-[590px] bg-[#0b3d2e] pt-24 text-white sm:min-h-[650px] sm:pt-32">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,61,46,.96)_0%,rgba(11,61,46,.8)_42%,rgba(11,61,46,.16)_100%),url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=90')] bg-cover bg-center" />
        <div className="relative mx-auto max-w-[1280px] px-4 pb-32 sm:px-5 sm:pb-40 lg:px-8"><div className="max-w-2xl pt-8 sm:pt-14 lg:pt-20"><div className="mb-6 flex items-center gap-2 text-sm font-medium uppercase tracking-[.18em] text-[#c9a961]"><Sparkles data-icon="inline-start" /> {t('aiPropertySearch')}</div><h1 className="font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">{t('findPlace')}</h1><p className="mt-7 max-w-lg text-lg leading-8 text-white/75">{t('heroDescription')}</p></div></div>
        <div className="absolute inset-x-0 bottom-[-112px] z-10 mx-auto max-w-[1180px] px-4 sm:bottom-[-70px] sm:px-5 lg:px-8"><div className="rounded-2xl bg-white p-2 sm:p-3 text-[#1c1c1c] shadow-2xl shadow-[#061f18]/30"><div className="flex flex-wrap items-center gap-1 border-b border-[#e8dfd3] px-2 pb-2 sm:flex-nowrap"><div className="flex gap-1">{[t('sale'),t('rent'),t('listProperty')].map((item) => <button key={item} onClick={() => setMode(item)} className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${mode === item ? 'bg-[#0b3d2e] text-white' : 'text-[#65706c] hover:bg-[#f7f3ec]'}`}>{item}</button>)}</div><span className="ml-auto hidden text-xs text-[#65706c] sm:block">{t('tellUs')}</span></div><div className="grid gap-2 p-1.5 sm:gap-3 sm:p-2 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end"><label className="flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]">{t('location')}<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={language === 'id' ? 'Kota, area, atau alamat' : 'City, neighborhood, or address'} className="h-12 rounded-lg border border-[#e8dfd3] bg-[#fcfaf7] px-4 text-sm font-normal text-[#1c1c1c] outline-none ring-[#c9a961] placeholder:text-[#9ca39e] focus:ring-2" /></label><label className="flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]">{t('propertyType')}<select className="h-12 rounded-lg border border-[#e8dfd3] bg-[#fcfaf7] px-4 text-sm font-normal outline-none"><option>{t('anyType')}</option><option>{t('house')}</option><option>{t('apartment')}</option><option>{t('villa')}</option></select></label><label className="flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]">{t('budget')}<select className="h-12 rounded-lg border border-[#e8dfd3] bg-[#fcfaf7] px-4 text-sm font-normal outline-none"><option>{t('anyBudget')}</option><option>Di bawah Rp 1 M</option><option>Rp 1 M — Rp 3 M</option><option>Di atas Rp 3 M</option></select></label><Button className="h-12 rounded-lg bg-[#c9a961] px-6 text-[#0b3d2e] hover:bg-[#b7964f]" onClick={() => window.location.assign(`/buy${location ? `?city=${encodeURIComponent(location)}` : ''}`)}><Search data-icon="inline-start" /> Cari</Button></div></div></div>
      </section>

      <section id="properties" className="mx-auto max-w-[1280px] px-4 pb-14 pt-48 sm:px-5 sm:pb-20 sm:pt-36 lg:px-8"><div className="mb-8 flex items-end justify-between"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">{t('curatedForYou')}</p><h2 className="font-serif text-4xl text-[#0b3d2e] sm:text-5xl">{t('propertiesYouLove')}</h2><p className="mt-3 text-[#65706c]">{t('personalizedPicks')}</p></div><div className="hidden gap-2 sm:flex"><Button variant="outline" size="icon" className="rounded-full border-[#d8ccbb]" onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}><ChevronLeft /></Button><Button variant="outline" size="icon" className="rounded-full border-[#d8ccbb]" onClick={() => setActiveSlide(Math.min(Math.max(cards.length - 1, 0), activeSlide + 1))}><ChevronRight /></Button></div></div><div className="grid gap-6 md:grid-cols-3">{cards.map((property, index) => <article key={property.id} className={`group overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(20,42,32,.14)] ${index < activeSlide ? 'hidden md:block' : ''}`}><div className="relative aspect-[1.3] overflow-hidden"><img src={property.image} alt={property.title} className="size-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute left-4 top-4 rounded-full bg-[#0b3d2e] px-3 py-1.5 text-xs font-semibold text-[#f6e2a8]">{property.tag}</div><button aria-label={`Save ${property.title}`} onClick={() => toggleFavorite(property.id)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/90 text-[#0b3d2e] transition hover:bg-white"> <Heart className={favorites.includes(property.id) ? 'fill-[#a3282c] text-[#a3282c]' : ''} /></button></div><div className="p-4 sm:p-5"><h3 className="font-serif text-lg sm:text-xl text-[#0b3d2e]">{property.title}</h3><p className="mt-1 flex items-center gap-1 text-sm text-[#65706c]"><MapPin data-icon="inline-start" />{property.location}</p><p className="mt-4 text-lg font-bold text-[#0b3d2e]">{property.price}</p><p className="mt-1 text-xs text-[#8a928e]">{property.meta}</p></div></article>)}</div></section>

      <section id="categories" className="border-y border-[#e8dfd3] bg-[#fbf8f3] py-12 sm:py-16"><div className="mx-auto max-w-[1280px] px-5 lg:px-8"><div className="mb-8 flex items-center justify-between"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">{t('exploreByType')}</p><h2 className="font-serif text-4xl text-[#0b3d2e]">{t('whatLookingFor')}</h2></div><a href="/buy" className="hidden items-center gap-2 text-sm font-semibold text-[#0b3d2e] sm:flex">{t('viewAll')} <ArrowRight /></a></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{categories.map(({ key, icon: Icon }) => <a key={key} href={`/buy?type=${key}`} className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl p-2 text-center sm:min-h-32 sm:gap-3 border border-[#e8dfd3] bg-white transition hover:border-[#c9a961] hover:shadow-lg"><span className="grid size-10 place-items-center sm:size-12 rounded-full bg-[#edf2ed] text-[#0b3d2e] transition group-hover:bg-[#0b3d2e] group-hover:text-[#c9a961]"><Icon /></span><span className="text-xs font-semibold leading-tight text-[#33433d] sm:text-sm">{t(key)}</span></a>)}</div></div></section>

      <section className="mx-auto grid max-w-[1280px] gap-12 px-5 py-20 lg:grid-cols-[1fr_1.1fr] lg:px-8"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">{t('planConfidence')}</p><h2 className="font-serif text-4xl text-[#0b3d2e] sm:text-5xl">Ambil keputusan<br />dengan jelas.</h2><p className="mt-5 max-w-md leading-7 text-[#65706c]">Lihat perkiraan cicilan bulanan Anda dan tentukan langkah berikutnya dengan lebih yakin.</p><div className="mt-8 flex items-center gap-3 text-sm text-[#0b3d2e]"><span className="grid size-10 place-items-center rounded-full bg-[#e2eee7]"><ShieldCheck /></span>Perhitungan transparan tanpa biaya tersembunyi</div></div><div className="rounded-2xl bg-[#0f2a44] p-7 text-white shadow-xl sm:p-9"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#c9a961] text-[#0f2a44]"><Calculator /></span><div><h3 className="font-serif text-2xl">{t('kprCalculator')}</h3><p className="text-sm text-white/60">Perkirakan cicilan bulanan Anda</p></div></div><div className="mt-8 grid gap-6 sm:grid-cols-3"><label className="text-xs text-white/65">Harga properti<input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-2 w-full border-b border-white/25 bg-transparent pb-2 text-base text-white outline-none" /></label><label className="text-xs text-white/65">Uang muka<select value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} className="mt-2 w-full border-b border-white/25 bg-transparent pb-2 text-base text-white outline-none"><option className="text-[#1c1c1c]" value={20}>20%</option><option className="text-[#1c1c1c]" value={30}>30%</option><option className="text-[#1c1c1c]" value={40}>40%</option></select></label><label className="text-xs text-white/65">Tenor pinjaman<select value={tenor} onChange={(e) => setTenor(Number(e.target.value))} className="mt-2 w-full border-b border-white/25 bg-transparent pb-2 text-base text-white outline-none"><option className="text-[#1c1c1c]" value={10}>10 tahun</option><option className="text-[#1c1c1c]" value={15}>15 tahun</option><option className="text-[#1c1c1c]" value={20}>20 tahun</option></select></label></div><div className="mt-9 flex flex-wrap items-end justify-between gap-4 border-t border-white/15 pt-6"><div><p className="text-xs text-white/60">Estimated monthly payment</p><p className="mt-1 text-3xl font-bold text-[#f6e2a8]">Rp {installment.toLocaleString('id-ID')}</p></div><Button className="rounded-full bg-[#c9a961] text-[#0f2a44] hover:bg-[#e1c67e]">Simulasi lengkap <ArrowRight data-icon="inline-end" /></Button></div></div></section>

      <section id="insights" className="bg-[#0b3d2e] py-16 text-white"><div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-8 px-5 sm:flex-row sm:items-center lg:px-8"><div><p className="mb-2 text-sm font-semibold uppercase tracking-[.18em] text-[#c9a961]">Cara lebih baik menemukan hunian</p><h2 className="font-serif text-4xl sm:text-5xl">Babak berikutnya<br />dimulai di sini.</h2></div><Button className="rounded-full bg-[#c9a961] px-6 text-[#0b3d2e] hover:bg-[#e1c67e]">Bicara dengan asisten AI <Sparkles data-icon="inline-end" /></Button></div></section>
      <footer className="bg-[#071f18] py-10 text-white/60"><div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-5 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8"><div className="flex items-center gap-2 text-white"><span className="grid size-8 place-items-center rounded-lg bg-[#c9a961] text-[#0b3d2e]"><HomeIcon /></span><span className="font-serif text-xl">Homy<span className="text-[#c9a961]">.</span></span></div><p>© 2025 Homy Property. Temukan tempat terbaik untuk Anda.</p><div className="flex gap-5"><a href="#top" className="hover:text-white">Privasi</a><a href="#top" className="hover:text-white">Ketentuan</a><a href="#top" className="hover:text-white">Kontak</a></div></div></footer>
    </main>
  )
}
