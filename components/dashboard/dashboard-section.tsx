'use client'

import { FeatureShell } from '@/components/dashboard/feature-shell'
import { useDashboard } from '@/lib/dashboard-client'
import { AnalyticsBoard, LeadsBoard, ListingBoard } from '@/components/dashboard/boards-listing'
import { AgreementBoard, BillingBoard, CalendarBoard, ListLauncher } from '@/components/dashboard/boards-ops'
import { AiBoard } from '@/components/dashboard/boards-ai'

export type SectionRole = 'agent' | 'property-owner'

const SECTIONS: Record<SectionRole, Record<string, { eyebrow: string; title: string; description: string }>> = {
  agent: {
    listings: { eyebrow: 'Listing', title: 'Listing Saya', description: 'Pantau seluruh listing Anda: status moderasi, performa prospek, dan aksi cepat seperti mengajukan ulang listing yang ditolak.' },
    leads: { eyebrow: 'Prospek', title: 'CRM Prospek', description: 'Kelola calon pembeli dan penyewa dari pertama menghubungi sampai transaksi selesai. Balas, ubah tahap, dan catat tindak lanjut.' },
    analytics: { eyebrow: 'Kinerja', title: 'Analitik', description: 'Lihat performa setiap listing: harga, jumlah prospek, tingkat respons, dan konversi agar Anda tahu mana yang perlu diprioritaskan.' },
    billing: { eyebrow: 'Keuangan', title: 'Penagihan & Komisi', description: 'Laporkan transaksi properti ke Homy dan pantau komisi penjualan 0,5% beserta status verifikasinya.' },
    agreement: { eyebrow: 'Kemitraan', title: 'Perjanjian Kerjasama', description: 'Status perjanjian mitra Anda, data perjanjian yang tersimpan, dan ringkasan kewajiban sebagai agen Homy.' },
    list: { eyebrow: 'Publikasi', title: 'Pasang Properti', description: 'Siapkan syarat publikasi, lanjutkan listing yang tertunda, dan mulai listing baru dari form lengkap yang terbaca AI.' },
    ai: { eyebrow: 'Kecerdasan Buatan', title: 'Asisten AI', description: 'Saran harga otomatis dari data harga rata-rata kecamatan/kota Anda, pembanding listing, dan tanya-jawab bebas dengan Homy AI.' },
  },
  'property-owner': {
    properties: { eyebrow: 'Portofolio', title: 'Properti Saya', description: 'Semua properti Anda dalam satu papan: status moderasi, harga, jumlah pertanyaan masuk, dan aksi cepat mengajukan ulang.' },
    inquiries: { eyebrow: 'Pertanyaan', title: 'Pertanyaan Masuk', description: 'Semua pertanyaan calon pembeli/penyewa per properti. Balas langsung dan tandai tahap tindak lanjutnya.' },
    calendar: { eyebrow: 'Jadwal', title: 'Kalender Kunjungan', description: 'Jadwal kunjungan calon pembeli ke properti Anda: konfirmasi, ubah waktu, tambah catatan, atau tandai selesai.' },
    agreement: { eyebrow: 'Kemitraan', title: 'Perjanjian Kerjasama', description: 'Status perjanjian mitra Anda, data perjanjian yang tersimpan, dan ringkasan kewajiban sebagai pemilik properti.' },
    list: { eyebrow: 'Publikasi', title: 'Pasang Properti', description: 'Siapkan syarat publikasi, lanjutkan properti yang tertunda, dan mulai listing baru dari form lengkap yang terbaca AI.' },
    ai: { eyebrow: 'Kecerdasan Buatan', title: 'Asisten AI', description: 'Saran harga otomatis dari data harga rata-rata kecamatan/kota Anda, pembanding listing, dan tanya-jawab bebas dengan Homy AI.' },
  },
}

export function DashboardSection({ role, section }: { role: SectionRole; section: string }) {
  const { data, loading, reload } = useDashboard(role)
  const config = SECTIONS[role][section]

  const boards: Record<string, React.ReactNode> = {
    listings: <ListingBoard data={data} loading={loading} reload={reload} type={role} />,
    properties: <ListingBoard data={data} loading={loading} reload={reload} type={role} />,
    leads: <LeadsBoard data={data} loading={loading} reload={reload} type={role} />,
    inquiries: <LeadsBoard data={data} loading={loading} reload={reload} type={role} />,
    analytics: <AnalyticsBoard data={data} loading={loading} reload={reload} type={role} />,
    billing: <BillingBoard data={data} loading={loading} reload={reload} type={role} />,
    calendar: <CalendarBoard data={data} loading={loading} reload={reload} type={role} />,
    agreement: <AgreementBoard data={data} loading={loading} reload={reload} type={role} />,
    list: <ListLauncher data={data} loading={loading} reload={reload} type={role} />,
    ai: <AiBoard data={data} loading={loading} reload={reload} type={role} />,
  }

  return (
    <FeatureShell role={role === 'agent' ? 'Agent' : 'Property Owner'} eyebrow={config.eyebrow} title={config.title} description={config.description} actions={section === 'list' ? <a href="/list" className="inline-flex rounded-lg bg-[#0b3d2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14553f]">Mulai listing baru</a> : undefined}>
      {boards[section]}
    </FeatureShell>
  )
}
