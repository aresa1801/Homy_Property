'use client'

import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { useState } from 'react'
import Link from 'next/link'
import { Bot, Calculator, Home, Search, Sparkles } from 'lucide-react'
import { AiChat } from '@/components/ai/ai-chat'
import { CuratePanel } from '@/components/ai/curate-panel'

export default function AiAssistantPage() {
  const [tab, setTab] = useState<'tanya' | 'rekomendasi'>('tanya')
  const [filters, setFilters] = useState({ listing_type: '', city: '', district: '', property_type: '' })

  const input = 'w-full rounded-lg border border-[#d8ccbb] bg-white px-3 py-2 text-sm text-[#20332c] outline-none focus:border-[#0b3d2e]'

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1c1c1c]">
      <SiteHeader />

      <section className="mx-auto w-full max-w-[1400px] px-6 py-10">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#a18a61]">Asisten AI</p>
          <h1 className="mt-1 font-serif text-4xl text-[#0b3d2e]">Homy AI — tanya apa saja soal properti</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#718078]">
            Homy AI membaca langsung database listing Homy Property: harga, luas, kamar, fasilitas, dan statistik harga per daerah.
            Pakai untuk membandingkan properti, cek kewajaran harga, atau minta rekomendasi sesuai budget. Untuk mitra agen &amp; pemilik,
            ada juga saran harga otomatis di dashboard.
          </p>
        </div>

        <div className="mb-6 inline-flex rounded-full border border-[#e5dccd] bg-white p-1">
          <button type="button" onClick={() => setTab('tanya')} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === 'tanya' ? 'bg-[#0b3d2e] text-white' : 'text-[#33433d]'}`}>
            <Bot className="size-4" /> Tanya jawab
          </button>
          <button type="button" onClick={() => setTab('rekomendasi')} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === 'rekomendasi' ? 'bg-[#0b3d2e] text-white' : 'text-[#33433d]'}`}>
            <Calculator className="size-4" /> Rekomendasi properti
          </button>
        </div>

        {tab === 'tanya' ? (
          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-2xl border border-[#e5dccd] bg-white p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]">
              <AiChat
                filters={filters}
                suggestions={[
                  'Bagaimana cara memasang listing di Homy?',
                  'Apa itu CarbonFi marketplace properti Homy?',
                  'Saya cari rumah di Sleman, apa saja yang tersedia?',
                  'Harga per meter persegi wajar di Bandung berapa?',
                ]}
                placeholder="Contoh: cari rumah 3 kamar di Sleman budget 1,5 M"
              />
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e5dccd] bg-white p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><Search className="size-4" /> Fokus pencarian AI (opsional)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Tujuan</span>
                    <select value={filters.listing_type} onChange={(event) => setFilters({ ...filters, listing_type: event.target.value })} className={input}>
                      <option value="">Semua</option>
                      <option value="sale">Beli</option>
                      <option value="rent">Sewa</option>
                    </select>
                  </label>
                  <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Kota</span>
                    <input value={filters.city} onChange={(event) => setFilters({ ...filters, city: event.target.value })} placeholder="Bandung" className={input} />
                  </label>
                  <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Kecamatan</span>
                    <input value={filters.district} onChange={(event) => setFilters({ ...filters, district: event.target.value })} placeholder="Dago" className={input} />
                  </label>
                  <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Tipe</span>
                    <select value={filters.property_type} onChange={(event) => setFilters({ ...filters, property_type: event.target.value })} className={input}>
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
                </div>
                <p className="mt-3 text-xs text-[#718078]">Filter ini membatasi listing yang dibaca AI supaya jawabannya sesuai kebutuhan Anda.</p>
              </div>

              <div className="rounded-2xl border border-[#e5dccd] bg-[#0b3d2e] p-5 text-white">
                <p className="flex items-center gap-2 text-sm font-semibold"><Home className="size-4 text-[#c9a961]" /> Untuk agen &amp; pemilik properti</p>
                <p className="mt-2 text-sm text-white/75">Dashboard Anda punya panel <strong>Saran Harga AI</strong>: masukkan spesifikasi, AI menghitung harga wajar dari data harga rata-rata kecamatan/kota Anda.</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Link href="/dashboard/agent/ai" className="rounded-full bg-[#c9a961] px-4 py-1.5 font-semibold text-[#0b3d2e]">Dashboard Agen</Link>
                  <Link href="/dashboard/property-owner/ai" className="rounded-full border border-white/25 px-4 py-1.5 font-semibold text-white">Dashboard Pemilik</Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <CuratePanel />
        )}
      </section>
          <SiteFooter />
    </main>
  )
}
