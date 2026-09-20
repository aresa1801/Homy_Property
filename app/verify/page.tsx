'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Briefcase, CalendarClock, Check, CheckCircle2,
  Clock, Download, FileSignature, FileText, Home, Loader2, Lock, LogOut, ShieldCheck, Upload, UserRound, X,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { UserAvatar } from '@/components/dashboard-shell'
import { createClient } from '@/lib/supabase/client'
import {
  AGREEMENT_CONSENTS,
  AGREEMENT_TITLE,
  AGREEMENT_VERSION,
  COMMISSION_RATE,
  buildAgreementClauses,
} from '@/lib/partner-agreement'
import {
  AVAILABILITY_MODES,
  GENDER_OPTIONS,
  IDENTITY_TYPES,
  MARITAL_OPTIONS,
  MAX_IDENTITY_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  NATIONALITY_OPTIONS,
  REQUIREMENT_LABELS,
  SLOT_OPTIONS,
  VERIFICATION_BUCKET,
  VERIFICATION_ROLES,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  defaultAvailability,
  fileExtension,
  formatBytes,
  formatDateTimeId,
  isComplete,
  missingRequirements,
  type AvailabilityEntry,
  type IdentityType,
  type VerificationRecord,
  type VerificationRole,
} from '@/lib/verification'

type DocSlot = {
  key: 'identity_doc_path' | 'selfie_doc_path' | 'npwp_doc_path' | 'supporting_doc_path'
  title: string
  hint: string
  required: boolean
  accept: string
  /** Batas ukuran per slot (default 5 MB). */
  maxBytes?: number
  /** Kompres otomatis di browser bila berkas melebihi batas (khusus foto identitas). */
  compress?: boolean
}

const DOC_SLOTS: DocSlot[] = [
  { key: 'identity_doc_path', title: 'Foto KTP / SIM', hint: 'Foto seluruh bagian kartu, tidak terpotong dan tidak silau. Maks 1 MB — otomatis dikompres bila lebih besar.', required: true, accept: 'image/jpeg,image/png,image/webp', maxBytes: MAX_IDENTITY_UPLOAD_BYTES, compress: true },
  { key: 'selfie_doc_path', title: 'Selfie dengan identitas', hint: 'Wajah Anda + kartu identitas dalam satu foto. Maks 1 MB — otomatis dikompres bila lebih besar.', required: true, accept: 'image/jpeg,image/png,image/webp', maxBytes: MAX_IDENTITY_UPLOAD_BYTES, compress: true },
  { key: 'npwp_doc_path', title: 'NPWP (opsional)', hint: 'Kartu NPWP pribadi/badan usaha bila ada. Maks 5 MB.', required: false, accept: 'image/jpeg,image/png,image/webp,application/pdf' },
  { key: 'supporting_doc_path', title: 'Dokumen pendukung (opsional)', hint: 'Surat kuasa pemasaran, izin usaha, atau dokumen lain (PDF/JPG). Maks 5 MB.', required: false, accept: 'image/jpeg,image/png,image/webp,application/pdf' },
]

/** Kompres foto identitas di sisi klien supaya muat dalam batas 1 MB. */
async function compressImageFile(file: File, limit: number): Promise<File | null> {
  if (typeof document === 'undefined' || !/^image\/(jpeg|png|webp)$/.test(file.type)) return null
  try {
    const source = await loadImageSource(file)
    if (!source) return null
    const maxSide = 2200
    const scale = Math.min(1, maxSide / Math.max(source.width, source.height))
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(source.image, 0, 0, width, height)
    for (const quality of [0.92, 0.85, 0.78, 0.7, 0.62, 0.55, 0.46, 0.38]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/jpeg', quality))
      if (blob && blob.size <= limit) return new File([blob], 'foto-identitas.jpg', { type: 'image/jpeg' })
    }
    return null
  } catch {
    return null
  }
}

async function loadImageSource(file: File): Promise<{ width: number; height: number; image: CanvasImageSource } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { width: bitmap.width, height: bitmap.height, image: bitmap }
    } catch {
      /* lanjut ke fallback <img> */
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight, image })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

const STEP_TITLES = ['Peran Mitra', 'Data Diri', 'Alamat Domisili', 'Dokumen Identitas', 'Ketersediaan Waktu', 'Perjanjian Kerja Sama', 'Tinjau & Kirim']

const emptyRecord = (role: VerificationRole): VerificationRecord => ({
  requested_role: role,
  status: 'draft',
  full_name: '',
  nickname: '',
  identity_type: 'ktp',
  identity_number: '',
  birth_place: '',
  birth_date: '',
  gender: undefined,
  marital_status: '',
  occupation: '',
  phone: '',
  whatsapp: '',
  email: '',
  company_name: '',
  agency_license: '',
  npwp: '',
  address: '',
  rt_rw: '',
  village: '',
  district: '',
  city: '',
  province: '',
  postal_code: '',
  nationality: 'Indonesia',
  identity_expiry: '',
  bank_name: '',
  bank_account_number: '',
  bank_account_name: '',
  emergency_name: '',
  emergency_phone: '',
  domicile_same_as_ktp: true,
  ktp_address: '',
  ktp_city: '',
  ktp_province: '',
  identity_doc_path: null,
  selfie_doc_path: null,
  npwp_doc_path: null,
  supporting_doc_path: null,
  availability: defaultAvailability(),
  notes: '',
})

const inputClass = 'mt-1.5 h-11 w-full rounded-lg border border-[#ddd3c5] bg-white px-3 text-sm outline-none focus:border-[#0b3d2e]'
const labelClass = 'block text-sm font-semibold text-[#33433d]'

export default function VerifyPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [role, setRole] = useState<VerificationRole | null>(null)
  const [record, setRecord] = useState<VerificationRecord | null>(null)
  const [records, setRecords] = useState<Record<string, VerificationRecord>>({})
  const [signedRoles, setSignedRoles] = useState<string[]>([])
  const [agreementRows, setAgreementRows] = useState<{ role: string; status?: string; agreement_version?: string; signed_at?: string; signature_serial?: string | null }[]>([])
  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [consents, setConsents] = useState<Record<string, boolean>>({})
  const [signature, setSignature] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [uploads, setUploads] = useState<Record<string, { name: string; busy: boolean }>>({})
  const [draftBusy, setDraftBusy] = useState(false)
  const [nextTarget, setNextTarget] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    let active = true
    const supabase = createClient() as any
    supabase.auth.getUser().then(async ({ data }: any) => {
      const user = data?.user
      if (!active) return
      if (!user) {
        window.location.replace('/auth/login?next=/verify')
        return
      }
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>
      setUserId(user.id)
      setEmail(user.email ?? '')
      setDisplayName(String(meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? ''))
      setAvatarUrl(String(meta.avatar_url ?? meta.picture ?? ''))
      try {
        const response = await fetch('/api/verify', { cache: 'no-store' })
        const payload = await response.json()
        const map = (payload?.verifications ?? {}) as Record<string, VerificationRecord>
        setRecords(map)
        setSignedRoles((payload?.agreements ?? []).filter((row: { status?: string }) => row?.status === 'active').map((row: { role: string }) => row.role))
        setAgreementRows(Array.isArray(payload?.agreements) ? payload.agreements : [])
        const params = new URLSearchParams(window.location.search)
        const requested = params.get('role')
        const rawNext = params.get('next')
        if (rawNext && rawNext.startsWith('/')) setNextTarget(rawNext)
        const initialRole: VerificationRole | null = requested === 'agent' || requested === 'property_owner' ? requested : null
        if (initialRole) {
          const existing = map[initialRole]
          setRole(initialRole)
          setRecord(existing ? { ...existing } : { ...emptyRecord(initialRole), full_name: String(meta.full_name ?? meta.name ?? ''), email: user.email ?? '', phone: String(meta.phone ?? '') })
          setSignature(existing?.full_name ? String(existing.full_name) : String(meta.full_name ?? meta.name ?? ''))
          setStep(existing ? 1 : 1)
          setMaxStep(existing ? 6 : 1)
        }
      } catch {
        setError('Gagal memuat data verifikasi. Periksa koneksi lalu muat ulang halaman.')
      } finally {
        if (active) setLoading(false)
      }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const availability = useMemo<AvailabilityEntry[]>(
    () => (Array.isArray(record?.availability) && record?.availability?.length ? record.availability : defaultAvailability()),
    [record?.availability],
  )

  const missing = useMemo(() => missingRequirements(record), [record])
  const percent = useMemo(() => {
    const total = Object.keys(REQUIREMENT_LABELS).length
    return Math.max(0, Math.min(100, Math.round(((total - missing.length) / total) * 100)))
  }, [missing])

  const agreementSigned = Boolean(record?.agreement_signed_at) || signedRoles.includes(String(role))
  const activeAgreement = agreementRows.find((row) => row.role === String(role))
  const agreementSerial = activeAgreement?.signature_serial ?? null
  const agreementStamp = activeAgreement?.signed_at ?? record?.agreement_signed_at ?? null

  function pickRole(nextRole: VerificationRole) {
    const existing = records[nextRole]
    setRole(nextRole)
    setStep(1)
    setMaxStep(existing ? 6 : 1)
    setSubmitted(false)
    setError(null)
    setNotice(null)
    setConsents({})
    if (existing) {
      setRecord({ ...existing })
      setSignature(String(existing.full_name ?? ''))
    } else {
      setRecord({ ...emptyRecord(nextRole), full_name: displayName, email })
      setSignature(displayName)
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('role', nextRole)
      window.history.replaceState(null, '', url.toString())
    }
  }

  function patch(updates: Partial<VerificationRecord>) {
    setRecord((current) => ({ ...(current ?? emptyRecord(role ?? 'agent')), ...updates }))
  }

  function patchAvailability(weekday: number, updates: Partial<AvailabilityEntry>) {
    const list = availability.map((row) => (row.weekday === weekday ? { ...row, ...updates } : row))
    patch({ availability: list })
  }

  async function persist(action: 'save' | 'submit') {
    if (!role || !record) return null
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_role: role, action, data: { ...record, availability } }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(String(payload?.error ?? 'Gagal menyimpan data verifikasi.'))
        if (Array.isArray(payload?.missing) && payload.missing.length) {
          setStep(missingStepFor(payload.missing))
        }
        return null
      }
      const saved = (payload?.record ?? null) as VerificationRecord | null
      if (saved) {
        setRecord({ ...saved, availability: saved.availability ?? availability })
        setRecords((current) => ({ ...current, [role]: { ...saved } }))
      }
      if (action === 'submit') {
        setSubmitted(true)
      } else {
        setNotice('Draft tersimpan. Anda bisa melanjutkan kapan saja.')
      }
      return saved
    } catch {
      setError('Terjadi gangguan jaringan. Coba lagi.')
      return null
    } finally {
      setBusy(false)
    }
  }

  function missingStepFor(keys: string[]) {
    const order: Record<string, number> = {
      full_name: 1, identity_type: 1, identity_number: 1, birth_date: 1, gender: 1, phone: 1,
      bank_name: 1, bank_account_number: 1, bank_account_name: 1,
      address: 2, city: 2, province: 2,
      identity_doc: 3, selfie_doc: 3,
      availability: 4,
      agreement: 5,
    }
    return keys.reduce((lowest, key) => Math.min(lowest, order[key] ?? 1), 6)
  }

  async function goNext() {
    if (step === 3 && !(record?.identity_doc_path && record?.selfie_doc_path)) {
      setError('Unggah foto KTP/SIM dan selfie dengan identitas terlebih dahulu.')
      return
    }
    if (step === 4 && !availability.some((row) => row.is_active)) {
      setError('Aktifkan minimal satu hari ketersediaan waktu.')
      return
    }
    await persist('save')
    const next = Math.min(step + 1, 6)
    setStep(next)
    setMaxStep((current) => Math.max(current, next))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    setError(null)
    setStep((current) => Math.max(0, current - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleUpload(slot: DocSlot, file: File | null) {
    if (!file || !role) return
    const limit = slot.maxBytes ?? MAX_UPLOAD_BYTES
    setError(null)
    setUploads((current) => ({ ...current, [slot.key]: { name: file.name, busy: true } }))
    try {
      let payload: Blob | File = file
      let payloadName = file.name
      let payloadType = file.type || 'image/jpeg'
      let compressedFrom: number | null = null
      if (file.size > limit && slot.compress) {
        const compressed = await compressImageFile(file, limit)
        if (compressed) {
          compressedFrom = file.size
          payload = compressed
          payloadName = compressed.name
          payloadType = compressed.type
        }
      }
      if (payload.size > limit) {
        throw new Error(`ukuran ${formatBytes(payload.size)} melebihi batas ${formatBytes(limit)}`)
      }
      const supabase = createClient() as any
      const path = `${userId}/${slot.key}-${Date.now()}.${fileExtension(payloadName)}`
      const { error: uploadError } = await supabase.storage
        .from(VERIFICATION_BUCKET)
        .upload(path, payload, { upsert: true, contentType: payloadType, cacheControl: '3600' })
      if (uploadError) throw new Error(uploadError.message)
      patch({ [slot.key]: path } as Partial<VerificationRecord>)
      setUploads((current) => ({ ...current, [slot.key]: { name: payloadName, busy: false } }))
      setNotice(
        compressedFrom
          ? `${slot.title} berhasil diunggah (dikompres otomatis dari ${formatBytes(compressedFrom)} ke ${formatBytes(payload.size)}).`
          : `${slot.title} berhasil diunggah.`,
      )
    } catch (uploadFailure) {
      setUploads((current) => ({ ...current, [slot.key]: { name: '', busy: false } }))
      setError(`${slot.title} gagal diunggah: ${uploadFailure instanceof Error ? uploadFailure.message : 'coba lagi'}`)
    }
  }

  async function viewDocument(path: string) {
    try {
      const supabase = createClient() as any
      const { data, error: signError } = await supabase.storage.from(VERIFICATION_BUCKET).createSignedUrl(path, 600)
      if (signError || !data?.signedUrl) throw new Error(signError?.message ?? 'Tidak bisa membuka berkas')
      window.open(data.signedUrl, '_blank', 'noopener')
    } catch (viewFailure) {
      setError(viewFailure instanceof Error ? viewFailure.message : 'Tidak bisa membuka berkas')
    }
  }

  async function downloadDraft() {
    if (!role || !record) return
    setDraftBusy(true)
    setError(null)
    setNotice(null)
    try {
      const saved = await persist('save')
      if (!saved) return
      setNotice('Draf Perjanjian sedang dibuat — unduhan akan dimulai otomatis.')
      window.location.assign(`/api/agreement/draft?role=${role}`)
    } catch {
      setError('Gagal membuat draf perjanjian. Coba lagi.')
    } finally {
      setDraftBusy(false)
    }
  }

  async function signAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!role || !record) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/verify/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_role: role, signature_name: signature, consents }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(String(payload?.error ?? 'Gagal menandatangani perjanjian.'))
        return
      }
      const saved = await persist('save')
      patch({
        agreement_id: String(payload?.agreement?.id ?? saved?.agreement_id ?? 'signed'),
        agreement_signed_at: String(payload?.agreement?.signed_at ?? new Date().toISOString()),
        agreement_version: AGREEMENT_VERSION,
      })
      setSignedRoles((current) => (role && !current.includes(role) ? [...current, role] : current))
      if (payload?.agreement) {
        const savedRow = payload.agreement as { role?: string; signed_at?: string; signature_serial?: string | null; agreement_version?: string }
        setAgreementRows((current) => [
          ...current.filter((row) => row.role !== role),
          { role: String(role), status: 'active', signed_at: savedRow.signed_at, signature_serial: savedRow.signature_serial ?? null, agreement_version: savedRow.agreement_version ?? AGREEMENT_VERSION },
        ])
      }
      setNotice('Perjanjian berhasil ditandatangani. Salinan PDF dapat diunduh di bawah.')
    } catch {
      setError('Terjadi gangguan jaringan saat menandatangani perjanjian.')
    } finally {
      setBusy(false)
    }
  }

  async function submitApplication() {
    const saved = await persist('submit')
    if (saved) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function signOut() {
    createClient().auth.signOut().finally(() => window.location.assign('/'))
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f3ec] text-[#0b3d2e]">
        <span className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin" /> Memuat data verifikasi...</span>
      </main>
    )
  }

  const status = record?.status ?? 'draft'

  // ---------- Layar status (menunggu / terverifikasi) ----------
  if (role && (status === 'approved' || (submitted && status === 'pending'))) {
    const approved = status === 'approved'
    return (
      <main className="min-h-screen bg-[#f7f3ec] px-4 py-8 text-[#1c1c1c] sm:px-8">
        <div className="mx-auto max-w-3xl">
          <BrandMark height={40} />
          <div className="mt-8 rounded-3xl border border-[#e8dfd3] bg-white p-6 sm:p-10">
            <span className={`grid size-14 place-items-center rounded-2xl ${approved ? 'bg-[#e2eee7] text-[#0b3d2e]' : 'bg-[#fff7e3] text-[#c09b54]'}`}>
              {approved ? <BadgeCheck /> : <Clock />}
            </span>
            <h1 className="mt-6 font-serif text-2xl text-[#0b3d2e] sm:text-4xl">
              {approved ? 'Selamat, akun mitra Anda aktif!' : 'Pengajuan verifikasi sudah dikirim'}
            </h1>
            <p className="mt-4 leading-7 text-[#65706c]">
              {approved
                ? `Data Anda sebagai ${role === 'agent' ? 'Agen Properti' : 'Pemilik Properti'} telah diverifikasi admin Homy. Anda dapat mulai memasang listing properti.`
                : 'Tim Homy sedang memeriksa data dan dokumen Anda (estimasi 1–2 hari kerja). Kami akan mengirim notifikasi begitu verifikasi selesai.'}
            </p>

            <dl className="mt-6 grid gap-3 rounded-2xl bg-[#f7f3ec] p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-[#718078]">Nama mitra</dt><dd className="font-semibold text-[#0b3d2e]">{record?.full_name || '—'}</dd></div>
              <div><dt className="text-[#718078]">Peran</dt><dd className="font-semibold text-[#0b3d2e]">{role === 'agent' ? 'Agen Properti' : 'Pemilik Properti'}</dd></div>
              <div><dt className="text-[#718078]">Dikirim</dt><dd className="font-semibold text-[#0b3d2e]">{formatDateTimeId(record?.submitted_at)}</dd></div>
              <div><dt className="text-[#718078]">Perjanjian</dt><dd className="font-semibold text-[#0b3d2e]">{agreementSigned ? `Ditandatangani (${record?.agreement_version ?? AGREEMENT_VERSION})` : 'Belum'}</dd></div>
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              {nextTarget && (
                <a href={nextTarget} className="inline-flex items-center gap-2 rounded-full bg-[#0b3d2e] px-6 py-3 text-sm font-semibold text-white hover:bg-[#14553f]">
                  Lanjut ke {nextTarget} <ArrowRight className="size-4" />
                </a>
              )}
              {approved ? (
                <>
                  <a href="/list" className="inline-flex items-center gap-2 rounded-full bg-[#0b3d2e] px-6 py-3 text-sm font-semibold text-white hover:bg-[#14553f]">
                    <Home className="size-4" /> Pasang listing properti
                  </a>
                  <a href={`/dashboard/${role === 'agent' ? 'agent' : 'property-owner'}`} className="inline-flex items-center gap-2 rounded-full border border-[#d8ccbb] px-6 py-3 text-sm font-semibold text-[#33433d] hover:border-[#c9a961]">
                    Lewati dulu — ke dasbor mitra
                  </a>
                </>
              ) : (
                <>
                  <a href={`/dashboard/${role === 'agent' ? 'agent' : 'property-owner'}`} className="inline-flex items-center gap-2 rounded-full bg-[#0b3d2e] px-6 py-3 text-sm font-semibold text-white hover:bg-[#14553f]">
                    Lihat status di dasbor
                  </a>
                  <button type="button" onClick={() => { setSubmitted(false); setStep(1); setMaxStep(6) }} className="rounded-full border border-[#d8ccbb] px-6 py-3 text-sm font-semibold text-[#33433d] hover:border-[#c9a961]">
                    Perbarui data
                  </button>
                </>
              )}
              <a href={`/api/agreement/pdf?role=${role}`} className="inline-flex items-center gap-2 rounded-full border border-[#d8ccbb] px-6 py-3 text-sm font-semibold text-[#33433d] hover:border-[#c9a961]">
                <Download className="size-4" /> Unduh perjanjian (PDF)
              </a>
              <a href={`/api/agreement/draft?role=${role}`} className="inline-flex items-center gap-2 rounded-full border border-[#d8ccbb] px-6 py-3 text-sm font-semibold text-[#33433d] hover:border-[#c9a961]">
                <FileText className="size-4" /> Unduh draft (PDF)
              </a>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const clauses = role ? buildAgreementClauses(role) : []

  return (
    <main className="min-h-screen bg-[#f7f3ec] px-4 py-7 text-[#1c1c1c] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BrandMark height={38} />
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[#e5dccd] bg-white p-1 pr-3 sm:flex">
              <UserAvatar name={displayName} email={email} avatarUrl={avatarUrl} size={32} />
              <span className="max-w-[10rem] truncate text-sm font-semibold text-[#0b3d2e]">{displayName || email}</span>
            </div>
            <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 rounded-full border border-[#e5dccd] bg-white px-3 py-2 text-xs font-semibold text-[#33433d] hover:border-[#c9a961]">
              <LogOut className="size-3.5" /> Keluar
            </button>
          </div>
        </div>

        <div className="mt-8 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#c09b54]">Verifikasi Mitra Homy</p>
          <h1 className="mt-3 font-serif text-2xl leading-tight text-[#0b3d2e] sm:text-4xl">Pengajuan Agen &amp; Pemilik Properti</h1>
          <p className="mt-4 text-[#65706c]">
            Lengkapi data diri, dokumen identitas, dan ketersediaan waktu Anda. Setelah data lengkap, Anda akan diarahkan
            menandatangani <strong className="text-[#0b3d2e]">{AGREEMENT_TITLE}</strong> dan mengirim pengajuan ke admin Homy.
          </p>
        </div>

        {role && (
          <div className="mt-6 rounded-2xl border border-[#e8dfd3] bg-white p-4">
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold text-[#0b3d2e]">Kelengkapan data</p>
              <span className="font-semibold text-[#9a783c]">{percent}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#efe8dc]">
              <div className="h-full rounded-full bg-[#0b3d2e] transition-all" style={{ width: `${percent}%` }} />
            </div>
            {missing.length > 0 && (
              <p className="mt-2 text-xs text-[#718078]">Kurang: {missing.map((key) => REQUIREMENT_LABELS[key]).join(', ')}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {STEP_TITLES.map((title, index) => {
                const reachable = index <= Math.max(maxStep, step)
                const done = index < step && (index === 0 || index !== 5 || agreementSigned)
                return (
                  <button
                    key={title}
                    type="button"
                    disabled={!reachable || !role}
                    onClick={() => { setStep(index); setError(null) }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      index === step ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white' : done ? 'border-[#bfd8cb] bg-[#eef5f0] text-[#0b3d2e]' : 'border-[#e5dccd] bg-white text-[#718078]'
                    } ${reachable ? '' : 'opacity-50'}`}
                  >
                    {index + 1}. {title}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {notice && <p className="mt-5 rounded-xl bg-[#e2eee7] p-4 text-sm text-[#0b3d2e]" role="status">{notice}</p>}
        {error && (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-[#fbeeec] p-4 text-sm text-[#a4443a]" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}

        <div className="mt-6 rounded-3xl border border-[#e8dfd3] bg-white p-5 sm:p-8">
          {/* STEP 0 — pilih peran */}
          {step === 0 && (
            <div>
              <h2 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Pilih peran yang ingin Anda verifikasi</h2>
              <p className="mt-2 text-sm text-[#718078]">Satu akun dapat memverifikasi kedua peran; proses dijalankan terpisah untuk setiap peran.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {VERIFICATION_ROLES.map((option) => {
                  const existing = records[option.value]
                  const Icon = option.value === 'agent' ? Briefcase : Home
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => pickRole(option.value)}
                      className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:border-[#c9a961] ${role === option.value ? 'border-[#0b3d2e] bg-[#f7f3ec]' : 'border-[#e5dccd] bg-white'}`}
                    >
                      <span className="grid size-11 place-items-center rounded-xl bg-[#edf2ed] text-[#0b3d2e]"><Icon /></span>
                      <h3 className="mt-4 font-serif text-lg text-[#0b3d2e]">{option.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#65706c]">{option.blurb}</p>
                      {existing && (
                        <span className="mt-3 inline-block rounded-full bg-[#fff7e3] px-3 py-1 text-xs font-semibold text-[#9a783c]">
                          Status: {existing.status === 'approved' ? 'terverifikasi' : existing.status === 'pending' ? 'menunggu review' : existing.status === 'rejected' ? 'perlu perbaikan' : 'draft'}
                        </span>
                      )}
                      <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-[#9a783c]">
                        {existing ? 'Lanjutkan pengisian' : 'Mulai pengisian'} <ArrowRight className="size-4" />
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-6 rounded-2xl bg-[#f7f3ec] p-4 text-sm text-[#65706c]">
                <p className="flex items-center gap-2 font-semibold text-[#0b3d2e]"><Lock className="size-4" /> Data Anda aman</p>
                <p className="mt-2">Dokumen identitas disimpan di penyimpanan privat dan hanya dapat dibuka oleh Anda serta tim verifikasi Homy.</p>
              </div>
            </div>
          )}

          {/* STEP 1 — data diri */}
          {step === 1 && record && (
            <div>
              <h2 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Data Diri</h2>
              <p className="mt-2 text-sm text-[#718078]">Isi sesuai kartu identitas. Data ini dipakai pada Perjanjian Kerja Sama.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>Nama lengkap *
                  <input className={inputClass} value={String(record.full_name ?? '')} onChange={(e) => patch({ full_name: e.target.value })} placeholder="Sesuai KTP/SIM" />
                </label>
                <label className={labelClass}>Nama panggilan
                  <input className={inputClass} value={String(record.nickname ?? '')} onChange={(e) => patch({ nickname: e.target.value })} />
                </label>
                <div className={labelClass}>
                  Jenis identitas *
                  <div className="mt-1.5 flex gap-2">
                    {IDENTITY_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => patch({ identity_type: type.value as IdentityType })}
                        className={`h-11 flex-1 rounded-lg border text-sm font-semibold ${record.identity_type === type.value ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white' : 'border-[#ddd3c5] bg-white text-[#33433d]'}`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className={labelClass}>Nomor identitas *
                  <input className={inputClass} inputMode="numeric" value={String(record.identity_number ?? '')} onChange={(e) => patch({ identity_number: e.target.value.replace(/[^0-9]/g, '').slice(0, 20) })} placeholder="16 digit" />
                </label>
                <label className={labelClass}>Tempat lahir
                  <input className={inputClass} value={String(record.birth_place ?? '')} onChange={(e) => patch({ birth_place: e.target.value })} />
                </label>
                <label className={labelClass}>Tanggal lahir *
                  <input type="date" className={inputClass} value={String(record.birth_date ?? '').slice(0, 10)} onChange={(e) => patch({ birth_date: e.target.value })} />
                </label>
                <div className={labelClass}>
                  Jenis kelamin *
                  <div className="mt-1.5 flex gap-2">
                    {GENDER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => patch({ gender: option.value })}
                        className={`h-11 flex-1 rounded-lg border text-sm font-semibold ${record.gender === option.value ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white' : 'border-[#ddd3c5] bg-white text-[#33433d]'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className={labelClass}>Status perkawinan
                  <select className={inputClass} value={String(record.marital_status ?? '')} onChange={(e) => patch({ marital_status: e.target.value })}>
                    <option value="">Pilih…</option>
                    {MARITAL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className={labelClass}>Pekerjaan
                  <input className={inputClass} value={String(record.occupation ?? '')} onChange={(e) => patch({ occupation: e.target.value })} />
                </label>
                <label className={labelClass}>Nomor telepon *
                  <input className={inputClass} inputMode="tel" value={String(record.phone ?? '')} onChange={(e) => patch({ phone: e.target.value })} placeholder="08xxxxxxxxxx" />
                </label>
                <label className={labelClass}>WhatsApp
                  <input className={inputClass} inputMode="tel" value={String(record.whatsapp ?? '')} onChange={(e) => patch({ whatsapp: e.target.value })} />
                </label>
                <label className={labelClass}>Email
                  <input className={inputClass} value={String(record.email ?? '')} onChange={(e) => patch({ email: e.target.value })} />
                </label>
                {role === 'agent' && (
                  <>
                    <label className={labelClass}>Nama agensi / badan usaha
                      <input className={inputClass} value={String(record.company_name ?? '')} onChange={(e) => patch({ company_name: e.target.value })} />
                    </label>
                    <label className={labelClass}>Nomor izin keagenan
                      <input className={inputClass} value={String(record.agency_license ?? '')} onChange={(e) => patch({ agency_license: e.target.value })} />
                    </label>
                    <label className={labelClass}>NPWP
                      <input className={inputClass} value={String(record.npwp ?? '')} onChange={(e) => patch({ npwp: e.target.value })} />
                    </label>
                  </>
                )}

                <div className="rounded-2xl border border-[#e5dccd] bg-[#fdfcfa] p-4 sm:col-span-2">
                  <p className="text-sm font-semibold text-[#0b3d2e]">Data pendukung perjanjian</p>
                  <p className="mt-1 text-xs text-[#718078]">Dipakai pada Draft &amp; Perjanjian Kerja Sama (rekening komisi &amp; kontak darurat) serta lampiran identitas.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>Kewarganegaraan *
                      <select className={inputClass} value={String(record.nationality ?? 'Indonesia')} onChange={(e) => patch({ nationality: e.target.value })}>
                        {NATIONALITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className={labelClass}>Masa berlaku identitas
                      <input type="date" className={inputClass} value={String(record.identity_expiry ?? '').slice(0, 10)} onChange={(e) => patch({ identity_expiry: e.target.value })} />
                    </label>
                    <label className={labelClass}>Nama bank *
                      <input className={inputClass} value={String(record.bank_name ?? '')} onChange={(e) => patch({ bank_name: e.target.value })} placeholder="mis. BCA, Mandiri, BNI" />
                    </label>
                    <label className={labelClass}>Nomor rekening *
                      <input className={inputClass} inputMode="numeric" value={String(record.bank_account_number ?? '')} onChange={(e) => patch({ bank_account_number: e.target.value.replace(/[^0-9]/g, '').slice(0, 26) })} placeholder="Nomor rekening komisi" />
                    </label>
                    <label className={labelClass}>Nama pemilik rekening *
                      <input className={inputClass} value={String(record.bank_account_name ?? '')} onChange={(e) => patch({ bank_account_name: e.target.value })} placeholder="Sesuai buku tabungan" />
                    </label>
                    <label className={labelClass}>Nama kontak darurat
                      <input className={inputClass} value={String(record.emergency_name ?? '')} onChange={(e) => patch({ emergency_name: e.target.value })} placeholder="Nama keluarga/kerabat" />
                    </label>
                    <label className={labelClass}>Telepon kontak darurat
                      <input className={inputClass} inputMode="tel" value={String(record.emergency_phone ?? '')} onChange={(e) => patch({ emergency_phone: e.target.value })} placeholder="08xxxxxxxxxx" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — alamat domisili */}
          {step === 2 && record && (
            <div>
              <h2 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Alamat Domisili</h2>
              <p className="mt-2 text-sm text-[#718078]">Alamat tempat tinggal Anda saat ini, bukan alamat properti yang dipasarkan.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className={`${labelClass} sm:col-span-2`}>Alamat lengkap *
                  <textarea rows={3} className="mt-1.5 w-full rounded-lg border border-[#ddd3c5] bg-white p-3 text-sm outline-none focus:border-[#0b3d2e]" value={String(record.address ?? '')} onChange={(e) => patch({ address: e.target.value })} placeholder="Jalan, nomor rumah, RT/RW" />
                </label>
                <label className={labelClass}>RT / RW
                  <input className={inputClass} value={String(record.rt_rw ?? '')} onChange={(e) => patch({ rt_rw: e.target.value })} placeholder="004/007" />
                </label>
                <label className={labelClass}>Kelurahan / desa
                  <input className={inputClass} value={String(record.village ?? '')} onChange={(e) => patch({ village: e.target.value })} />
                </label>
                <label className={labelClass}>Kecamatan
                  <input className={inputClass} value={String(record.district ?? '')} onChange={(e) => patch({ district: e.target.value })} />
                </label>
                <label className={labelClass}>Kota / kabupaten *
                  <input className={inputClass} value={String(record.city ?? '')} onChange={(e) => patch({ city: e.target.value })} />
                </label>
                <label className={labelClass}>Provinsi *
                  <input className={inputClass} value={String(record.province ?? '')} onChange={(e) => patch({ province: e.target.value })} />
                </label>
                <label className={labelClass}>Kode pos
                  <input className={inputClass} inputMode="numeric" value={String(record.postal_code ?? '')} onChange={(e) => patch({ postal_code: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })} />
                </label>
              </div>
              <label className="mt-6 flex items-start gap-3 rounded-xl bg-[#f7f3ec] p-4 text-sm">
                <input type="checkbox" className="mt-1" checked={Boolean(record.domicile_same_as_ktp)} onChange={(e) => patch({ domicile_same_as_ktp: e.target.checked })} />
                <span><strong className="text-[#0b3d2e]">Alamat domisili sama dengan alamat KTP.</strong><br /><span className="text-[#718078]">Hilangkan centang bila domisili berbeda, lalu isi alamat KTP di bawah.</span></span>
              </label>
              {!record.domicile_same_as_ktp && (
                <div className="mt-4 grid gap-4 rounded-2xl border border-[#eee5d8] p-4 sm:grid-cols-2">
                  <label className={`${labelClass} sm:col-span-2`}>Alamat sesuai KTP
                    <textarea rows={2} className="mt-1.5 w-full rounded-lg border border-[#ddd3c5] bg-white p-3 text-sm outline-none focus:border-[#0b3d2e]" value={String(record.ktp_address ?? '')} onChange={(e) => patch({ ktp_address: e.target.value })} />
                  </label>
                  <label className={labelClass}>Kota/kabupaten (KTP)
                    <input className={inputClass} value={String(record.ktp_city ?? '')} onChange={(e) => patch({ ktp_city: e.target.value })} />
                  </label>
                  <label className={labelClass}>Provinsi (KTP)
                    <input className={inputClass} value={String(record.ktp_province ?? '')} onChange={(e) => patch({ ktp_province: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — dokumen */}
          {step === 3 && record && (
            <div>
              <h2 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Dokumen Identitas</h2>
              <p className="mt-2 text-sm text-[#718078]">Foto KTP/SIM dan selfie maksimal 1 MB (otomatis dikompres bila lebih besar) · dokumen lain maksimal 5 MB. Berkas disimpan privat.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {DOC_SLOTS.map((slot) => {
                  const path = record[slot.key] as string | null | undefined
                  const upload = uploads[slot.key]
                  return (
                    <div key={slot.key} className={`rounded-2xl border p-4 ${path ? 'border-[#bfd8cb] bg-[#f4faf6]' : 'border-[#e5dccd] bg-white'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[#0b3d2e]">{slot.title} {slot.required && <span className="text-[#b45c50]">*</span>}</p>
                          <p className="mt-1 text-xs text-[#718078]">{slot.hint}</p>
                        </div>
                        {path && <CheckCircle2 className="size-5 shrink-0 text-[#4e866d]" />}
                      </div>
                      <input
                        ref={(element) => { fileInputs.current[slot.key] = element }}
                        type="file"
                        accept={slot.accept}
                        className="hidden"
                        onChange={(e) => handleUpload(slot, e.target.files?.[0] ?? null)}
                      />
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => fileInputs.current[slot.key]?.click()} className="inline-flex items-center gap-2 rounded-full border border-[#d8ccbb] px-4 py-2 text-xs font-semibold text-[#33433d] hover:border-[#c9a961]">
                          {upload?.busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {path ? 'Ganti berkas' : 'Pilih berkas'}
                        </button>
                        {path && (
                          <button type="button" onClick={() => viewDocument(path)} className="text-xs font-semibold text-[#9a783c] underline">
                            Lihat berkas
                          </button>
                        )}
                      </div>
                      {upload?.name && <p className="mt-2 truncate text-xs text-[#718078]">{upload.name}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 4 — ketersediaan */}
          {step === 4 && (
            <div>
              <h2 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Ketersediaan Waktu</h2>
              <p className="mt-2 text-sm text-[#718078]">Jadwal ini dipakai pengguna untuk mengajukan jadwal survey dan komunikasi dengan Anda.</p>
              <div className="mt-6 space-y-3">
                {WEEKDAY_ORDER.map((weekday) => {
                  const row = availability.find((item) => item.weekday === weekday) ?? defaultAvailability().find((item) => item.weekday === weekday)!
                  return (
                    <div key={weekday} className={`rounded-2xl border p-4 ${row.is_active ? 'border-[#e5dccd] bg-white' : 'border-[#eee5d8] bg-[#faf8f4]'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-3 text-sm font-semibold text-[#0b3d2e]">
                          <input type="checkbox" checked={row.is_active} onChange={(e) => patchAvailability(weekday, { is_active: e.target.checked })} />
                          {WEEKDAY_LABELS[weekday]}
                        </label>
                        {row.is_active && (
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <input type="time" value={row.start_time} onChange={(e) => patchAvailability(weekday, { start_time: e.target.value })} className="h-10 rounded-lg border border-[#ddd3c5] px-2" />
                            <span className="text-[#718078]">s/d</span>
                            <input type="time" value={row.end_time} onChange={(e) => patchAvailability(weekday, { end_time: e.target.value })} className="h-10 rounded-lg border border-[#ddd3c5] px-2" />
                            <select value={row.slot_minutes} onChange={(e) => patchAvailability(weekday, { slot_minutes: Number(e.target.value) })} className="h-10 rounded-lg border border-[#ddd3c5] px-2">
                              {SLOT_OPTIONS.map((slot) => <option key={slot} value={slot}>slot {slot} menit</option>)}
                            </select>
                            <select value={row.mode} onChange={(e) => patchAvailability(weekday, { mode: e.target.value as AvailabilityEntry['mode'] })} className="h-10 rounded-lg border border-[#ddd3c5] px-2">
                              {AVAILABILITY_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                      {row.is_active && (
                        <input
                          className="mt-3 h-10 w-full rounded-lg border border-[#ddd3c5] px-3 text-sm"
                          placeholder="Lokasi pertemuan / catatan (opsional)"
                          value={row.location ?? ''}
                          onChange={(e) => patchAvailability(weekday, { location: e.target.value })}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#f7f3ec] p-3 text-xs text-[#718078]">
                <CalendarClock className="size-4" /> Waktu ditampilkan dalam WIB (GMT+7). Minimal satu hari harus aktif.
              </p>
            </div>
          )}

          {/* STEP 5 — perjanjian */}
          {step === 5 && role && (
            <div>
              <h2 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">{AGREEMENT_TITLE}</h2>
              <p className="mt-2 text-sm text-[#718078]">
                Versi {AGREEMENT_VERSION} · Komisi Homy {COMMISSION_RATE}% dari harga jual final. Baca seluruh pasal berikut sebelum menandatangani.
              </p>
              <div className="mt-5 rounded-2xl border border-[#e5dccd] bg-[#fdfcfa] p-4">
                <p className="flex items-center gap-2 font-semibold text-[#0b3d2e]"><FileText className="size-4" /> Draft Perjanjian siap diunduh</p>
                <p className="mt-1 text-sm text-[#65706c]">
                  Sistem merangkum seluruh data diri Anda ke dalam <strong>Draft Perjanjian</strong> berformat PDF — lengkap dengan nomor serial draf (mis.
                  DRF/AGN/…), timestamp WIB, tanda air “DRAFT”, dan salinan KTP pada lampiran. Draf belum sah; versi final bertanda tangan diterbitkan setelah Anda menandatangani.
                </p>
                <button
                  type="button"
                  onClick={downloadDraft}
                  disabled={draftBusy || busy || !record?.identity_doc_path}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#0b3d2e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14553f] disabled:opacity-50"
                >
                  {draftBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Unduh Draft Perjanjian (PDF)
                </button>
                {!record?.identity_doc_path && <p className="mt-2 text-xs text-[#9a783c]">Unggah foto KTP/SIM dulu di langkah “Dokumen Identitas” agar salinan identitas ikut masuk lampiran.</p>}
              </div>
              <div className="mt-5 max-h-[26rem] overflow-y-auto rounded-2xl border border-[#eee5d8] bg-[#fdfcfa] p-4 text-sm leading-7 text-[#3f4b46]">
                {clauses.map((clause) => (
                  <section key={clause.title} className="mb-5">
                    <h3 className="font-serif text-base text-[#0b3d2e]">{clause.title}</h3>
                    {clause.paragraphs?.map((paragraph) => <p key={paragraph.slice(0, 40)} className="mt-2">{paragraph}</p>)}
                    {clause.items?.length ? (
                      <ul className="mt-2 space-y-1.5 pl-4">
                        {clause.items.map((item) => <li key={item.slice(0, 40)} className="list-disc">{item}</li>)}
                      </ul>
                    ) : null}
                  </section>
                ))}
              </div>

              {agreementSigned ? (
                <div className="mt-6 rounded-2xl border border-[#bfd8cb] bg-[#f4faf6] p-4">
                  <p className="flex items-center gap-2 font-semibold text-[#0b3d2e]"><BadgeCheck className="size-4" /> Perjanjian sudah ditandatangani</p>
                  <p className="mt-2 text-sm text-[#65706c]">Ditandatangani pada {formatDateTimeId(agreementStamp)} · versi {record?.agreement_version ?? AGREEMENT_VERSION}</p>
                  <dl className="mt-3 space-y-1 text-xs text-[#65706c]">
                    <div className="flex justify-between gap-3"><dt>Serial tanda tangan</dt><dd className="font-mono font-semibold text-[#0b3d2e]">{agreementSerial ?? '—'}</dd></div>
                    <div className="flex justify-between gap-3"><dt>Timestamp</dt><dd className="text-[#3f4b46]">{formatDateTimeId(agreementStamp)} WIB</dd></div>
                  </dl>
                  <a href={`/api/agreement/pdf?role=${role}`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#0b3d2e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14553f]">
                    <Download className="size-4" /> Unduh PDF perjanjian
                  </a>
                </div>
              ) : (
                <form onSubmit={signAgreement} className="mt-6 space-y-3">
                  {AGREEMENT_CONSENTS.map((consent) => (
                    <label key={consent.key} className="flex items-start gap-3 rounded-xl border border-[#eee5d8] p-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(consents[consent.key])}
                        onChange={(e) => setConsents((current) => ({ ...current, [consent.key]: e.target.checked }))}
                      />
                      <span className="text-[#3f4b46]">{consent.label}</span>
                    </label>
                  ))}
                  <label className={labelClass}>Tanda tangan digital (tulis nama lengkap) *
                    <input className={inputClass} value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={String(record?.full_name ?? 'Nama lengkap Anda')} />
                  </label>
                  <button
                    type="submit"
                    disabled={busy || AGREEMENT_CONSENTS.some((item) => !consents[item.key]) || signature.trim().toLowerCase() !== String(record?.full_name ?? '').trim().toLowerCase()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0b3d2e] px-6 py-3 text-sm font-semibold text-white hover:bg-[#14553f] disabled:opacity-50 sm:w-auto"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <FileSignature className="size-4" />} Tanda tangan &amp; simpan perjanjian
                  </button>
                </form>
              )}
            </div>
          )}

          {/* STEP 6 — review & kirim */}
          {step === 6 && record && (
            <div>
              <h2 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Tinjau &amp; Kirim</h2>
              <p className="mt-2 text-sm text-[#718078]">Periksa kembali data Anda. Setelah dikirim, admin Homy akan memverifikasi dalam 1–2 hari kerja.</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Summary title="Data diri" rows={[
                  ['Nama lengkap', String(record.full_name ?? '')],
                  ['Nama panggilan', String(record.nickname ?? '') || '—'],
                  ['Identitas', `${IDENTITY_TYPES.find((type) => type.value === record.identity_type)?.label ?? '-'} · ${record.identity_number ?? '-'}`],
                  ['Lahir', `${record.birth_place || '-'}, ${record.birth_date || '-'}`],
                  ['Jenis kelamin', GENDER_OPTIONS.find((option) => option.value === record.gender)?.label ?? '—'],
                  ['Telepon / WA', `${record.phone || '-'} / ${record.whatsapp || '-'}`],
                  ['Email', String(record.email ?? '') || '—'],
                  ['Kewarganegaraan', String(record.nationality ?? 'Indonesia')],
                  ['Rekening komisi', [record.bank_name, record.bank_account_number, record.bank_account_name ? `a.n. ${record.bank_account_name}` : ''].filter(Boolean).join(' · ') || '—'],
                  ['Kontak darurat', [record.emergency_name, record.emergency_phone].filter(Boolean).join(' — ') || '—'],
                  ...(role === 'agent' ? ([['Agensi', String(record.company_name ?? '') || '—'], ['NPWP', String(record.npwp ?? '') || '—']] as [string, string][]) : []),
                ]} />
                <Summary title="Domisili" rows={[
                  ['Alamat', String(record.address ?? '') || '—'],
                  ['RT/RW', String(record.rt_rw ?? '') || '—'],
                  ['Kelurahan/Kecamatan', `${record.village || '-'} / ${record.district || '-'}`],
                  ['Kota/Provinsi', `${record.city || '-'} / ${record.province || '-'}`],
                  ['Kode pos', String(record.postal_code ?? '') || '—'],
                ]} />
                <Summary title="Dokumen" rows={DOC_SLOTS.map((slot) => [slot.title, record[slot.key] ? 'Terunggah' : slot.required ? 'Belum ada' : '—'] as [string, string])} />
                <Summary title="Ketersediaan" rows={availability.filter((row) => row.is_active).map((row) => [`${WEEKDAY_LABELS[row.weekday]}`, `${row.start_time}-${row.end_time} · slot ${row.slot_minutes}m`] as [string, string])} />
                <Summary title="Perjanjian" rows={[
                  ['Versi', record.agreement_version ?? AGREEMENT_VERSION],
                  ['Ditandatangani', `${formatDateTimeId(agreementStamp)} WIB`],
                  ['Serial tanda tangan', agreementSerial ?? '—'],
                  ['Komisi', `${COMMISSION_RATE}% dari harga jual final`],
                ]} />
              </div>

              {missing.length > 0 && (
                <div className="mt-6 rounded-2xl bg-[#fbeeec] p-4 text-sm text-[#a4443a]">
                  <p className="font-semibold">Masih ada {missing.length} data yang perlu dilengkapi:</p>
                  <ul className="mt-2 space-y-1">
                    {missing.map((key) => <li key={key}>• {REQUIREMENT_LABELS[key]}</li>)}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={downloadDraft}
                  disabled={draftBusy || busy || !record?.identity_doc_path}
                  className="inline-flex items-center gap-2 rounded-full border border-[#d8ccbb] px-6 py-3 text-sm font-semibold text-[#33433d] hover:border-[#c9a961] disabled:opacity-50"
                >
                  {draftBusy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Unduh Draft Perjanjian
                </button>
                <button
                  type="button"
                  onClick={submitApplication}
                  disabled={busy || !isComplete(record)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0b3d2e] px-6 py-3 text-sm font-semibold text-white hover:bg-[#14553f] disabled:opacity-50 sm:w-auto"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Kirim pengajuan verifikasi
                </button>
              </div>
            </div>
          )}

          {/* Navigasi wizard */}
          {step > 0 && (
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#eee5d8] pt-5">
              <button type="button" onClick={goBack} className="inline-flex items-center gap-2 rounded-full border border-[#d8ccbb] px-5 py-2.5 text-sm font-semibold text-[#33433d] hover:border-[#c9a961]">
                <ArrowLeft className="size-4" /> Kembali
              </button>
              <div className="flex items-center gap-3">
                {step < 6 && (
                  <button type="button" onClick={goNext} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[#0b3d2e] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#14553f] disabled:opacity-50">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null} Lanjut <ArrowRight className="size-4" />
                  </button>
                )}
                {step === 6 && <span className="text-xs text-[#718078]">Langkah terakhir — tekan “Kirim pengajuan verifikasi”.</span>}
              </div>
            </div>
          )}

          {step === 0 && (
            <p className="mt-6 flex items-center gap-2 text-xs text-[#718078]"><UserRound className="size-4" /> Pilih salah satu peran untuk memulai.</p>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-[#a18a61]">
          <FileText className="size-3.5" /> Butuh bantuan? Hubungi tim kemitraan Homy di mitra@homyproperty.id
        </p>
      </div>
    </main>
  )
}

function Summary({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-2xl border border-[#eee5d8] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#a18a61]">{title}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.length === 0 && <p className="text-[#718078]">—</p>}
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-[#718078]">{label}</dt>
            <dd className="max-w-[60%] text-right font-medium text-[#20332c]">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
