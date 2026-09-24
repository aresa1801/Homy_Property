// Metadata bersama untuk program kemitraan Homy Property.
// Dipakai oleh halaman publik /partnership, formulir pengajuan, dan dasbor admin
// supaya label, badge, dan opsi selalu konsisten di seluruh aplikasi.

export type PartnerKind = 'agent' | 'owner' | 'agency' | 'institution' | 'notary'

export type PartnerKindMeta = {
  /** Label lengkap (form + admin). */
  label: string
  /** Judul singkat untuk kartu di halaman publik. */
  short: string
  /** Badge skema komisi. */
  commission: string
  /** Ringkasan singkat. */
  blurb: string
  /** Poin-poin keunggulan. */
  highlights: string[]
  /** Kelas warna badge admin. */
  tone: string
}

/** Urutan tampil di halaman publik. */
export const PARTNER_KIND_ORDER: PartnerKind[] = ['agent', 'owner', 'agency', 'institution', 'notary']

export const PARTNER_KINDS: Record<PartnerKind, PartnerKindMeta> = {
  agent: {
    label: 'Agen Properti (komisi 0,5%)',
    short: 'Agen Properti',
    commission: 'Komisi 0,5%',
    blurb: 'Profesional pemasaran properti yang membawa listing dan pembeli. Dapat dashboard CRM, analitik, dan penagihan komisi otomatis.',
    highlights: ['CRM prospek & jadwal kunjungan', 'Saran harga berbasis AI', 'Laporan transaksi 3 hari kerja'],
    tone: 'bg-[#eef3fa] text-[#3f6b9c]',
  },
  owner: {
    label: 'Pemilik Properti (komisi 2%)',
    short: 'Pemilik Properti',
    commission: 'Komisi 2%',
    blurb: 'Pemilik rumah, apartemen, ruko, atau tanah yang ingin menjual/menyewakan langsung tanpa perantara berlapis.',
    highlights: ['Pasang listing tanpa biaya', 'Moderasi cepat & transparan', 'Pantau pertanyaan & kunjungan'],
    tone: 'bg-[#edf2ed] text-[#4e866d]',
  },
  agency: {
    label: 'Agensi / Broker Properti',
    short: 'Agensi & Broker',
    commission: 'Multi-cabang',
    blurb: 'Jaringan agensi seperti Ray White atau LJ Hooker yang ingin menayangkan inventaris cabang di satu platform.',
    highlights: ['Dashboard per cabang', 'Feed listing terpusat', 'Laporan komisi per agent'],
    tone: 'bg-[#f1ecfa] text-[#6a4fa3]',
  },
  institution: {
    label: 'Institusi Korporat (developer, bank, perusahaan)',
    short: 'Institusi Korporat',
    commission: 'Skema khusus',
    blurb: 'Developer, bank, koperasi, atau perusahaan dengan inventaris properti dan kebutuhan kerjasama jangka panjang.',
    highlights: ['Co-branding & halaman mitra', 'Integrasi API/CSV inventory', 'Account manager khusus'],
    tone: 'bg-[#fdeee6] text-[#b4661f]',
  },
  notary: {
    label: 'Notaris / PPAT & Mitra Legal',
    short: 'Notaris & PPAT',
    commission: 'Referral',
    blurb: 'Notaris, PPAT, atau kantor hukum yang menangani akta jual beli, AJB, PPAT, dan legalitas properti untuk transaksi di Homy.',
    highlights: ['Prioritas AJB & akta transaksi Homy', 'Referensi klien timbal balik', 'Profil mitra legal resmi di platform'],
    tone: 'bg-[#eaf3f7] text-[#2f6f8f]',
  },
}

/** Termasuk "Pesan Kontak" (bukan mitra) untuk badge dasbor admin. */
export const LEAD_KIND_BADGE: Record<string, { label: string; tone: string }> = {
  ...Object.fromEntries(Object.entries(PARTNER_KINDS).map(([key, meta]) => [key, { label: meta.short, tone: meta.tone }])),
  contact: { label: 'Pesan Kontak', tone: 'bg-[#f2f0ea] text-[#718078]' },
}

export const LEAD_STATUS_META: Record<string, { label: string; tone: string }> = {
  new: { label: 'Baru', tone: 'bg-[#fff7e3] text-[#9b762a]' },
  reviewing: { label: 'Ditinjau', tone: 'bg-[#eef3fa] text-[#3f6b9c]' },
  contacted: { label: 'Dihubungi', tone: 'bg-[#f1ecfa] text-[#6a4fa3]' },
  approved: { label: 'Disetujui', tone: 'bg-[#edf2ed] text-[#4e866d]' },
  rejected: { label: 'Ditolak', tone: 'bg-[#fbeeec] text-[#b45c50]' },
}

/** Bentuk badan usaha / kantor. */
export const ENTITY_TYPES = ['PT', 'CV', 'Koperasi', 'Yayasan', 'Perorangan', 'Kantor Notaris/PPAT', 'Lainnya']

/** Fokus area properti (chip multi-pilih). */
export const FOCUS_AREA_OPTIONS = ['Rumah', 'Apartemen', 'Ruko', 'Tanah', 'Villa', 'Gudang', 'Perkantoran', 'Properti Komersial']

/** Layanan yang ditawarkan — berbeda per jenis kemitraan. */
export const SERVICE_OPTIONS: Record<PartnerKind, string[]> = {
  agent: ['Pemasaran listing', 'Pendampingan kunjungan', 'Negosiasi harga', 'Bantuan KPR', 'Fotografi/video properti', 'Virtual tour'],
  owner: [],
  agency: ['Manajemen tim agent', 'Co-branding & feed listing', 'Integrasi API/CSV', 'Konsultasi developer', 'Pelatihan tim'],
  institution: ['Integrasi API/CSV', 'Co-branding', 'Inventory bank/repossession', 'Skema komisi bertingkat', 'Account manager khusus'],
  notary: ['Akta Jual Beli (AJB)', 'PPAT & balik nama', 'Legal review / opini hukum', 'Perjanjian sewa & PPJB', 'Pendirian badan usaha', 'Waris, hibah & pembagian hak'],
}

/** Estimasi volume transaksi per bulan. */
export const VOLUME_OPTIONS = ['< 5 transaksi', '5 – 20 transaksi', '21 – 50 transaksi', '> 50 transaksi']

/** Preferensi kanal & waktu dihubungi. */
export const CONTACT_CHANNELS = ['WhatsApp', 'Telepon', 'Email']
export const CONTACT_TIMES = ['Jam kerja (08.00 – 17.00)', 'Sore (17.00 – 21.00)', 'Fleksibel']
