'use client'

import { CalendarDays, Home, HeartHandshake, MessageSquare } from 'lucide-react'
import { DashboardGreeting, DashboardShell, MetricCard, SectionCard } from '@/components/dashboard-shell'
import { InterestPanel } from '@/components/interest-panel'
import { STAGE_LABEL, VISIT_LABEL, rupiah, shortDate, shortDateTime, ui, useDashboard } from '@/lib/dashboard-client'

type UserFavorite = { property_id?: string; created_at?: string; property?: { id?: string; title?: string; city?: string; price?: number | string | null; price_period?: string | null; listing_type?: string | null } | null }
type UserVisit = { id?: string; status?: string; scheduled_at?: string; notes?: string | null; property?: { title?: string; city?: string } | null }

export default function UserDashboard() {
  const { data, loading } = useDashboard('user')
  const metrics = data.metrics ?? {}
  const inquiries = (data.inquiries ?? []).slice(0, 3)
  const favorites = (data.favorites ?? []) as UserFavorite[]
  const visits = ((data.visits ?? []) as UserVisit[]).filter((visit) => visit.status !== 'cancelled' && visit.status !== 'completed')
  const interests = data.interests ?? []
  const nextVisit = visits[0]
  const interestDeal = interests.filter((row) => String(row.stage ?? '') === 'deal').length
  const interestNegotiation = interests.filter((row) => ['negotiation', 'offer'].includes(String(row.stage ?? ''))).length

  return (
    <DashboardShell role="User">
      <div className="mb-5 sm:mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <DashboardGreeting welcome="Selamat pagi, {name}" headline="Perjalanan hunian Anda." description="Pantau hunian dan percakapan penting bagi Anda." />
        <a href="/onboarding" className="inline-flex items-center justify-center rounded-full bg-[#0b3d2e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#14543f]">Daftar sebagai Agen atau Pemilik</a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Favorit tersimpan" value={String(metrics.favorites ?? favorites.length)} change={favorites.length ? 'Properti yang Anda simpan' : 'Belum ada properti disimpan'} icon="home" />
        <MetricCard label="Pertanyaan aktif" value={String(metrics.inquiries ?? inquiries.length)} change={(metrics.openInquiries ?? 0) + ' belum selesai'} icon="message" />
        <MetricCard label="Kunjungan mendatang" value={String(metrics.upcomingVisits ?? visits.length)} change={nextVisit?.scheduled_at ? shortDateTime(nextVisit.scheduled_at) : 'Belum ada jadwal'} icon="calendar" />
        <MetricCard label="Konfirmasi ketertarikan" value={String(metrics.interests ?? interests.length)} change={interestDeal ? interestDeal + ' sudah kesepakatan' : interestNegotiation ? interestNegotiation + ' sedang negosiasi' : 'Nyatakan minat Anda pada properti'} icon="handshake" />
      </div>

      <div className="mt-6 grid gap-4 sm:gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <SectionCard title="Pertanyaan terbaru" action="Lihat semua" id="inquiries">
          <div className="flex flex-col gap-4">
            {loading && <div className="h-16 animate-pulse rounded-xl bg-[#f7f3ec]" />}
            {!loading && !inquiries.length && <p className={ui.soft + ' text-sm text-[#718078]'}>Belum ada pertanyaan. Ajukan pertanyaan lewat tombol “Hubungi” di halaman properti.</p>}
            {inquiries.map((inquiry) => {
              const meta = STAGE_LABEL[String(inquiry.status ?? 'open')] ?? STAGE_LABEL.open
              return (
                <div key={inquiry.id} className="flex items-center justify-between border-b border-[#eee7dc] pb-4 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#20332c]">{inquiry.property?.title ?? inquiry.property_title ?? 'Properti'}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-[#718078]">{inquiry.message ?? 'Pertanyaan terkirim'} · {shortDate(inquiry.created_at)}</p>
                  </div>
                  <span className={ui.badge + ' ' + meta.className + ' shrink-0'}>{meta.label}</span>
                </div>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard title="Kunjungan mendatang" action="Kalender" id="visits">
          {nextVisit ? (
            <div className="rounded-xl bg-[#f7f3ec] p-4">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#a18a61]">{shortDateTime(nextVisit.scheduled_at)}</p>
              <p className="mt-2 font-serif text-xl text-[#0b3d2e]">{nextVisit.property?.title ?? 'Properti'}</p>
              <p className="mt-1 text-sm text-[#718078]">{nextVisit.property?.city ?? 'Lokasi belum diisi'} · {(VISIT_LABEL[String(nextVisit.status ?? 'requested')] ?? VISIT_LABEL.requested).label}</p>
              <a href="/dashboard/user/visits" className="mt-4 inline-block text-sm font-semibold text-[#0b3d2e]">Lihat detail kunjungan →</a>
            </div>
          ) : (
            <div className="rounded-xl bg-[#f7f3ec] p-4">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#a18a61]">Belum ada jadwal</p>
              <p className="mt-2 font-serif text-xl text-[#0b3d2e]">Atur kunjungan properti</p>
              <p className="mt-1 text-sm text-[#718078]">Pilih properti favorit Anda lalu jadwalkan kunjungan bersama agen atau pemilik.</p>
              <a href="/dashboard/user/visits" className="mt-4 inline-block text-sm font-semibold text-[#0b3d2e]">Buka jadwal kunjungan →</a>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-4 sm:gap-6 xl:grid-cols-2">
        <SectionCard title="Favorit" action="Cari properti" id="favorites">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#eee7dc] p-4">
              <p className="font-serif text-xl text-[#0b3d2e]">{favorites.length ? favorites.length + ' properti tersimpan' : 'Belum ada favorit'}</p>
              <p className="mt-1 text-sm text-[#718078]">{favorites.length ? 'Buka untuk membandingkan pilihan Anda' : 'Simpan properti untuk dibandingkan nanti'}</p>
            </div>
            <div className="rounded-xl border border-[#eee7dc] p-4">
              <p className="font-serif text-xl text-[#0b3d2e]">{rupiah(metrics.averageFavoritePrice ?? 0)}</p>
              <p className="mt-1 text-sm text-[#718078]">Rata-rata harga properti favorit</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {favorites.slice(0, 3).map((favorite) => (
              <a key={favorite.property_id} href={'/property/' + String(favorite.property_id)} className="flex items-center justify-between gap-3 rounded-xl border border-[#eee7dc] p-3 hover:border-[#c9a961]">
                <span className="min-w-0 truncate text-sm font-semibold text-[#20332c]">{favorite.property?.title ?? 'Properti'}</span>
                <span className="shrink-0 text-xs text-[#718078]">{rupiah(favorite.property?.price ?? 0)}{favorite.property?.listing_type === 'rent' ? '/bln' : ''}</span>
              </a>
            ))}
            {!loading && !favorites.length && <p className="text-sm text-[#718078]">Belum ada properti yang Anda simpan.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Konfirmasi Ketertarikan" action="Kelola" id="interest">
          <p className="text-sm text-[#718078]">Ceritakan kebutuhan dan rencana properti Anda. Homy Property akan membantu menemukan solusi terbaik untuk investasi maupun kebutuhan properti Anda.</p>
          <div className="mt-3">
            <InterestPanel compact />
          </div>
        </SectionCard>
      </div>
    </DashboardShell>
  )
}
