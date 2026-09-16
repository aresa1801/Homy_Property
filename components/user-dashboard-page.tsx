'use client'

import useSWR from 'swr'
import { Image as ImageIcon, MapPin } from 'lucide-react'
import { DashboardShell, SectionCard } from '@/components/dashboard-shell'
import { FavoriteButton } from '@/components/favorite-button'
import { firstMediaUrl, formatPriceWithPeriod, propertyLocation } from '@/lib/property-format'

const fetcher = (url: string) => fetch(url).then((response) => {
  if (!response.ok) throw new Error('Gagal memuat data')
  return response.json()
})

const VISIT_STATUS: Record<string, string> = {
  requested: 'Menunggu konfirmasi',
  confirmed: 'Terkonfirmasi',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

function visitDate(value: unknown) {
  const text = String(value ?? '')
  if (!text) return 'Jadwal menyusul'
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return date.toLocaleString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'
}

type PageType = 'favorites' | 'inquiries' | 'visits' | 'apply'

/** Link Google Maps dari koordinat titik temu (tanpa perlu import server lib). */
function mapUrl(lat: string, lng: string) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln) || (!la && !ln)) return null
  return `https://www.google.com/maps?q=${la},${ln}&z=16`
}

const copy = {
  favorites: { title: 'Favorit', intro: 'Kumpulan properti yang Anda simpan untuk dipertimbangkan kembali.', key: 'favorites', empty: 'Belum ada properti favorit.' },
  inquiries: { title: 'Pertanyaan dan Pesan', intro: 'Pantau komunikasi Anda dengan agen dan pemilik properti.', key: 'inquiries', empty: 'Belum ada pertanyaan atau pesan.' },
  visits: { title: 'Jadwal Kunjungan', intro: 'Pantau jadwal kunjungan properti Anda, hasil kunjungan, dan langkah lanjutan setelahnya.', key: 'visits', empty: 'Belum ada jadwal kunjungan.' },
  apply: { title: 'Daftar sebagai Agen dan Pemilik', intro: 'Ajukan akses untuk mengelola listing atau membantu klien menemukan hunian.', key: 'applications', empty: 'Pilih peran yang ingin Anda ajukan.' },
} as const

export function UserDashboardPage({ type }: { type: PageType }) {
  const { data, error, isLoading, mutate } = useSWR('/api/dashboard/user', fetcher)
  const current = copy[type]
  const rows = data?.[current.key] ?? []
  return <DashboardShell role="User"><div className="mb-5 sm:mb-8"><p className="text-sm font-semibold uppercase tracking-[.16em] text-[#a18a61]">Dasbor Pengguna</p><h2 className="mt-2 font-serif text-2xl sm:text-4xl text-[#0b3d2e]">{current.title}</h2><p className="mt-3 max-w-2xl text-[#718078]">{current.intro}</p></div><SectionCard title={current.title}><div className="space-y-3">{isLoading ? <p className="text-sm text-[#718078]">Memuat data...</p> : error ? <p role="alert" className="text-sm text-red-700">Data belum dapat dimuat. Silakan coba lagi.</p> : type === 'apply' ? <div className="grid gap-4 md:grid-cols-2"><a href="/onboarding?role=agent" className="group rounded-2xl border border-[#e5dccd] p-4 sm:p-5 transition hover:-translate-y-0.5 hover:border-[#c9a961] hover:bg-[#f7f3ec]"><h3 className="font-semibold text-[#0b3d2e]">Menjadi Agen Properti</h3><p className="mt-2 text-sm text-[#718078]">Buka formulir pendaftaran agen, lengkapi data Anda, lalu akses dasbor agen setelah tersimpan.</p><span className="mt-4 inline-block text-sm font-semibold text-[#9a783c]">Isi formulir agen →</span></a><a href="/onboarding?role=property_owner" className="group rounded-2xl border border-[#e5dccd] p-4 sm:p-5 transition hover:-translate-y-0.5 hover:border-[#c9a961] hover:bg-[#f7f3ec]"><h3 className="font-semibold text-[#0b3d2e]">Menjadi Pemilik Properti</h3><p className="mt-2 text-sm text-[#718078]">Buka formulir pendaftaran pemilik, kirim data properti Anda, lalu akses dasbor pemilik.</p><span className="mt-4 inline-block text-sm font-semibold text-[#9a783c]">Isi formulir pemilik →</span></a></div> : rows.length ? rows.map((row: Record<string, unknown>, index: number) => {
    if (type === 'favorites') {
      const property = (row.property ?? null) as Record<string, unknown> | null
      const id = String(row.property_id ?? property?.id ?? '')
      const title = String(property?.title ?? 'Properti')
      const image = property ? firstMediaUrl(property as unknown as { property_media?: never[] }, process.env.NEXT_PUBLIC_SUPABASE_URL) : null
      const status = String(property?.status ?? '')
      return (
        <div key={id || index} className="flex gap-3 rounded-xl border border-[#eee5d8] bg-white p-3">
          <a href={`/property/${id}`} className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-[#f2f0ea] sm:size-24">
            {image
              ? <img src={image} alt={title} className="size-full object-cover" />
              : <span className="grid size-full place-items-center text-[#a18a61]"><ImageIcon className="size-5" /></span>}
          </a>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#0b3d2e]">{title}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[#718078]"><MapPin className="size-3.5 shrink-0" />{property ? propertyLocation(property as never) : 'Lokasi menyusul'}</p>
            <p className="mt-1 text-sm font-bold text-[#0b3d2e]">{property ? formatPriceWithPeriod(Number(property.price ?? 0), (property.price_period ?? null) as string | null) : '-'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a href={`/property/${id}`} className="text-xs font-semibold text-[#0b3d2e] underline">Lihat detail</a>
              <FavoriteButton propertyId={id} propertyTitle={title} variant="plain" onChange={() => { void mutate() }} />
            </div>
            {status && status !== 'published' && <p className="mt-1 text-xs text-[#a18a61]">Status listing: {status === 'draft' ? 'draf' : status === 'pending' ? 'menunggu moderasi' : status}</p>}
          </div>
        </div>
      )
    }
    if (type === 'visits') {
      const interest = String(row.interest ?? 'pending')
      const status = String(row.status ?? '')
      const unlocked = status === 'confirmed' || status === 'completed'
      const meetingPoint = unlocked ? (row.meeting_point ? String(row.meeting_point) : null) : null
      const mapHref = unlocked
        ? (mapUrl(String(row.meeting_point_lat ?? ''), String(row.meeting_point_lng ?? '')) || (row.map_url ? String(row.map_url) : null))
        : null
      const followUp = interest === 'interested'
        ? 'Pemilik/agen mencatat Anda tertarik. Cek notifikasi & email Anda untuk langkah selanjutnya (konfirmasi minat, dokumen, negosiasi harga, lalu akad).'
        : interest === 'not_interested'
          ? 'Kunjungan selesai. Kami sudah mengirim rekomendasi properti lain yang mirip ke notifikasi & email Anda.'
          : null
      return (
        <div key={String(row.id ?? index)} className="rounded-xl border border-[#eee5d8] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-[#0b3d2e]">{visitDate(row.scheduled_at)}</p>
            <span className="rounded-full bg-[#f2f0ea] px-2.5 py-1 text-xs font-semibold text-[#718078]">{VISIT_STATUS[String(row.status ?? 'requested')] ?? String(row.status ?? 'Dijadwalkan')}</span>
          </div>
          {row.notes ? <p className="mt-2 text-sm text-[#718078]">{String(row.notes)}</p> : null}
          {meetingPoint ? (
            <div className="mt-3 rounded-lg border border-[#e5dccd] bg-[#f7f3ec] p-3">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#a18a61]">Titik temu kunjungan</p>
              <p className="mt-1 text-sm text-[#33433d]">{meetingPoint}</p>
              {mapHref ? <a href={mapHref} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-[#0b3d2e] underline">Buka di Google Maps</a> : null}
              <p className="mt-2 text-xs leading-5 text-[#718078]">Detail lokasi ini dikirim agen/pemilik setelah jadwal Anda dikonfirmasi. Mohon tidak dibagikan ke pihak lain.</p>
            </div>
          ) : null}
          {followUp && (
            <p className={`mt-2 rounded-lg px-3 py-2 text-sm leading-6 ${interest === 'interested' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fff7e3] text-[#5b4a1f]'}`}>
              {followUp}
              {row.buyer_feedback ? ` Catatan kunjungan: ${String(row.buyer_feedback)}` : ''}
            </p>
          )}
        </div>
      )
    }
    return <div key={String(row.id ?? row.property_id ?? index)} className="rounded-xl border border-[#eee5d8] p-4"><p className="font-semibold text-[#0b3d2e]">{String(row.message ?? row.status ?? 'Properti tersimpan')}</p><p className="mt-1 text-sm text-[#718078]">{String(row.scheduled_at ?? row.created_at ?? 'Detail tersedia di database')}</p></div>
  }) : <p className="text-sm text-[#718078]">{current.empty}</p>}</div></SectionCard></DashboardShell>
}
