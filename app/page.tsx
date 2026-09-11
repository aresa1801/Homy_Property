'use client'

import { useMemo, useState } from 'react'
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

const properties = [
  { id: 1, title: 'Modern Tropical Villa', location: 'Canggu, Bali', price: 'Rp 4.850.000.000', meta: '4 Kamar  •  3 Kamar Mandi  •  280 m²', image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1100&q=85', tag: 'AI Pick' },
  { id: 2, title: 'Skyline Apartment', location: 'SCBD, Jakarta Selatan', price: 'Rp 3.200.000.000', meta: '2 Kamar  •  2 Kamar Mandi  •  95 m²', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1100&q=85', tag: 'Featured' },
  { id: 3, title: 'The Green Residence', location: 'Dago, Bandung', price: 'Rp 2.750.000.000', meta: '3 Kamar  •  2 Kamar Mandi  •  180 m²', image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1100&q=85', tag: 'AI Pick' },
]

const categories = [
  { label: 'Rumah', icon: HomeIcon },
  { label: 'Apartemen', icon: Building2 },
  { label: 'Tanah', icon: Waves },
  { label: 'Ruko', icon: Building2 },
  { label: 'Villa', icon: HomeIcon },
  { label: 'Kost', icon: BedDouble },
]

export default function Home() {
  const [mode, setMode] = useState('Buy')
  const [location, setLocation] = useState('')
  const [favorites, setFavorites] = useState<number[]>([])
  const [price, setPrice] = useState(1500000000)
  const [downPayment, setDownPayment] = useState(20)
  const [tenor, setTenor] = useState(15)
  const [activeSlide, setActiveSlide] = useState(0)

  const installment = useMemo(() => {
    const principal = price * (1 - downPayment / 100)
    const monthlyRate = 0.085 / 12
    const months = tenor * 12
    return Math.round((principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1))
  }, [price, downPayment, tenor])

  const toggleFavorite = (id: number) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f3ec] text-[#1c1c1c]">
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/15 bg-[#0b3d2e]/90 text-white backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-5 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Homy Property home">
            <span className="grid size-10 place-items-center rounded-xl bg-[#c9a961] text-[#0b3d2e]"><HomeIcon /></span>
            <span className="font-serif text-2xl font-bold tracking-tight">Homy<span className="text-[#c9a961]">.</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-white/75 md:flex">
            <a href="/buy" className="transition hover:text-[#c9a961]">Buy</a><a href="/rent" className="transition hover:text-[#c9a961]">Rent</a><a href="#categories" className="transition hover:text-[#c9a961]">Explore</a><a href="/message" className="transition hover:text-[#c9a961]">Messages</a>
          </nav>
          <div className="flex items-center gap-3"><Button variant="ghost" className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex">Sign in</Button><Button className="rounded-full bg-[#c9a961] px-5 text-[#0b3d2e] hover:bg-[#e1c67e]">List Property <ArrowRight data-icon="inline-end" /></Button></div>
        </div>
      </header>

      <section id="top" className="relative min-h-[650px] bg-[#0b3d2e] pt-32 text-white">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,61,46,.96)_0%,rgba(11,61,46,.8)_42%,rgba(11,61,46,.16)_100%),url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=90')] bg-cover bg-center" />
        <div className="relative mx-auto max-w-[1280px] px-5 pb-40 lg:px-8"><div className="max-w-2xl pt-14 lg:pt-20"><div className="mb-6 flex items-center gap-2 text-sm font-medium uppercase tracking-[.18em] text-[#c9a961]"><Sparkles data-icon="inline-start" /> AI-powered property search</div><h1 className="font-serif text-5xl leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">Find a place<br /><span className="text-[#c9a961]">to call home.</span></h1><p className="mt-7 max-w-lg text-lg leading-8 text-white/75">Discover exceptional properties, thoughtfully curated for the way you want to live.</p></div></div>
        <div className="absolute inset-x-0 bottom-[-70px] z-10 mx-auto max-w-[1180px] px-5 lg:px-8"><div className="rounded-2xl bg-white p-3 text-[#1c1c1c] shadow-2xl shadow-[#061f18]/30"><div className="flex flex-wrap items-center gap-1 border-b border-[#e8dfd3] px-2 pb-2 sm:flex-nowrap"><div className="flex gap-1">{['Buy','Rent','List'].map((item) => <button key={item} onClick={() => setMode(item)} className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${mode === item ? 'bg-[#0b3d2e] text-white' : 'text-[#65706c] hover:bg-[#f7f3ec]'}`}>{item}</button>)}</div><span className="ml-auto hidden text-xs text-[#65706c] sm:block">Tell us what you are looking for</span></div><div className="grid gap-3 p-2 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end"><label className="flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]">Location<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, neighborhood, or address" className="h-12 rounded-lg border border-[#e8dfd3] bg-[#fcfaf7] px-4 text-sm font-normal text-[#1c1c1c] outline-none ring-[#c9a961] placeholder:text-[#9ca39e] focus:ring-2" /></label><label className="flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]">Property type<select className="h-12 rounded-lg border border-[#e8dfd3] bg-[#fcfaf7] px-4 text-sm font-normal outline-none"><option>Any type</option><option>House</option><option>Apartment</option><option>Villa</option></select></label><label className="flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]">Budget<select className="h-12 rounded-lg border border-[#e8dfd3] bg-[#fcfaf7] px-4 text-sm font-normal outline-none"><option>Any budget</option><option>Under Rp 1B</option><option>Rp 1B — Rp 3B</option><option>Above Rp 3B</option></select></label><Button className="h-12 rounded-lg bg-[#c9a961] px-6 text-[#0b3d2e] hover:bg-[#b7964f]" onClick={() => document.getElementById('properties')?.scrollIntoView({ behavior: 'smooth' })}><Search data-icon="inline-start" /> Search</Button></div></div></div>
      </section>

      <section id="properties" className="mx-auto max-w-[1280px] px-5 pb-20 pt-36 lg:px-8"><div className="mb-8 flex items-end justify-between"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Curated for you</p><h2 className="font-serif text-4xl text-[#0b3d2e] sm:text-5xl">Properties you may love</h2><p className="mt-3 text-[#65706c]">Personalized picks based on what you&apos;re looking for.</p></div><div className="hidden gap-2 sm:flex"><Button variant="outline" size="icon" className="rounded-full border-[#d8ccbb]" onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}><ChevronLeft /></Button><Button variant="outline" size="icon" className="rounded-full border-[#d8ccbb]" onClick={() => setActiveSlide(Math.min(properties.length - 1, activeSlide + 1))}><ChevronRight /></Button></div></div><div className="grid gap-6 md:grid-cols-3">{properties.map((property, index) => <article key={property.id} className={`group overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(20,42,32,.14)] ${index < activeSlide ? 'hidden md:block' : ''}`}><div className="relative aspect-[1.3] overflow-hidden"><img src={property.image} alt={property.title} className="size-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute left-4 top-4 rounded-full bg-[#0b3d2e] px-3 py-1.5 text-xs font-semibold text-[#f6e2a8]">{property.tag}</div><button aria-label={`Save ${property.title}`} onClick={() => toggleFavorite(property.id)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/90 text-[#0b3d2e] transition hover:bg-white"> <Heart className={favorites.includes(property.id) ? 'fill-[#a3282c] text-[#a3282c]' : ''} /></button></div><div className="p-5"><h3 className="font-serif text-xl text-[#0b3d2e]">{property.title}</h3><p className="mt-1 flex items-center gap-1 text-sm text-[#65706c]"><MapPin data-icon="inline-start" />{property.location}</p><p className="mt-4 text-lg font-bold text-[#0b3d2e]">{property.price}</p><p className="mt-1 text-xs text-[#8a928e]">{property.meta}</p></div></article>)}</div></section>

      <section id="categories" className="border-y border-[#e8dfd3] bg-[#fbf8f3] py-16"><div className="mx-auto max-w-[1280px] px-5 lg:px-8"><div className="mb-8 flex items-center justify-between"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Explore by type</p><h2 className="font-serif text-4xl text-[#0b3d2e]">What are you looking for?</h2></div><a href="#properties" className="hidden items-center gap-2 text-sm font-semibold text-[#0b3d2e] sm:flex">View all <ArrowRight /></a></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{categories.map(({ label, icon: Icon }) => <button key={label} onClick={() => document.getElementById('properties')?.scrollIntoView({ behavior: 'smooth' })} className="group flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-[#e8dfd3] bg-white transition hover:border-[#c9a961] hover:shadow-lg"><span className="grid size-12 place-items-center rounded-full bg-[#edf2ed] text-[#0b3d2e] transition group-hover:bg-[#0b3d2e] group-hover:text-[#c9a961]"><Icon /></span><span className="text-sm font-semibold text-[#33433d]">{label}</span></button>)}</div></div></section>

      <section className="mx-auto grid max-w-[1280px] gap-12 px-5 py-20 lg:grid-cols-[1fr_1.1fr] lg:px-8"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Plan with confidence</p><h2 className="font-serif text-4xl text-[#0b3d2e] sm:text-5xl">Make your move<br />with clarity.</h2><p className="mt-5 max-w-md leading-7 text-[#65706c]">See what your monthly commitment could look like and take the next step with confidence.</p><div className="mt-8 flex items-center gap-3 text-sm text-[#0b3d2e]"><span className="grid size-10 place-items-center rounded-full bg-[#e2eee7]"><ShieldCheck /></span>Transparent calculations, no hidden fees</div></div><div className="rounded-2xl bg-[#0f2a44] p-7 text-white shadow-xl sm:p-9"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#c9a961] text-[#0f2a44]"><Calculator /></span><div><h3 className="font-serif text-2xl">KPR calculator</h3><p className="text-sm text-white/60">Estimate your monthly installment</p></div></div><div className="mt-8 grid gap-6 sm:grid-cols-3"><label className="text-xs text-white/65">Property price<input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-2 w-full border-b border-white/25 bg-transparent pb-2 text-base text-white outline-none" /></label><label className="text-xs text-white/65">Down payment<select value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} className="mt-2 w-full border-b border-white/25 bg-transparent pb-2 text-base text-white outline-none"><option className="text-[#1c1c1c]" value={20}>20%</option><option className="text-[#1c1c1c]" value={30}>30%</option><option className="text-[#1c1c1c]" value={40}>40%</option></select></label><label className="text-xs text-white/65">Loan tenor<select value={tenor} onChange={(e) => setTenor(Number(e.target.value))} className="mt-2 w-full border-b border-white/25 bg-transparent pb-2 text-base text-white outline-none"><option className="text-[#1c1c1c]" value={10}>10 years</option><option className="text-[#1c1c1c]" value={15}>15 years</option><option className="text-[#1c1c1c]" value={20}>20 years</option></select></label></div><div className="mt-9 flex flex-wrap items-end justify-between gap-4 border-t border-white/15 pt-6"><div><p className="text-xs text-white/60">Estimated monthly payment</p><p className="mt-1 text-3xl font-bold text-[#f6e2a8]">Rp {installment.toLocaleString('id-ID')}</p></div><Button className="rounded-full bg-[#c9a961] text-[#0f2a44] hover:bg-[#e1c67e]">Full simulation <ArrowRight data-icon="inline-end" /></Button></div></div></section>

      <section id="insights" className="bg-[#0b3d2e] py-16 text-white"><div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-8 px-5 sm:flex-row sm:items-center lg:px-8"><div><p className="mb-2 text-sm font-semibold uppercase tracking-[.18em] text-[#c9a961]">A better way home</p><h2 className="font-serif text-4xl sm:text-5xl">Your next chapter<br />starts here.</h2></div><Button className="rounded-full bg-[#c9a961] px-6 text-[#0b3d2e] hover:bg-[#e1c67e]">Talk to our AI assistant <Sparkles data-icon="inline-end" /></Button></div></section>
      <footer className="bg-[#071f18] py-10 text-white/60"><div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-5 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8"><div className="flex items-center gap-2 text-white"><span className="grid size-8 place-items-center rounded-lg bg-[#c9a961] text-[#0b3d2e]"><HomeIcon /></span><span className="font-serif text-xl">Homy<span className="text-[#c9a961]">.</span></span></div><p>© 2025 Homy Property. Find your place in the world.</p><div className="flex gap-5"><a href="#top" className="hover:text-white">Privacy</a><a href="#top" className="hover:text-white">Terms</a><a href="#top" className="hover:text-white">Contact</a></div></div></footer>
    </main>
  )
}
