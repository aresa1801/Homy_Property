import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { BadgeCheck, Building2, ExternalLink, MapPin, MessageCircle, Phone, Scale, Search } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PROVINCES } from '@/lib/regions'
import { areaLabel, notaryLabel } from '@/lib/notary'

export const metadata: Metadata = {
  title: 'Direktori Notaris & PPAT — Homy Property',
  description:
    'Rekomendasi notaris & PPAT mitra Homy Property untuk pengurusan AJB, balik nama, dan legalitas transaksi properti. Berdasarkan kecamatan/kabupaten — opsional, tanpa biaya.',
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type AreaRow = { province: string | null; kabupaten: string | null; kecamatan: string | null }
type NotaryRow = {
  id: string
  name: string | null
  office_name: string | null
  province: string | null
  kabupaten: string | null
  kecamatan: string | null
  address: string | null
  services: string | null
  focus_areas: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  featured: boolean | null
  notary_areas?: AreaRow[] | null
}

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase()
const has = (haystack: unknown, needle: string) => needle.length >= 3 && norm(haystack).includes(needle)

async function fetchNotaries(filters: { province: string; kabupaten: string; kecamatan: string; q: string }): Promise<NotaryRow[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const { data, error } = await supabase
    .from('notaries')
    .select('id,name,office_name,province,kabupaten,kecamatan,address,services,focus_areas,phone,whatsapp,email,website,featured,notary_areas(province,kabupaten,kecamatan)')
    .eq('status', 'active')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300)
  if (error || !data) return []
  return (data as NotaryRow[]).filter((row) => {
    const areas = Array.isArray(row.notary_areas) ? row.notary_areas : []
    const values = [row.province, row.kabupaten, row.kecamatan, ...areas.flatMap((area) => [area.province, area.kabupaten, area.kecamatan])].filter(Boolean) as string[]
    if (filters.province && !values.some((value) => has(value, filters.province))) return false
    if (filters.kabupaten && !values.some((value) => has(value, filters.kabupaten))) return false
    if (filters.kecamatan && !values.some((value) => has(value, filters.kecamatan))) return false
    if (filters.q) {
      const haystack = [row.name, row.office_name, row.services, row.focus_areas, ...values].filter(Boolean).join(' ').toLowerCase()
      if (!filters.q.toLowerCase().split(/\s+/).some((token) => token.length >= 2 && haystack.includes(token))) return false
    }
    return true
  })
}

const inputClass = 'h-11 w-full rounded-lg border border-[#d8ccbb] bg-white px-3 text-sm text-[#20332c] outline-none focus:border-[#0b3d2e]'

function waLink(value?: string | null) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '')
  if (!digits) return null
  return `https://wa.me/${digits.startsWith('0') ? '62' + digits.slice(1) : digits}`
}

export default async function NotarisPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const pick = (key: string) => (Array.isArray(params[key]) ? String(params[key]?.[0] ?? '') : String(params[key] ?? '')).trim()
  const filters = { province: pick('province'), kabupaten: pick('kabupaten'), kecamatan: pick('kecamatan'), q: pick('q') }
  const notaries = await fetchNotaries(filters)
  const active = Object.values(filters).some(Boolean)

  return (
    <>
      <SiteHeader />
      <main className="bg-[#fbf9f5]">
        <section className="bg-[#0b3d2e] py-10 text-white sm:py-14">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c9a961]">Direktori legal properti</p>
            <h1 className="mt-2 font-serif text-3xl leading-tight sm:text-5xl">Notaris &amp; PPAT pendamping transaksi</h1>
            <p className="mt-4 max-w-3xl leading-7 text-white/75">
              Rekomendasi <strong>opsional</strong> dari platform Homy untuk pengurusan AJB, PPAT, balik nama, dan legalitas transaksi properti —
              dipetakan sampai level <strong>kecamatan/kabupaten</strong> agar mudah ditemukan pengguna, agen, dan pemilik properti.
              Homy tidak mewajibkan penggunaan notaris mitra.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#cari" className="inline-flex items-center gap-2 rounded-full bg-[#c9a961] px-6 py-3 text-sm font-semibold text-[#0b3d2e] transition hover:bg-[#e1c67e]"><Search className="size-4" /> Cari notaris wilayah saya</a>
              <a href="/partnership#daftar" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"><Scale className="size-4" /> Daftar sebagai notaris mitra</a>
            </div>
          </div>
        </section>

        <section id="cari" className="mx-auto max-w-7xl px-5 py-8 sm:py-12 lg:px-8">
          <form method="get" action="/notaris" className="rounded-2xl bg-white p-4 shadow-[0_10px_35px_rgba(20,42,32,.06)] sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Provinsi
                <select name="province" defaultValue={filters.province} className={inputClass}>
                  <option value="">Semua provinsi</option>
                  {PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Kabupaten / Kota
                <input name="kabupaten" defaultValue={filters.kabupaten} className={inputClass} placeholder="mis. Sleman" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Kecamatan
                <input name="kecamatan" defaultValue={filters.kecamatan} className={inputClass} placeholder="mis. Depok" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#65706c]">Kata kunci
                <input name="q" defaultValue={filters.q} className={inputClass} placeholder="nama kantor / layanan" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-5 py-2.5 text-sm font-semibold text-white"><Search className="size-4" /> Cari</button>
              {active ? <a href="/notaris" className="rounded-lg border border-[#d8ccbb] px-5 py-2.5 text-sm font-semibold text-[#33433d]">Reset</a> : null}
            </div>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">{notaries.length} notaris/PPAT mitra</h2>
            <span className="rounded-full bg-[#fff7e3] px-3 py-1 text-xs font-semibold text-[#9b762a]">Rekomendasi opsional</span>
          </div>

          {notaries.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {notaries.map((notary) => {
                const areas = Array.isArray(notary.notary_areas) ? notary.notary_areas.map((area) => areaLabel(area)).filter(Boolean) : []
                const wa = waLink(notary.whatsapp || notary.phone)
                return (
                  <article key={notary.id} className="flex flex-col rounded-2xl bg-white p-4 shadow-[0_10px_35px_rgba(20,42,32,.06)] sm:p-5">
                    <div className="flex items-center gap-2">
                      <span className="grid size-10 place-items-center rounded-xl bg-[#edf2ed] text-[#0b3d2e]"><Building2 className="size-5" /></span>
                      <div>
                        <h3 className="font-semibold leading-tight text-[#0b3d2e]">{notaryLabel(notary)}</h3>
                        {notary.featured ? <span className="text-[10px] font-bold uppercase tracking-wide text-[#9b762a]">Mitra Homy</span> : null}
                      </div>
                    </div>
                    {notary.name && notary.office_name ? <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#718078]"><BadgeCheck className="size-3.5 text-[#4e866d]" /> {notary.name}</p> : null}
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-[#718078]">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      <span>{[notary.kecamatan, notary.kabupaten, notary.province].filter(Boolean).join(', ') || areas[0] || 'Wilayah belum dicantumkan'}</span>
                    </p>
                    {areas.length > 1 ? <p className="mt-1 text-xs text-[#8a928e]">Area: {areas.slice(0, 3).join(' · ')}</p> : null}
                    {notary.services ? <p className="mt-2 text-xs leading-5 text-[#65706c]">Layanan: {notary.services}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[#f0e9df] pt-3">
                      {wa ? <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b3d2e] px-3 py-1.5 text-xs font-semibold text-white"><MessageCircle className="size-3.5" /> WhatsApp</a> : null}
                      {notary.phone ? <a href={`tel:${notary.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ccbb] px-3 py-1.5 text-xs font-semibold text-[#33433d]"><Phone className="size-3.5" /> Telepon</a> : null}
                      {notary.website ? <a href={notary.website.startsWith('http') ? notary.website : `https://${notary.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ccbb] px-3 py-1.5 text-xs font-semibold text-[#33433d]"><ExternalLink className="size-3.5" /> Profil</a> : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-white px-5 py-8 text-center text-sm text-[#65706c] shadow-[0_10px_35px_rgba(20,42,32,.06)]">
              {active ? 'Belum ada notaris mitra untuk filter tersebut. Coba perluas wilayah, atau ajukan pendampingan dari halaman properti — tim Homy akan membantu mencarikan notaris/PPAT terdekat.' : 'Direktori notaris mitra Homy sedang disiapkan. Ajukan kemitraan notaris atau minta pendampingan dari halaman properti.'}
            </p>
          )}

          <div className="mt-8 rounded-2xl border border-[#e8dfd3] bg-white p-5 text-sm leading-6 text-[#65706c] sm:p-6">
            <p className="font-semibold text-[#0b3d2e]">Bagaimana rekomendasi ini bekerja?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Notaris/PPAT di direktori ini sudah <strong>diverifikasi tim Homy</strong> (SK Kemenkumham/keanggotaan INI + wilayah kerja).</li>
              <li>Pengajuan pendampingan aktif saat pembeli sudah menyatakan <strong>minat dan siap bertransaksi</strong> (atau langsung oleh agen/pemilik properti).</li>
              <li>Homy <strong>tidak memungut biaya</strong> atas pengajuan maupun rekomendasi ini; seluruh biaya jasa legal disepakati langsung dengan notaris.</li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
