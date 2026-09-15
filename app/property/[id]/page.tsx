'use client'

import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, BedDouble, Bath, Check, Heart, Home, MapPin, Ruler, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AiChat } from '@/components/ai/ai-chat'
import { createClient } from '@/lib/supabase/client'
import {
  FURNISHED_LABEL,
  PROPERTY_TYPE_LABEL,
  formatPriceWithPeriod,
  propertyLocation,
  type PropertyRecord,
} from '@/lib/property-format'

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [property, setProperty] = useState<PropertyRecord | null>(null)
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('properties')
      .select('id,title,description,listing_type,status,property_type,province,postal_code,negotiable,certificate,year_built,floors,carports,electricity_va,water_source,property_condition,amenities,nearby,min_lease_months,rent_payment_terms,occupancy_status,extra_notes,ai_summary,ai_facts,city,district,address,price,price_period,bedrooms,bathrooms,land_area,building_area,furnished,utilities_included,available_from,created_at,property_media(storage_path,media_type,sort_order)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data) { setNotFound(true); setLoading(false); return }
        const record = data as PropertyRecord
        setProperty(record)
        const urls = (record.property_media ?? [])
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((m) => {
            if (/^https?:\/\//i.test(m.storage_path)) return m.storage_path
            if (!supabaseUrl) return ''
            return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/property-media/${m.storage_path.replace(/^\//, '')}`
          })
          .filter(Boolean)
        setMediaUrls(urls)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, supabaseUrl])

  async function sendInquiry() {
    if (!id) return
    setSending(true)
    setStatus(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.assign(`/auth/login?next=/property/${id}`); return }
    const trimmed = message.trim()
    if (!trimmed) { setStatus('Tulis pesan terlebih dahulu.'); setSending(false); return }
    const { error } = await supabase.from('inquiries').insert({ property_id: id, user_id: user.id, message: trimmed, status: 'open' })
    setSending(false)
    if (error) { setStatus('Gagal mengirim pertanyaan. Coba lagi.'); return }
    setMessage('')
    setStatus('Pertanyaan terkirim ke pemilik/agen.')
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f7f3ec] text-[#0b3d2e]">Memuat properti...</main>
  if (notFound || !property) return <main className="grid min-h-screen place-items-center bg-[#f7f3ec] px-5 text-center text-[#0b3d2e]"><div><h1 className="font-serif text-4xl">Properti tidak ditemukan</h1><a href="/buy" className="mt-6 inline-block rounded-full bg-[#0b3d2e] px-6 py-3 text-white">Kembali ke marketplace</a></div></main>

  const hero = mediaUrls[0]

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1c1c1c]">
      <SiteHeader />

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.07)]">
              {hero ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero} alt={property.title} className="aspect-[1.4] w-full object-cover" />
              ) : (
                <div className="grid aspect-[1.4] place-items-center bg-[#edf2ed] text-[#0b3d2e]">Belum ada foto</div>
              )}
            </div>
            {mediaUrls.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
                {mediaUrls.slice(0, 6).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt={property.title} className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            )}

            <div className="mt-8">
              <span className="inline-block rounded-full bg-[#edf2ed] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#0b3d2e]">{property.listing_type === 'rent' ? 'Disewakan' : 'Dijual'}</span>
              <h1 className="mt-4 font-serif text-4xl text-[#0b3d2e] sm:text-5xl">{property.title}</h1>
              <p className="mt-3 flex items-center gap-2 text-[#65706c]"><MapPin className="size-4" /> {propertyLocation(property)}{property.address ? ` · ${property.address}` : ''}</p>
              <p className="mt-6 text-3xl font-bold text-[#0b3d2e]">{formatPriceWithPeriod(property.price, property.price_period)}</p>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {property.bedrooms ? <div className="rounded-xl bg-white p-4"><BedDouble className="text-[#c09b54]" /><p className="mt-2 text-sm text-[#65706c]">Kamar tidur</p><p className="font-semibold text-[#0b3d2e]">{property.bedrooms}</p></div> : null}
                {property.bathrooms ? <div className="rounded-xl bg-white p-4"><Bath className="text-[#c09b54]" /><p className="mt-2 text-sm text-[#65706c]">Kamar mandi</p><p className="font-semibold text-[#0b3d2e]">{property.bathrooms}</p></div> : null}
                {property.building_area ? <div className="rounded-xl bg-white p-4"><Ruler className="text-[#c09b54]" /><p className="mt-2 text-sm text-[#65706c]">Luas bangunan</p><p className="font-semibold text-[#0b3d2e]">{property.building_area} m²</p></div> : null}
                {property.property_type ? <div className="rounded-xl bg-white p-4"><Home className="text-[#c09b54]" /><p className="mt-2 text-sm text-[#65706c]">Tipe</p><p className="font-semibold text-[#0b3d2e]">{PROPERTY_TYPE_LABEL[property.property_type] ?? property.property_type}</p></div> : null}
              </div>

              {property.description && (
                <div className="mt-8 rounded-2xl bg-white p-6">
                  <h2 className="font-serif text-2xl text-[#0b3d2e]">Deskripsi</h2>
                  <p className="mt-3 whitespace-pre-line leading-7 text-[#65706c]">{property.description}</p>
                </div>
              )}

              {property.furnished && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#edf2ed] px-4 py-2 text-sm text-[#0b3d2e]"><Check className="size-4" /> {FURNISHED_LABEL[property.furnished] ?? property.furnished}</p>
              )}
            </div>
          </div>

          <aside className="h-fit space-y-4 lg:sticky lg:top-6">
            <div className="rounded-2xl bg-white p-6 shadow-[0_10px_35px_rgba(20,42,32,.07)]">
              <h2 className="font-serif text-2xl text-[#0b3d2e]">Tanya pemilik</h2>
              <p className="mt-2 text-sm text-[#65706c]">Kirim pertanyaan tentang properti ini. Pemilik atau agen akan menghubungi Anda.</p>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-4 w-full rounded-lg border border-[#e8dfd3] p-3 text-sm outline-none focus:border-[#0b3d2e]" placeholder="Halo, apakah properti ini masih tersedia?" />
              <Button disabled={sending} onClick={() => { void sendInquiry() }} className="mt-3 w-full rounded-lg bg-[#0b3d2e] text-white hover:bg-[#14533f]">{sending ? 'Mengirim...' : 'Kirim pertanyaan'} <Send data-icon="inline-end" /></Button>
              {status && <p role="status" className="mt-3 rounded-lg bg-[#e2eee7] p-3 text-sm text-[#0b3d2e]">{status}</p>}
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-[0_10px_35px_rgba(20,42,32,.07)]">
              <AiChat
                compact
                propertyId={id}
                intro="Dijawab dari data properti ini + pembanding area"
                placeholder="Contoh: apakah harga ini wajar untuk area sini?"
                suggestions={['Apakah harga ini wajar untuk area ini?', 'Apa saja fasilitas dan keunggulan properti ini?', 'Bagaimana perbandingannya dengan properti sejenis di sekitar?']}
              />
            </div>
            <div className="rounded-2xl bg-[#0f2a44] p-6 text-white">
              <div className="flex items-center gap-2"><Sparkles className="text-[#c9a961]" /><p className="font-semibold">Insight Homy</p></div>
              <p className="mt-3 text-sm leading-6 text-white/80">Properti ini {property.status === 'published' ? 'sudah terverifikasi dan tayang' : 'sedang dalam proses moderasi'} di Homy.</p>
            </div>
          </aside>
        </div>
      </section>
          <SiteFooter />
    </main>
  )
}
