'use client'

import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { RecommendationCarousel } from '@/components/recommendation-carousel'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowRight,
  BedDouble,
  Building2,
  Calculator,
  Home as HomeIcon,
  Search,
  ShieldCheck,
  Sparkles,
  Waves,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  const [price, setPrice] = useState(1500000000)
  const [downPayment, setDownPayment] = useState(20)
  const [tenor, setTenor] = useState(15)
  const [profileRole, setProfileRole] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await createClient().from('profiles').select('role').eq('id', data.user.id).maybeSingle()
      setProfileRole(profile?.role ?? 'user')
    })
  }, [])

  /** Simpan kota yang dicari agar carousel rekomendasi di beranda ikut menyesuaikan lokasi. */
  const goSearch = (target: string) => {
    const city = location.trim()
    if (city) { try { window.localStorage.setItem('homy.city', city) } catch { /* abaikan */ } }
    window.location.assign(target + (city ? '?city=' + encodeURIComponent(city) : ''))
  }

  const installment = useMemo(() => {
    const principal = price * (1 - downPayment / 100)
    const monthlyRate = 0.085 / 12
    const months = tenor * 12
    return Math.round((principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1))
  }, [price, downPayment, tenor])

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f3ec] text-[#1c1c1c]">
            <SiteHeader cta={profileRole ? { label: t('dashboard'), href: profileRole === 'agent' ? '/dashboard/agent' : profileRole === 'property_owner' ? '/dashboard/property-owner' : profileRole === 'admin' ? '/dashboard/admin' : profileRole === 'super_admin' ? '/dashboard/super-admin' : '/dashboard/user' } : undefined} />

      <section id="top" className="relative min-h-[590px] bg-[#0b3d2e] pt-24 text-white sm:min-h-[650px] sm:pt-32">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,61,46,.96)_0%,rgba(11,61,46,.8)_42%,rgba(11,61,46,.16)_100%),url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=90')] bg-cover bg-center" />
        <div className="relative mx-auto max-w-[1280px] px-4 pb-32 sm:px-5 sm:pb-40 lg:px-8"><div className="max-w-2xl pt-8 sm:pt-14 lg:pt-20"><div className="mb-6 flex items-center gap-2 text-sm font-medium uppercase tracking-[.18em] text-[#c9a961]"><Sparkles data-icon="inline-start" /> {t('aiPropertySearch')}</div><h1 className="font-serif text-2xl sm:text-4xl leading-[1.08] tracking-tight md:text-6xl lg:text-7xl">{t('findPlace')}</h1><p className="mt-5 sm:mt-7 max-w-lg text-base sm:text-lg leading-8 text-white/75">{t('heroDescription')}</p></div></div>
        <div className="absolute inset-x-0 bottom-[-112px] z-10 mx-auto max-w-[1180px] px-4 sm:bottom-[-70px] sm:px-5 lg:px-8"><div className="rounded-2xl bg-white p-2 sm:p-3 text-[#1c1c1c] shadow-2xl shadow-[#061f18]/30"><div className="flex flex-wrap items-center gap-1 border-b border-[#e8dfd3] px-2 pb-2 sm:flex-nowrap"><div className="flex gap-1"><button onClick={() => { setMode('Sale'); goSearch('/buy') }} className={'rounded-lg px-5 py-2.5 text-sm font-semibold transition ' + (mode === 'Sale' ? 'bg-[#0b3d2e] text-white' : 'text-[#65706c] hover:bg-[#f7f3ec]')}>{t('sale')}</button><button onClick={() => { setMode('Rent'); goSearch('/rent') }} className={'rounded-lg px-5 py-2.5 text-sm font-semibold transition ' + (mode === 'Rent' ? 'bg-[#0b3d2e] text-white' : 'text-[#65706c] hover:bg-[#f7f3ec]')}>{t('rent')}</button></div><span className="ml-auto hidden text-xs text-[#65706c] sm:block">{t('tellUs')}</span></div><div className="grid gap-2 p-1.5 sm:gap-3 sm:p-2 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end"><label className="flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]">{t('location')}<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={language === 'id' ? 'Kota, area, atau alamat' : 'City, neighborhood, or address'} className="h-12 rounded-lg border border-[#e8dfd3] bg-[#fcfaf7] px-4 text-sm font-normal text-[#1c1c1c] outline-none ring-[#c9a961] placeholder:text-[#9ca39e] focus:ring-2" /></label><label className="flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]">{t('propertyType')}<select className="h-12 rounded-lg border border-[#e8dfd3] bg-[#fcfaf7] px-4 text-sm font-normal outline-none"><option>{t('anyType')}</option><option>{t('house')}</option><option>{t('apartment')}</option><option>{t('villa')}</option></select></label><label className="flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]">{t('budget')}<select className="h-12 rounded-lg border border-[#e8dfd3] bg-[#fcfaf7] px-4 text-sm font-normal outline-none"><option>{t('anyBudget')}</option><option>Di bawah Rp 1 M</option><option>Rp 1 M — Rp 3 M</option><option>Di atas Rp 3 M</option></select></label><Button className="h-12 rounded-lg bg-[#c9a961] px-6 text-[#0b3d2e] hover:bg-[#b7964f]" onClick={() => goSearch(mode === 'Rent' ? '/rent' : '/buy')}><Search data-icon="inline-start" /> Cari</Button></div></div></div>
      </section>

      <RecommendationCarousel />

      <section id="categories" className="border-y border-[#e8dfd3] bg-[#fbf8f3] py-8 sm:py-12 lg:py-16"><div className="mx-auto max-w-[1280px] px-5 lg:px-8"><div className="mb-5 sm:mb-8 flex items-center justify-between"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">{t('exploreByType')}</p><h2 className="font-serif text-2xl sm:text-4xl text-[#0b3d2e]">{t('whatLookingFor')}</h2></div><a href="/buy" className="hidden items-center gap-2 text-sm font-semibold text-[#0b3d2e] sm:flex">{t('viewAll')} <ArrowRight /></a></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{categories.map(({ key, icon: Icon }) => <a key={key} href={`/buy?type=${key}`} className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl p-2 text-center sm:min-h-32 sm:gap-3 border border-[#e8dfd3] bg-white transition hover:border-[#c9a961] hover:shadow-lg"><span className="grid size-10 place-items-center sm:size-12 rounded-full bg-[#edf2ed] text-[#0b3d2e] transition group-hover:bg-[#0b3d2e] group-hover:text-[#c9a961]"><Icon /></span><span className="text-xs font-semibold leading-tight text-[#33433d] sm:text-sm">{t(key)}</span></a>)}</div></div></section>

      <section className="mx-auto grid max-w-[1280px] gap-8 sm:gap-12 px-5 py-12 sm:py-20 lg:grid-cols-[1fr_1.1fr] lg:px-8"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">{t('planConfidence')}</p><h2 className="font-serif text-2xl sm:text-4xl text-[#0b3d2e] md:text-5xl">Ambil keputusan<br />dengan jelas.</h2><p className="mt-5 max-w-md leading-7 text-[#65706c]">Lihat perkiraan cicilan bulanan Anda dan tentukan langkah berikutnya dengan lebih yakin.</p><div className="mt-8 flex items-center gap-3 text-sm text-[#0b3d2e]"><span className="grid size-10 place-items-center rounded-full bg-[#e2eee7]"><ShieldCheck /></span>Perhitungan transparan tanpa biaya tersembunyi</div></div><div className="rounded-2xl bg-[#0f2a44] p-5 text-white shadow-xl sm:p-7 lg:p-9"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#c9a961] text-[#0f2a44]"><Calculator /></span><div><h3 className="font-serif text-xl sm:text-2xl">{t('kprCalculator')}</h3><p className="text-sm text-white/60">Perkirakan cicilan bulanan Anda</p></div></div><div className="mt-8 grid gap-4 sm:gap-6 sm:grid-cols-3"><label className="text-xs text-white/65">Harga properti<input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-2 w-full border-b border-white/25 bg-transparent pb-2 text-base text-white outline-none" /></label><label className="text-xs text-white/65">Uang muka<select value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} className="mt-2 w-full border-b border-white/25 bg-transparent pb-2 text-base text-white outline-none"><option className="text-[#1c1c1c]" value={20}>20%</option><option className="text-[#1c1c1c]" value={30}>30%</option><option className="text-[#1c1c1c]" value={40}>40%</option></select></label><label className="text-xs text-white/65">Tenor pinjaman<select value={tenor} onChange={(e) => setTenor(Number(e.target.value))} className="mt-2 w-full border-b border-white/25 bg-transparent pb-2 text-base text-white outline-none"><option className="text-[#1c1c1c]" value={10}>10 tahun</option><option className="text-[#1c1c1c]" value={15}>15 tahun</option><option className="text-[#1c1c1c]" value={20}>20 tahun</option></select></label></div><div className="mt-9 flex flex-wrap items-end justify-between gap-4 border-t border-white/15 pt-6"><div><p className="text-xs text-white/60">Estimated monthly payment</p><p className="mt-1 text-2xl sm:text-3xl font-bold text-[#f6e2a8]">Rp {installment.toLocaleString('id-ID')}</p></div><Button className="rounded-full bg-[#c9a961] text-[#0f2a44] hover:bg-[#e1c67e]">Simulasi lengkap <ArrowRight data-icon="inline-end" /></Button></div></div></section>

      <section id="insights" className="bg-[#0b3d2e] py-10 sm:py-16 text-white"><div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-5 sm:gap-8 px-5 sm:flex-row sm:items-center lg:px-8"><div><p className="mb-2 text-sm font-semibold uppercase tracking-[.18em] text-[#c9a961]">Cara lebih baik menemukan hunian</p><h2 className="font-serif text-2xl sm:text-4xl lg:text-5xl">Babak berikutnya<br />dimulai di sini.</h2></div><Button className="rounded-full bg-[#c9a961] px-6 text-[#0b3d2e] hover:bg-[#e1c67e]">Bicara dengan asisten AI <Sparkles data-icon="inline-end" /></Button></div></section>
      <SiteFooter />
    </main>
  )
}
