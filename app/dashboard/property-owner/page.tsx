'use client'

import { ArrowRight, CalendarDays, FileSignature, FileText, Home, Plus, Users } from 'lucide-react'
import { DashboardGreeting, DashboardShell, MetricCard } from '@/components/dashboard-shell'
import { STAGE_LABEL, STATUS_LABEL, rupiah, shortDate, shortDateTime, ui, useDashboard } from '@/lib/dashboard-client'

const TILES = [
  { href: '/dashboard/property-owner/properties', title: 'Properti Saya', body: 'Status moderasi, harga, dan pertanyaan per properti.', icon: Home },
  { href: '/dashboard/property-owner/inquiries', title: 'Pertanyaan Masuk', body: 'Balas calon pembeli/penyewa langsung.', icon: Users },
  { href: '/dashboard/property-owner/calendar', title: 'Kalender Kunjungan', body: 'Konfirmasi jadwal kunjungan properti.', icon: CalendarDays },
  { href: '/dashboard/property-owner/list', title: 'Pasang Properti', body: 'Mulai listing baru dari form lengkap.', icon: FileText },
  { href: '/dashboard/property-owner/agreement', title: 'Perjanjian', body: 'Status kemitraan & kewajiban Anda.', icon: FileSignature },
]

export default function PropertyOwnerDashboard() {
  const { data, loading } = useDashboard('property-owner')
  const metrics = data.metrics ?? {}
  const listings = (data.properties ?? []).slice(0, 4)
  const upcoming = (data.visits ?? []).filter((visit) => visit.status !== 'cancelled' && visit.status !== 'completed').slice(0, 4)
  const leads = (data.inquiries ?? []).slice(0, 4)

  return (
    <DashboardShell role="Property Owner" showSummary={false}>
      <div className="mb-5 sm:mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <DashboardGreeting welcome="Selamat datang kembali, {name}" headline="Portofolio properti Anda." description="Pantau properti, pertanyaan, jadwal kunjungan, dan status moderasi dari satu tempat." />
        <a href="/dashboard/property-owner/list" className="inline-flex items-center gap-2 rounded-xl bg-[#0b3d2e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#14553f]"><Plus className="size-4" />Pasang properti</a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total properti" value={String(metrics.properties ?? (data.properties ?? []).length)} change={`${metrics.publishedProperties ?? 0} tayang`} icon="home" />
        <MetricCard label="Pertanyaan masuk" value={String(metrics.inquiries ?? 0)} change={`${metrics.openLeads ?? 0} belum ditindak`} icon="message" />
        <MetricCard label="Kunjungan mendatang" value={String(metrics.upcomingVisits ?? 0)} change="Kelola di kalender" icon="calendar" />
        <MetricCard label="Menunggu moderasi" value={String(metrics.pendingProperties ?? 0)} change={`${metrics.rejectedProperties ?? 0} ditolak`} icon="shield" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TILES.map((tile) => (
          <a key={tile.href} href={tile.href} className="group rounded-2xl border border-[#e5dccd] bg-white p-4 sm:p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)] transition hover:border-[#c9a961]">
            <span className="grid size-11 place-items-center rounded-xl bg-[#edf2ed] text-[#0b3d2e]"><tile.icon /></span>
            <p className="mt-4 font-serif text-xl text-[#0b3d2e]">{tile.title}</p>
            <p className="mt-1 text-sm leading-6 text-[#718078]">{tile.body}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-[#0b3d2e] group-hover:underline">Buka halaman →</span>
          </a>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:gap-6 xl:grid-cols-2">
        <section className={ui.card}>
          <div className="flex items-center justify-between"><h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Properti terbaru</h3><a href="/dashboard/property-owner/properties" className="text-sm font-semibold text-[#0b3d2e] hover:underline">Lihat semua <ArrowRight className="inline size-3" /></a></div>
          <div className="mt-4 space-y-3">
            {loading && <div className="h-16 animate-pulse rounded-xl bg-[#f7f3ec]" />}
            {!loading && !listings.length && <p className={ui.soft + ' text-sm text-[#718078]'}>Belum ada properti. <a href="/dashboard/property-owner/list" className="font-semibold text-[#0b3d2e] underline">Pasang sekarang</a></p>}
            {listings.map((item) => {
              const meta = STATUS_LABEL[String(item.status)] ?? STATUS_LABEL.draft
              return (
                <a key={item.id} href="/dashboard/property-owner/properties" className="flex items-center justify-between gap-3 rounded-xl border border-[#eee7dc] p-3 hover:border-[#c9a961]">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#20332c]">{item.title ?? 'Properti'}</p><p className="text-xs text-[#718078]">{item.city ?? '—'} · {rupiah(item.price)}{item.listing_type === 'rent' ? '/bln' : ''} · {shortDate(item.created_at)}</p></div>
                  <span className={`${ui.badge} ${meta.className} shrink-0`}>{meta.label}</span>
                </a>
              )
            })}
          </div>
        </section>

        <section className={ui.card}>
          <div className="flex items-center justify-between"><h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Perlu tindakan</h3><a href="/dashboard/property-owner/inquiries" className="text-sm font-semibold text-[#0b3d2e] hover:underline">Buka pertanyaan</a></div>
          <div className="mt-4 space-y-3">
            {leads.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-[#eee7dc] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-[#20332c]">{lead.from?.name || 'Calon pembeli'} · <span className="font-normal text-[#718078]">{lead.property_title ?? 'Properti'}</span></p>
                  <span className={`${ui.badge} ${(STAGE_LABEL[String(lead.status ?? 'open')] ?? STAGE_LABEL.open).className} shrink-0`}>{(STAGE_LABEL[String(lead.status ?? 'open')] ?? STAGE_LABEL.open).label}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#718078]">{lead.message ?? ''}</p>
              </div>
            ))}
            {!loading && !leads.length && <p className={ui.soft + ' text-sm text-[#718078]'}>Belum ada pertanyaan masuk.</p>}
            {upcoming.length > 0 && (
              <div className="border-t border-[#f2ede4] pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#a18a61]">Kunjungan mendatang</p>
                {upcoming.map((visit) => (
                  <p key={visit.id} className="mt-2 text-sm text-[#33433d]">{shortDateTime(visit.scheduled_at)} · {visit.property_title ?? 'Properti'} · {visit.visitor?.name || 'Calon pembeli'}</p>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
