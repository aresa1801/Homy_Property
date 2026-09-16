'use client'

import { BarChart3, FileSignature, FileText, Home, Plus, Users, WalletCards } from 'lucide-react'
import { DashboardGreeting, DashboardShell, MetricCard } from '@/components/dashboard-shell'
import { STAGE_LABEL, STATUS_LABEL, rupiah, shortDate, ui, useDashboard } from '@/lib/dashboard-client'

const TILES = [
  { href: '/dashboard/agent/listings', title: 'Listing Saya', body: 'Status moderasi, performa, dan ajukan ulang.', icon: Home },
  { href: '/dashboard/agent/leads', title: 'CRM Prospek', body: 'Balas calon pembeli & ubah tahap pipeline.', icon: Users },
  { href: '/dashboard/agent/analytics', title: 'Analitik', body: 'Harga, prospek, respons, dan konversi.', icon: BarChart3 },
  { href: '/dashboard/agent/billing', title: 'Penagihan', body: 'Lapor transaksi & komisi penjualan 0,5%.', icon: WalletCards },
  { href: '/dashboard/agent/agreement', title: 'Perjanjian', body: 'Status kemitraan & kewajiban Anda.', icon: FileSignature },
  { href: '/dashboard/agent/list', title: 'Pasang Properti', body: 'Mulai listing baru dari form lengkap.', icon: FileText },
]

export default function AgentDashboard() {
  const { data, loading } = useDashboard('agent')
  const metrics = data.metrics ?? {}
  const listings = (data.properties ?? []).slice(0, 4)
  const leads = (data.inquiries ?? []).slice(0, 4)
  const stages = Object.entries(STAGE_LABEL).map(([stage, meta]) => ({ stage, meta, total: (data.inquiries ?? []).filter((lead) => (lead.status ?? 'open') === stage).length }))
  const maxStage = Math.max(1, ...stages.map((row) => row.total))

  return (
    <DashboardShell role="Agent" showSummary={false}>
      <div className="mb-5 sm:mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <DashboardGreeting welcome="Selamat datang kembali, {name}" headline="Kembangkan bisnis properti Anda." description="Semua listing, prospek, dan komisi Anda dalam satu ruang kerja." />
        <a href="/dashboard/agent/list" className="inline-flex items-center gap-2 rounded-xl bg-[#0b3d2e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#14553f]"><Plus className="size-4" />Tambah listing</a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Total listing" value={String(metrics.totalListings ?? (data.properties ?? []).length)} change={`${metrics.activeListings ?? 0} tayang`} icon="home" />
        <MetricCard label="Prospek baru" value={String(metrics.newLeads ?? 0)} change={`${metrics.totalLeads ?? 0} total prospek${metrics.aiProspects ? ` · ${metrics.aiProspects} dari Homy AI` : ''}`} icon="users" />
        <MetricCard label="Kunjungan mendatang" value={String(metrics.upcomingVisits ?? 0)} change="Lihat kalender & konfirmasi" icon="calendar" />
        <MetricCard label="Komisi dilaporkan" value={rupiah(metrics.commissionTotal ?? 0)} change={`${metrics.reports ?? 0} transaksi dilaporkan`} icon="wallet" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {TILES.map((tile) => (
          <a key={tile.href} href={tile.href} className="group rounded-2xl border border-[#e5dccd] bg-white p-3 shadow-[0_10px_30px_rgba(20,42,32,.04)] transition hover:border-[#c9a961] sm:p-5">
            <span className="grid size-9 place-items-center rounded-xl bg-[#edf2ed] text-[#0b3d2e] sm:size-11"><tile.icon className="size-4 sm:size-5" /></span>
            <p className="mt-2 font-serif text-base leading-tight text-[#0b3d2e] sm:mt-4 sm:text-xl">{tile.title}</p>
            <p className="mt-1 text-xs leading-5 text-[#718078] sm:text-sm sm:leading-6">{tile.body}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-[#0b3d2e] group-hover:underline">Buka halaman →</span>
          </a>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:gap-6 xl:grid-cols-2">
        <section className={ui.card}>
          <div className="flex items-center justify-between"><h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Listing terbaru</h3><a href="/dashboard/agent/listings" className="text-sm font-semibold text-[#0b3d2e] hover:underline">Lihat semua</a></div>
          <div className="mt-4 space-y-3">
            {loading && <div className="h-16 animate-pulse rounded-xl bg-[#f7f3ec]" />}
            {!loading && !listings.length && <p className={ui.soft + ' text-sm text-[#718078]'}>Belum ada listing. <a href="/dashboard/agent/list" className="font-semibold text-[#0b3d2e] underline">Mulai sekarang</a></p>}
            {listings.map((item) => {
              const meta = STATUS_LABEL[String(item.status)] ?? STATUS_LABEL.draft
              return (
                <a key={item.id} href="/dashboard/agent/listings" className="flex items-center justify-between gap-3 rounded-xl border border-[#eee7dc] p-3 hover:border-[#c9a961]">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#20332c]">{item.title ?? 'Listing'}</p><p className="text-xs text-[#718078]">{item.city ?? '—'} · {rupiah(item.price)}{item.listing_type === 'rent' ? '/bln' : ''} · {shortDate(item.created_at)}</p></div>
                  <span className={`${ui.badge} ${meta.className} shrink-0`}>{meta.label}</span>
                </a>
              )
            })}
          </div>
        </section>

        <section className={ui.card}>
          <div className="flex items-center justify-between"><h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Pipeline prospek</h3><a href="/dashboard/agent/leads" className="text-sm font-semibold text-[#0b3d2e] hover:underline">Kelola prospek</a></div>
          <div className="mt-4 space-y-3">
            {stages.map(({ stage, meta, total }) => (
              <div key={stage}>
                <div className="flex justify-between text-sm"><span className="text-[#33433d]">{meta.label}</span><strong className="text-[#0b3d2e]">{total}</strong></div>
                <div className="mt-1 h-2 rounded-full bg-[#f2f0ea]"><div className="h-2 rounded-full bg-[#0b3d2e]" style={{ width: `${Math.round((total / maxStage) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2 border-t border-[#f2ede4] pt-4">
            {leads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-[#33433d]">{lead.from?.name || 'Calon pembeli'} · <span className="text-[#718078]">{lead.property_title ?? 'Properti'}</span></span>
                <span className={`${ui.badge} ${(STAGE_LABEL[String(lead.status ?? 'open')] ?? STAGE_LABEL.open).className} shrink-0`}>{(STAGE_LABEL[String(lead.status ?? 'open')] ?? STAGE_LABEL.open).label}</span>
              </div>
            ))}
            {!loading && !leads.length && <p className="text-sm text-[#718078]">Belum ada prospek masuk.</p>}
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
