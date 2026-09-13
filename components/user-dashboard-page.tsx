'use client'

import useSWR from 'swr'
import { DashboardShell, SectionCard } from '@/components/dashboard-shell'

const fetcher = (url: string) => fetch(url).then((response) => {
  if (!response.ok) throw new Error('Gagal memuat data')
  return response.json()
})

type PageType = 'favorites' | 'inquiries' | 'visits' | 'apply'

const copy = {
  favorites: { title: 'Favorit', intro: 'Kumpulan properti yang Anda simpan untuk dipertimbangkan kembali.', key: 'favorites', empty: 'Belum ada properti favorit.' },
  inquiries: { title: 'Pertanyaan dan Pesan', intro: 'Pantau komunikasi Anda dengan agen dan pemilik properti.', key: 'inquiries', empty: 'Belum ada pertanyaan atau pesan.' },
  visits: { title: 'Jadwal Kunjungan', intro: 'Kelola jadwal kunjungan properti yang akan datang.', key: 'visits', empty: 'Belum ada jadwal kunjungan.' },
  apply: { title: 'Daftar sebagai Agen dan Pemilik', intro: 'Ajukan akses untuk mengelola listing atau membantu klien menemukan hunian.', key: 'applications', empty: 'Pilih peran yang ingin Anda ajukan.' },
} as const

export function UserDashboardPage({ type }: { type: PageType }) {
  const { data, error, isLoading } = useSWR('/api/dashboard/user', fetcher)
  const current = copy[type]
  const rows = data?.[current.key] ?? []
  return <DashboardShell role="User"><div className="mb-8"><p className="text-sm font-semibold uppercase tracking-[.16em] text-[#a18a61]">Dasbor Pengguna</p><h2 className="mt-2 font-serif text-4xl text-[#0b3d2e]">{current.title}</h2><p className="mt-3 max-w-2xl text-[#718078]">{current.intro}</p></div><SectionCard title={current.title}><div className="space-y-3">{isLoading ? <p className="text-sm text-[#718078]">Memuat data...</p> : error ? <p role="alert" className="text-sm text-red-700">Data belum dapat dimuat. Silakan coba lagi.</p> : type === 'apply' ? <div className="grid gap-4 md:grid-cols-2"><a href="/onboarding?role=agent" className="rounded-2xl border border-[#e5dccd] p-5 hover:bg-[#f7f3ec]"><h3 className="font-semibold text-[#0b3d2e]">Menjadi Agen Properti</h3><p className="mt-2 text-sm text-[#718078]">Kelola listing dan bantu klien menemukan properti.</p></a><a href="/onboarding?role=property_owner" className="rounded-2xl border border-[#e5dccd] p-5 hover:bg-[#f7f3ec]"><h3 className="font-semibold text-[#0b3d2e]">Menjadi Pemilik Properti</h3><p className="mt-2 text-sm text-[#718078]">Pasang dan kelola properti Anda di Homy.</p></a></div> : rows.length ? rows.map((row: Record<string, unknown>, index: number) => <div key={String(row.id ?? row.property_id ?? index)} className="rounded-xl border border-[#eee5d8] p-4"><p className="font-semibold text-[#0b3d2e]">{String(row.message ?? row.status ?? 'Properti tersimpan')}</p><p className="mt-1 text-sm text-[#718078]">{String(row.scheduled_at ?? row.created_at ?? 'Detail tersedia di database')}</p></div>) : <p className="text-sm text-[#718078]">{current.empty}</p>}</div></SectionCard></DashboardShell>
}
