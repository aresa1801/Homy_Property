'use client'

import useSWR from 'swr'
type DashboardRole = 'user' | 'agent' | 'property-owner' | 'admin' | 'super-admin'

const fetcher = (url: string) => fetch(url).then(async (response) => {
  if (!response.ok) throw new Error('Gagal memuat data dasbor')
  return response.json()
})

const labels: Record<DashboardRole, { keys: string[]; names: string[] }> = {
  user: { keys: ['favorites', 'inquiries', 'upcomingVisits', 'pendingPayments'], names: ['Favorit tersimpan', 'Pertanyaan aktif', 'Kunjungan mendatang', 'Pembayaran tertunda'] },
  agent: { keys: ['activeListings', 'newLeads'], names: ['Listing aktif', 'Prospek baru'] },
  'property-owner': { keys: ['properties', 'publishedProperties', 'inquiries'], names: ['Total properti', 'Properti tayang', 'Pertanyaan masuk'] },
  admin: { keys: ['pendingApprovals', 'openReports', 'activeUsers'], names: ['Menunggu persetujuan', 'Laporan terbuka', 'Pengguna aktif'] },
  'super-admin': { keys: ['users', 'properties', 'auditEvents'], names: ['Pengguna', 'Properti', 'Aktivitas audit'] },
}

export function DashboardDataSummary({ role }: { role: DashboardRole }) {
  const { data, error, isLoading } = useSWR(`/api/dashboard/${role}`, fetcher)
  const config = labels[role]
  if (error) return <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Data dasbor belum dapat dimuat. Silakan muat ulang halaman.</p>
  if (isLoading) return <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="h-28 animate-pulse rounded-2xl bg-white/70" /><div className="h-28 animate-pulse rounded-2xl bg-white/70" /></div>
  return <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{config.keys.map((key, index) => <div key={key} className="rounded-2xl border border-[#e5dccd] bg-white p-4 sm:p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]"><p className="text-sm text-[#718078]">{config.names[index]}</p><p className="mt-3 font-serif text-2xl sm:text-3xl text-[#0b3d2e]">{String(data?.metrics?.[key] ?? 0)}</p></div>)}</div>
}

export type { DashboardRole }
