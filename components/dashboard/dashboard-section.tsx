'use client'

import { FeatureShell } from '@/components/dashboard/feature-shell'
import { useDashboard } from '@/lib/dashboard-client'
import { AnalyticsBoard, LeadsBoard, ListingBoard } from '@/components/dashboard/boards-listing'
import { AgreementBoard, AvailabilityBoard, BillingBoard, CalendarBoard, ListLauncher } from '@/components/dashboard/boards-ops'
import { AiBoard, AiConversationsBoard } from '@/components/dashboard/boards-ai'
import { AiMonitorBoard, AuditBoard, FlagsBoard, ModerationBoard, PartnershipBoard, PlatformBillingBoard, ReportsBoard, RolesBoard, SettingsBoard, UsersBoard } from '@/components/dashboard/boards-admin'

export type SectionRole = 'agent' | 'property-owner' | 'admin' | 'super-admin'

type SectionMeta = { eyebrow: string; title: string; description: string }

const SECTIONS: Record<SectionRole, Record<string, SectionMeta>> = {
  agent: {
    listings: { eyebrow: 'Listing', title: 'Listing Saya', description: 'Pantau seluruh listing Anda: status moderasi, performa prospek, dan aksi cepat seperti mengajukan ulang listing yang ditolak.' },
    leads: { eyebrow: 'Prospek', title: 'CRM Prospek', description: 'Kelola calon pembeli dan penyewa dari pertama menghubungi sampai transaksi selesai. Balas, ubah tahap, dan catat tindak lanjut.' },
    analytics: { eyebrow: 'Kinerja', title: 'Analitik', description: 'Lihat performa setiap listing: harga, jumlah prospek, tingkat respons, dan konversi agar Anda tahu mana yang perlu diprioritaskan.' },
    calendar: { eyebrow: 'Jadwal', title: 'Kalender & Ketersediaan', description: 'Satu tempat untuk jadwal kunjungan calon pembeli dan pengaturan hari/jam Anda siap menerima meeting. Konfirmasi jadwal, ubah waktu, atur ketersediaan, lalu tindak lanjuti hasil kunjungan.' },
    schedule: { eyebrow: 'Jadwal', title: 'Kalender & Ketersediaan', description: 'Satu tempat untuk jadwal kunjungan calon pembeli dan pengaturan hari/jam Anda siap menerima meeting. Konfirmasi jadwal, ubah waktu, atur ketersediaan, lalu tindak lanjuti hasil kunjungan.' },
    availability: { eyebrow: 'Jadwal', title: 'Kalender & Ketersediaan', description: 'Satu tempat untuk jadwal kunjungan calon pembeli dan pengaturan hari/jam Anda siap menerima meeting. Konfirmasi jadwal, ubah waktu, atur ketersediaan, lalu tindak lanjuti hasil kunjungan.' },
    conversations: { eyebrow: 'Rekaman', title: 'Rekam Percakapan', description: 'Riwayat tanya-jawab calon pembeli/penyewa dengan Homy AI tentang listing Anda. Pakai untuk memahami pertanyaan yang paling sering muncul dan menyiapkan jawaban terbaik.' },
    billing: { eyebrow: 'Keuangan', title: 'Penagihan & Komisi', description: 'Laporkan transaksi properti ke Homy dan pantau komisi penjualan 0,5% beserta status verifikasinya.' },
    agreement: { eyebrow: 'Kemitraan', title: 'Perjanjian Kerjasama', description: 'Status perjanjian mitra Anda, data perjanjian yang tersimpan, dan ringkasan kewajiban sebagai agen Homy.' },
    list: { eyebrow: 'Publikasi', title: 'Pasang Properti', description: 'Siapkan syarat publikasi, lanjutkan listing yang tertunda, dan mulai listing baru dari form lengkap yang terbaca AI.' },
    ai: { eyebrow: 'Kecerdasan Buatan', title: 'Asisten AI', description: 'Saran harga otomatis dari data harga rata-rata kecamatan/kota Anda, pembanding listing, dan tanya-jawab bebas dengan Homy AI.' },
  },
  'property-owner': {
    properties: { eyebrow: 'Portofolio', title: 'Properti Saya', description: 'Semua properti Anda dalam satu papan: status moderasi, harga, jumlah pertanyaan masuk, dan aksi cepat mengajukan ulang.' },
    inquiries: { eyebrow: 'Pertanyaan', title: 'Pertanyaan Masuk', description: 'Semua pertanyaan calon pembeli/penyewa per properti. Balas langsung dan tandai tahap tindak lanjutnya.' },
    calendar: { eyebrow: 'Jadwal', title: 'Kalender & Ketersediaan', description: 'Satu tempat untuk jadwal kunjungan calon pembeli dan pengaturan hari/jam Anda siap menerima meeting. Konfirmasi jadwal, ubah waktu, atur ketersediaan, lalu tindak lanjuti hasil kunjungan.' },
    schedule: { eyebrow: 'Jadwal', title: 'Kalender & Ketersediaan', description: 'Satu tempat untuk jadwal kunjungan calon pembeli dan pengaturan hari/jam Anda siap menerima meeting. Konfirmasi jadwal, ubah waktu, atur ketersediaan, lalu tindak lanjuti hasil kunjungan.' },
    availability: { eyebrow: 'Jadwal', title: 'Kalender & Ketersediaan', description: 'Satu tempat untuk jadwal kunjungan calon pembeli dan pengaturan hari/jam Anda siap menerima meeting. Konfirmasi jadwal, ubah waktu, atur ketersediaan, lalu tindak lanjuti hasil kunjungan.' },
    conversations: { eyebrow: 'Rekaman', title: 'Rekam Percakapan', description: 'Riwayat tanya-jawab calon pembeli/penyewa dengan Homy AI tentang properti Anda. Pakai untuk memahami pertanyaan yang paling sering muncul dan menyiapkan jawaban terbaik.' },
    agreement: { eyebrow: 'Kemitraan', title: 'Perjanjian Kerjasama', description: 'Status perjanjian mitra Anda, data perjanjian yang tersimpan, dan ringkasan kewajiban sebagai pemilik properti.' },
    list: { eyebrow: 'Publikasi', title: 'Pasang Properti', description: 'Siapkan syarat publikasi, lanjutkan properti yang tertunda, dan mulai listing baru dari form lengkap yang terbaca AI.' },
    ai: { eyebrow: 'Kecerdasan Buatan', title: 'Asisten AI', description: 'Saran harga otomatis dari data harga rata-rata kecamatan/kota Anda, pembanding listing, dan tanya-jawab bebas dengan Homy AI.' },
  },
  admin: {
    moderation: { eyebrow: 'Moderasi', title: 'Moderasi Listing', description: 'Tinjau listing yang dikirim mitra: setujui untuk tayang di halaman publik atau tolak dengan catatan agar pemilik bisa memperbaiki.' },
    users: { eyebrow: 'Pengguna', title: 'Pengguna & Agen', description: 'Daftar seluruh akun Homy beserta peran (pengguna, agen, pemilik, admin) dan jumlah listing yang mereka kelola.' },
    billing: { eyebrow: 'Keuangan', title: 'Penagihan & Komisi Mitra', description: 'Verifikasi laporan transaksi dari agen dan pemilik. Komisi 0,5% yang terverifikasi di sini adalah pendapatan platform — status ini tampil di dashboard mitra.' },
    reports: { eyebrow: 'Keamanan', title: 'Laporan & Penipuan', description: 'Tindak lanjuti laporan pengguna, plus pemeriksaan otomatis: duplikat judul listing dan listing tayang yang belum punya foto.' },
    ai: { eyebrow: 'Kecerdasan Buatan', title: 'Pemantauan AI', description: 'Pastikan Homy AI menjawab dari data listing yang tayang: status kunci AI, cakupan ringkasan AI, dan uji tanya-jawab langsung.' },
  },
  'super-admin': {
    roles: { eyebrow: 'Akses', title: 'Peran & Izin', description: 'Komposisi peran seluruh akun dan pengaturan akses peran (pengguna, agen, pemilik, admin, super admin).' },
    billing: { eyebrow: 'Keuangan', title: 'Penagihan Platform', description: 'Pusat komisi Homy: laporan transaksi mitra, komisi terverifikasi (pendapatan platform), dan komisi yang masih menunggu.' },
    audit: { eyebrow: 'Jejak', title: 'Log Audit', description: 'Semua tindakan penting platform: moderasi listing, verifikasi komisi, perubahan peran, konfigurasi, dan flag.' },
    system: { eyebrow: 'Platform', title: 'Konfigurasi Sistem', description: 'Pengaturan inti Homy: komisi penjualan, publikasi otomatis, model AI, dan alamat pengirim notifikasi.' },
    flags: { eyebrow: 'Rilis', title: 'Feature Flag', description: 'Nyalakan atau matikan fitur platform dan atur bertahap (rollout) tanpa perlu deploy ulang.' },
    partnership: { eyebrow: 'Kemitraan', title: 'Calon Mitra & Partnership', description: 'Pengajuan kemitraan dari halaman Open Partnership (agen, pemilik, agensi, institusi korporat seperti Ray White/LJ Hooker) dan pesan dari halaman Kontak: verifikasi, hubungi, setujui, atau tolak.' },
  },
}

function adminOr(role: SectionRole): 'admin' | 'super-admin' {
  return role === 'admin' ? 'admin' : 'super-admin'
}

/** Kalender kunjungan + pengaturan ketersediaan digabung dalam satu halaman. */
function ScheduleBoard({ data, loading, reload, type }: { data: Parameters<typeof CalendarBoard>[0]['data']; loading: boolean; reload: () => void; type: 'agent' | 'property-owner' }) {
  return (
    <div className="space-y-5">
      <CalendarBoard data={data} loading={loading} reload={reload} type={type} />
      <div className="border-t border-[#e5dccd] pt-5">
        <AvailabilityBoard data={data} loading={loading} reload={reload} type={type} />
      </div>
    </div>
  )
}

export function DashboardSection({ role, section }: { role: SectionRole; section: string }) {
  const { data, loading, reload } = useDashboard(role)
  const config = SECTIONS[role][section]

  function board(): React.ReactNode {
    if (role === 'admin' || role === 'super-admin') {
      const type = adminOr(role)
      if (section === 'moderation') return <ModerationBoard />
      if (section === 'users') return <UsersBoard data={data} loading={loading} reload={reload} type={type} />
      if (section === 'billing') return <PlatformBillingBoard data={data} loading={loading} reload={reload} type={type} />
      if (section === 'reports') return <ReportsBoard data={data} loading={loading} reload={reload} />
      if (section === 'ai') return <AiMonitorBoard data={data} loading={loading} reload={reload} />
      if (section === 'roles') return <RolesBoard data={data} loading={loading} reload={reload} type={type} />
      if (section === 'system') return <SettingsBoard data={data} loading={loading} reload={reload} />
      if (section === 'flags') return <FlagsBoard data={data} loading={loading} reload={reload} />
      if (section === 'audit') return <AuditBoard data={data} loading={loading} reload={reload} />
      if (section === 'partnership') return <PartnershipBoard data={data} loading={loading} reload={reload} />
      return null
    }
    const boards: Record<string, React.ReactNode> = {
      listings: <ListingBoard data={data} loading={loading} reload={reload} type={role} />,
      properties: <ListingBoard data={data} loading={loading} reload={reload} type={role} />,
      leads: <LeadsBoard data={data} loading={loading} reload={reload} type={role} />,
      inquiries: <LeadsBoard data={data} loading={loading} reload={reload} type={role} />,
      analytics: <AnalyticsBoard data={data} loading={loading} reload={reload} type={role} />,
      billing: <BillingBoard data={data} loading={loading} reload={reload} type={role} />,
      calendar: <ScheduleBoard data={data} loading={loading} reload={reload} type={role} />,
      schedule: <ScheduleBoard data={data} loading={loading} reload={reload} type={role} />,
      availability: <ScheduleBoard data={data} loading={loading} reload={reload} type={role} />,
      conversations: <AiConversationsBoard data={data} loading={loading} reload={reload} type={role} />,
      agreement: <AgreementBoard data={data} loading={loading} reload={reload} type={role} />,
      list: <ListLauncher data={data} loading={loading} reload={reload} type={role} />,
      ai: <AiBoard data={data} loading={loading} reload={reload} type={role} />,
    }
    return boards[section]
  }

  const shellRole = role === 'agent' ? 'Agent' : role === 'property-owner' ? 'Property Owner' : role === 'admin' ? 'Admin' : 'Super Admin'

  return (
    <FeatureShell
      role={shellRole}
      eyebrow={config.eyebrow}
      title={config.title}
      description={config.description}
      actions={section === 'list' ? <a href="/list" className="inline-flex rounded-lg bg-[#0b3d2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14553f]">Mulai listing baru</a> : undefined}
    >
      {board()}
    </FeatureShell>
  )
}
