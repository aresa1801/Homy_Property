/**
 * Homy — alur verifikasi Mitra (Agen & Pemilik Properti).
 *
 * Berisi konstanta + tipe yang dipakai bersama oleh:
 *  - `app/verify/page.tsx` (wizard pengisian data mitra)
 *  - `app/api/verify/route.ts` (simpan draft / ajukan verifikasi)
 *  - `components/verification-board.tsx` (status mitra di dasbor)
 *  - `components/dashboard/boards-admin.tsx` (persetujuan admin)
 *  - `lib/agreement-pdf.ts` (dokumen perjanjian)
 *
 * File ini aman diimpor dari client maupun server (tanpa dependensi Node).
 */

export type VerificationRole = 'agent' | 'property_owner'
export type VerificationStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type IdentityType = 'ktp' | 'sim'
export type AvailabilityMode = 'online' | 'onsite' | 'both'

export type AvailabilityEntry = {
  weekday: number
  is_active: boolean
  start_time: string
  end_time: string
  slot_minutes: number
  mode: AvailabilityMode
  location: string | null
  notes: string | null
}

export type VerificationRecord = {
  id?: string
  user_id?: string
  requested_role: VerificationRole
  status: VerificationStatus
  full_name?: string | null
  nickname?: string | null
  identity_type?: IdentityType | null
  identity_number?: string | null
  identity_expiry?: string | null
  nationality?: string | null
  birth_place?: string | null
  birth_date?: string | null
  gender?: 'male' | 'female' | null
  marital_status?: string | null
  occupation?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  company_name?: string | null
  agency_license?: string | null
  npwp?: string | null
  address?: string | null
  rt_rw?: string | null
  village?: string | null
  district?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  bank_name?: string | null
  bank_account_number?: string | null
  bank_account_name?: string | null
  emergency_name?: string | null
  emergency_phone?: string | null
  domicile_same_as_ktp?: boolean | null
  ktp_address?: string | null
  ktp_city?: string | null
  ktp_province?: string | null
  identity_doc_path?: string | null
  selfie_doc_path?: string | null
  npwp_doc_path?: string | null
  supporting_doc_path?: string | null
  agreement_id?: string | null
  agreement_version?: string | null
  agreement_signed_at?: string | null
  availability?: AvailabilityEntry[] | null
  notes?: string | null
  submitted_at?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  reviewer_note?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const VERIFICATION_BUCKET = 'verification-docs'
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
/** Batas khusus foto identitas (KTP/SIM) & selfie — maksimal 1 MB sesuai permintaan. */
export const MAX_IDENTITY_UPLOAD_BYTES = 1 * 1024 * 1024

export const NATIONALITY_OPTIONS = ['Indonesia', 'Warga Negara Asing']

/** Format ukuran berkas agar pesan validasi mudah dibaca (mis. "860 KB", "1 MB"). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1)} MB`
}

export const VERIFICATION_ROLES: { value: VerificationRole; label: string; short: string; blurb: string }[] = [
  {
    value: 'agent',
    label: 'Agen Properti',
    short: 'Agen',
    blurb: 'Memasarkan properti milik klien, mendampingi pembeli/penyewa, dan melaporkan setiap transaksi.',
  },
  {
    value: 'property_owner',
    label: 'Pemilik Properti',
    short: 'Pemilik',
    blurb: 'Memasang properti milik sendiri dan menyetujui komisi 0,5% untuk transaksi yang difasilitasi Homy.',
  },
]

export const IDENTITY_TYPES: { value: IdentityType; label: string; hint: string }[] = [
  { value: 'ktp', label: 'KTP', hint: 'Kartu Tanda Penduduk (16 digit)' },
  { value: 'sim', label: 'SIM', hint: 'Surat Izin Mengemudi (12–16 digit)' },
]

export const GENDER_OPTIONS: { value: 'male' | 'female'; label: string }[] = [
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
]

export const MARITAL_OPTIONS = ['Belum menikah', 'Menikah', 'Cerai hidup', 'Cerai mati']

export const AVAILABILITY_MODES: { value: AvailabilityMode; label: string }[] = [
  { value: 'onsite', label: 'Di lokasi' },
  { value: 'online', label: 'Online' },
  { value: 'both', label: 'Di lokasi / online' },
]

export const WEEKDAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const SLOT_OPTIONS = [30, 45, 60, 90, 120]

/** Default ketersediaan: Senin–Jumat 09:00–17:00, Sabtu 09:00–13:00, Minggu tutup. */
export function defaultAvailability(): AvailabilityEntry[] {
  return WEEKDAY_ORDER.map((weekday) => {
    const weekend = weekday === 0
    const saturday = weekday === 6
    return {
      weekday,
      is_active: !weekend,
      start_time: '09:00',
      end_time: saturday ? '13:00' : '17:00',
      slot_minutes: 60,
      mode: 'both' as AvailabilityMode,
      location: null,
      notes: null,
    }
  })
}

export const VERIFICATION_STEPS: { key: string; title: string; description: string }[] = [
  { key: 'role', title: 'Peran Mitra', description: 'Pilih peran yang ingin diverifikasi.' },
  { key: 'identity', title: 'Data Diri', description: 'Identitas, kontak, dan data usaha.' },
  { key: 'address', title: 'Alamat Domisili', description: 'Alamat tempat tinggal & alamat KTP.' },
  { key: 'documents', title: 'Dokumen', description: 'Unggah KTP/SIM, selfie, dan dokumen pendukung.' },
  { key: 'availability', title: 'Ketersediaan', description: 'Atur waktu survey & komunikasi.' },
  { key: 'agreement', title: 'Perjanjian', description: 'Lengkapi data, unggah KTP, lalu tanda tangani perjanjian.' },
  { key: 'review', title: 'Tinjau & Kirim', description: 'Periksa kembali lalu kirim ke admin.' },
]

export const VERIFICATION_STATUS_META: Record<
  VerificationStatus,
  { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger'; description: string }
> = {
  draft: {
    label: 'Draft',
    tone: 'neutral',
    description: 'Data belum lengkap. Lengkapi dan kirim untuk direview admin.',
  },
  pending: {
    label: 'Menunggu review admin',
    tone: 'warning',
    description: 'Tim Homy sedang memverifikasi data dan dokumen Anda (1–2 hari kerja).',
  },
  approved: {
    label: 'Terverifikasi',
    tone: 'success',
    description: 'Akun mitra Anda sudah aktif. Anda dapat memasang listing properti.',
  },
  rejected: {
    label: 'Perlu perbaikan',
    tone: 'danger',
    description: 'Admin meminta perbaikan data/dokumen. Silakan perbarui lalu kirim ulang.',
  },
}

/** Checklist kelengkapan untuk indikator progres + validasi sebelum submit. */
export type RequirementKey =
  | 'full_name' | 'identity_type' | 'identity_number' | 'birth_date' | 'gender' | 'phone'
  | 'address' | 'city' | 'province'
  | 'bank_name' | 'bank_account_number' | 'bank_account_name'
  | 'identity_doc' | 'selfie_doc'
  | 'availability'
  | 'agreement'

export function missingRequirements(record: Partial<VerificationRecord> | null | undefined): RequirementKey[] {
  const missing: RequirementKey[] = []
  if (!record) {
    return ['full_name', 'identity_type', 'identity_number', 'birth_date', 'gender', 'phone', 'address', 'city', 'province', 'bank_name', 'bank_account_number', 'bank_account_name', 'identity_doc', 'selfie_doc', 'availability', 'agreement']
  }
  const text = (value: unknown) => String(value ?? '').trim()
  if (text(record.full_name).length < 3) missing.push('full_name')
  if (!record.identity_type) missing.push('identity_type')
  if (text(record.identity_number).replace(/\D/g, '').length < 6) missing.push('identity_number')
  if (!text(record.birth_date)) missing.push('birth_date')
  if (!record.gender) missing.push('gender')
  if (text(record.phone).replace(/\D/g, '').length < 8) missing.push('phone')
  if (text(record.address).length < 5) missing.push('address')
  if (!text(record.city)) missing.push('city')
  if (!text(record.province)) missing.push('province')
  if (text(record.bank_name).length < 2) missing.push('bank_name')
  if (text(record.bank_account_number).replace(/\D/g, '').length < 6) missing.push('bank_account_number')
  if (text(record.bank_account_name).length < 3) missing.push('bank_account_name')
  if (!text(record.identity_doc_path)) missing.push('identity_doc')
  if (!text(record.selfie_doc_path)) missing.push('selfie_doc')
  const availability = Array.isArray(record.availability) ? record.availability.filter((row) => row?.is_active) : []
  if (!availability.length) missing.push('availability')
  if (!record.agreement_id && !record.agreement_signed_at) missing.push('agreement')
  return missing
}

export const REQUIREMENT_LABELS: Record<RequirementKey, string> = {
  full_name: 'Nama lengkap',
  identity_type: 'Jenis identitas',
  identity_number: 'Nomor identitas',
  birth_date: 'Tanggal lahir',
  gender: 'Jenis kelamin',
  phone: 'Nomor telepon',
  address: 'Alamat domisili',
  city: 'Kota/kabupaten',
  province: 'Provinsi',
  bank_name: 'Nama bank (rekening komisi)',
  bank_account_number: 'Nomor rekening komisi',
  bank_account_name: 'Nama pemilik rekening',
  identity_doc: 'Foto KTP/SIM (maks 1 MB)',
  selfie_doc: 'Selfie dengan identitas',
  availability: 'Ketersediaan waktu',
  agreement: 'Perjanjian kerja sama',
}

export function completionPercent(record: Partial<VerificationRecord> | null | undefined) {
  const total = Object.keys(REQUIREMENT_LABELS).length
  const missing = missingRequirements(record).length
  return Math.max(0, Math.min(100, Math.round(((total - missing) / total) * 100)))
}

export function isComplete(record: Partial<VerificationRecord> | null | undefined) {
  return missingRequirements(record).length === 0
}

/** Format tanggal Indonesia tanpa dependensi eksternal. */
export function formatDateId(value?: string | null) {
  const raw = String(value ?? '')
  if (!raw) return '—'
  const date = new Date(raw.length <= 10 ? raw + 'T00:00:00' : raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function formatDateTimeId(value?: string | null) {
  const raw = String(value ?? '')
  if (!raw) return '—'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'
}

export function storagePublicUrl(path?: string | null) {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base.replace(/\/$/, '')}/storage/v1/object/${VERIFICATION_BUCKET}/${path}`
}

export function fileExtension(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim())
  return match ? match[1].toLowerCase() : 'jpg'
}
