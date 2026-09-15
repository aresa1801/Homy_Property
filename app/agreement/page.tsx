'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { ArrowRight, BadgeCheck, Briefcase, FileSignature, Home, Loader2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/dashboard-shell'
import { ROLE_META, type AppRole } from '@/lib/homy-session'

type PartnerRole = 'agent' | 'property_owner'

const PARTNER_ROLES: { value: PartnerRole; label: string; dashboard: string }[] = [
  { value: 'agent', label: 'Agen Properti', dashboard: ROLE_META.agent.dashboard },
  { value: 'property_owner', label: 'Pemilik Properti', dashboard: ROLE_META.property_owner.dashboard },
]

const COMMISSION_RATE = 0.5

const CLAUSES: { title: string; body: string }[] = [
  {
    title: '1. Para Pihak',
    body: 'Perjanjian Kerja Sama ini dibuat antara Homy Property ("Homy") dan Anda ("Mitra") yang terdaftar sebagai Agen Properti dan/atau Pemilik Properti pada platform Homy.',
  },
  {
    title: '2. Ruang Lingkup',
    body: 'Mitra berhak memasang, mengelola, dan memasarkan listing properti melalui platform Homy. Mitra menjamin seluruh data, foto, dan legalitas properti yang diunggah adalah benar dan berhak untuk dipasarkan.',
  },
  {
    title: '3. Komisi Penjualan 0,5%',
    body: 'Untuk setiap transaksi penjualan properti yang berasal dari atau difasilitasi platform Homy, Mitra setuju membayar komisi kepada Homy sebesar 0,5% (nol koma lima persen) dari harga jual properti yang tercatat pada akad/transaksi final.',
  },
  {
    title: '4. Kewajiban Pelaporan Transaksi',
    body: 'Mitra WAJIB melaporkan setiap transaksi (booking, tanda jadi, akad, hingga pelunasan) kepada Homy Property paling lambat 3 (tiga) hari kerja setelah transaksi terjadi, disertai bukti/dokumen pendukung yang relevan.',
  },
  {
    title: '5. Pembayaran Komisi',
    body: 'Komisi dibayarkan paling lambat 7 (tujuh) hari kerja setelah pelunasan transaksi atau sesuai invoice resmi dari Homy Property.',
  },
  {
    title: '6. Kepatuhan & Kode Etik',
    body: 'Mitra wajib mematuhi peraturan perundang-undangan yang berlaku, tidak melakukan penipuan, manipulasi harga, atau pemasaran ganda (double listing) tanpa hak. Pelanggaran dapat menyebabkan pembekuan akun.',
  },
  {
    title: '7. Kerahasiaan',
    body: 'Kedua pihak menjaga kerahasiaan data transaksi, data klien, dan informasi komersial yang tidak bersifat publik.',
  },
  {
    title: '8. Jangka Waktu & Pengakhiran',
    body: 'Perjanjian ini berlaku sejak ditandatangani dan berlanjut sampai diakhiri oleh salah satu pihak dengan pemberitahuan tertulis. Kewajiban komisi atas transaksi yang sudah terjadi tetap berlaku.',
  },
]

const PRIORITY: PartnerRole[] = ['agent', 'property_owner']

export default function AgreementPage() {
  const [role, setRole] = useState<PartnerRole>('property_owner')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [userId, setUserId] = useState('')
  const [identityNumber, setIdentityNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [company, setCompany] = useState('')
  const [npwp, setNpwp] = useState('')
  const [signature, setSignature] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeCommission, setAgreeCommission] = useState(false)
  const [agreeReport, setAgreeReport] = useState(false)
  const [ownedRoles, setOwnedRoles] = useState<string[]>([])
  const [signedRoles, setSignedRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const nextUrl = () => new URLSearchParams(window.location.search).get('next') || '/list'

  useEffect(() => {
    const supabase = createClient() as any
    supabase.auth.getUser().then(async ({ data }: any) => {
      const user = data?.user
      if (!user) {
        window.location.replace('/auth/login?next=/agreement')
        return
      }
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>
      const params = new URLSearchParams(window.location.search)
      const requested = params.get('role')
      setUserId(user.id)
      setEmail(user.email ?? '')
      setName(String(meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? ''))
      setAvatarUrl(String(meta.avatar_url ?? meta.picture ?? ''))
      try {
        const { data: rows } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
        const roles = Array.isArray(rows) ? rows.map((r: { role: string }) => r.role) : []
        setOwnedRoles(roles)
        const partnerRoles = roles.filter((r: string) => PRIORITY.includes(r as PartnerRole))
        const initial = requested === 'agent' || requested === 'property_owner'
          ? (requested as PartnerRole)
          : (PRIORITY.find((r) => partnerRoles.includes(r)) ?? 'property_owner')
        setRole(initial)
        const { data: agreements } = await supabase.from('partner_agreements').select('role,status').eq('user_id', user.id).eq('status', 'active')
        setSignedRoles(Array.isArray(agreements) ? agreements.map((a: { role: string }) => a.role) : [])
      } catch {
        /* defaults are fine */
      }
      setLoading(false)
    })
  }, [])

  const alreadySigned = signedRoles.includes(role)
  const signatureMatches = useMemo(
    () => signature.trim().length > 2 && signature.trim().toLowerCase() === name.trim().toLowerCase(),
    [signature, name],
  )
  const canSubmit = agreeTerms && agreeCommission && agreeReport && signatureMatches && identityNumber.trim().length >= 6 && phone.trim().length >= 6

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (!canSubmit) {
      setError('Lengkapi data, tanda tangan (nama harus sama dengan nama Anda), dan centang semua persetujuan.')
      return
    }
    setSubmitting(true)
    const supabase = createClient() as any
    try {
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role, status: 'active' }, { onConflict: 'user_id,role' })
      if (roleError) throw roleError

      const { error: agreementError } = await supabase
        .from('partner_agreements')
        .upsert(
          {
            user_id: userId,
            role,
            full_name: name.trim(),
            identity_number: identityNumber.trim(),
            phone: phone.trim(),
            address: address.trim() || null,
            company_name: company.trim() || null,
            npwp: npwp.trim() || null,
            commission_rate: COMMISSION_RATE,
            agreed_commission: true,
            agreed_report_transactions: true,
            agreed_terms: true,
            signature_name: signature.trim(),
            agreement_version: 'v1.0',
            status: 'active',
            signed_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,role' },
        )
      if (agreementError) throw agreementError

      setNotice('Perjanjian berhasil ditandatangani. Mengalihkan ke formulir properti...')
      setSignedRoles((current) => (current.includes(role) ? current : [...current, role]))
      const destination = nextUrl()
      window.setTimeout(() => window.location.assign(destination), 700)
    } catch (err: any) {
      setError(err?.message ? `Gagal menyimpan perjanjian: ${err.message}` : 'Gagal menyimpan perjanjian. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f7f3ec] text-[#0b3d2e]">Memuat perjanjian...</main>

  return (
    <main className="min-h-screen bg-[#f7f3ec] px-5 py-8 text-[#1c1c1c] sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-[1760px]">
        <BrandMark height={40} />

        <div className="mt-6 sm:mt-10 flex items-center gap-3 rounded-2xl border border-[#e8dfd3] bg-white p-4">
          <UserAvatar name={name} email={email} avatarUrl={avatarUrl} size={48} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#0b3d2e]">{name || 'Akun Google Anda'}</p>
            <p className="truncate text-sm text-[#65706c]">{email || 'Belum masuk'}</p>
          </div>
          <span className="ml-auto hidden rounded-full bg-[#edf2ed] px-3 py-1 text-xs font-semibold text-[#0b3d2e] sm:inline-flex">Akun Google</span>
        </div>

        <div className="mt-8 max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Wajib sebelum listing</p>
          <h1 className="mt-3 font-serif text-3xl sm:text-5xl leading-tight text-[#0b3d2e]">Surat Perjanjian Kerja Sama</h1>
          <p className="mt-5 text-base sm:text-lg leading-8 text-[#65706c]">
            Untuk memasang properti, Agen dan Pemilik Properti wajib mendaftar sebagai Mitra Homy, menandatangani perjanjian kerja sama,
            menyetujui komisi penjualan <strong className="text-[#0b3d2e]">0,5%</strong> dari harga jual, dan melaporkan setiap transaksi kepada Homy Property.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {PARTNER_ROLES.map((option) => {
            const active = role === option.value
            const signed = signedRoles.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white' : 'border-[#e8dfd3] bg-white text-[#33433d] hover:border-[#c9a961]'}`}
              >
                {option.value === 'agent' ? <Briefcase className="size-4" /> : <Home className="size-4" />}
                {option.label}
                {signed && <BadgeCheck className={`size-4 ${active ? 'text-[#c9a961]' : 'text-[#4e866d]'}`} />}
              </button>
            )
          })}
        </div>

        {ownedRoles.length > 0 && (
          <p className="mt-4 text-sm text-[#65706c]">
            Peran terdaftar: <strong className="text-[#0b3d2e]">{ownedRoles.filter((r) => PRIORITY.includes(r as PartnerRole)).map((r) => ROLE_META[r as AppRole].label).join(' + ') || 'Belum ada peran Partner'}</strong>
          </p>
        )}

        {alreadySigned && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#cfe3d6] bg-[#eaf4ee] p-4 text-sm text-[#0b3d2e]">
            <ShieldCheck className="mt-0.5 size-5" />
            <div>
              <p className="font-semibold">Perjanjian untuk {PARTNER_ROLES.find((r) => r.value === role)?.label} sudah aktif.</p>
              <p className="mt-1 text-[#40584f]">Anda sudah bisa memasang properti. Perbarui data di bawah bila ada perubahan, lalu tanda tangani ulang.</p>
              <a href="/list" className="mt-2 inline-flex items-center gap-1 font-semibold text-[#0b3d2e] underline">Buka formulir properti <ArrowRight className="size-4" /></a>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-8 grid gap-4 sm:gap-6 xl:grid-cols-[1.05fr_1fr] xl:gap-8">
          <section className="rounded-2xl border border-[#e8dfd3] bg-white p-4 sm:p-6 lg:p-8">
            <h2 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Data Mitra</h2>
            <p className="mt-1 text-sm text-[#65706c]">Data ini dipakai pada dokumen perjanjian dan penagihan komisi.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-[#33433d] sm:col-span-2">Nama lengkap sesuai identitas
                <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" />
              </label>
              <label className="text-sm font-semibold text-[#33433d]">NIK / No. KTP
                <input required value={identityNumber} onChange={(e) => setIdentityNumber(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" placeholder="16 digit" />
              </label>
              <label className="text-sm font-semibold text-[#33433d]">No. WhatsApp aktif
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" placeholder="08xxxxxxxxxx" />
              </label>
              <label className="text-sm font-semibold text-[#33433d]">NPWP <span className="font-normal text-[#65706c]">(opsional)</span>
                <input value={npwp} onChange={(e) => setNpwp(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" />
              </label>
              <label className="text-sm font-semibold text-[#33433d]">Perusahaan / Agency <span className="font-normal text-[#65706c]">(opsional)</span>
                <input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" />
              </label>
              <label className="text-sm font-semibold text-[#33433d] sm:col-span-2">Alamat domisili
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-[#ddd3c5] p-4 font-normal outline-none focus:border-[#0b3d2e]" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e8dfd3] bg-white p-4 sm:p-6 lg:p-8">
            <h2 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Isi Perjanjian</h2>
            <div className="mt-4 max-h-[26rem] space-y-4 overflow-auto rounded-xl bg-[#f7f3ec] p-4 sm:p-5 text-sm leading-6 text-[#40584f] xl:max-h-[38rem] 2xl:max-h-[46rem]">
              {CLAUSES.map((clause) => (
                <div key={clause.title}>
                  <p className="font-semibold text-[#0b3d2e]">{clause.title}</p>
                  <p className="mt-1">{clause.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-[#f0dcae] bg-[#fff7e3] p-4 sm:p-5 text-sm text-[#7a5a12]">
              <p className="font-semibold">Ringkasan kewajiban Mitra</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Komisi penjualan <strong>0,5%</strong> dari harga jual properti.</li>
                <li><strong>Wajib melaporkan</strong> setiap transaksi kepada Homy Property (maks. 3 hari kerja).</li>
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e8dfd3] bg-white p-4 sm:p-6 lg:p-8 lg:col-span-2">
            <h2 className="flex items-center gap-2 font-serif text-xl sm:text-2xl text-[#0b3d2e]"><FileSignature className="size-6 text-[#c9a961]" /> Persetujuan & Tanda Tangan</h2>
            <div className="mt-5 space-y-3">
              <label className="flex items-start gap-3 rounded-xl border border-[#e8dfd3] p-4 text-sm">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 size-5" />
                <span>Saya telah membaca dan menyetujui seluruh isi <strong>Surat Perjanjian Kerja Sama</strong> di atas.</span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-[#e8dfd3] p-4 text-sm">
                <input type="checkbox" checked={agreeCommission} onChange={(e) => setAgreeCommission(e.target.checked)} className="mt-0.5 size-5" />
                <span>Saya setuju membayar <strong>komisi penjualan 0,5% dari harga jual properti</strong> kepada Homy Property.</span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-[#e8dfd3] p-4 text-sm">
                <input type="checkbox" checked={agreeReport} onChange={(e) => setAgreeReport(e.target.checked)} className="mt-0.5 size-5" />
                <span>Saya <strong>wajib melaporkan setiap transaksi</strong> penjualan/sewa kepada Homy Property.</span>
              </label>
            </div>
            <label className="mt-5 block text-sm font-semibold text-[#33433d]">
              Tanda tangan digital — ketik nama lengkap Anda
              <input
                required
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className={`mt-2 h-12 w-full rounded-lg border px-4 font-serif text-base sm:text-lg italic outline-none ${signature && !signatureMatches ? 'border-[#e0a3a3] bg-[#fdf3f3]' : 'border-[#ddd3c5] focus:border-[#0b3d2e]'}`}
                placeholder={name || 'Nama lengkap Anda'}
              />
            </label>
            {signature && !signatureMatches && <p className="mt-2 text-xs text-[#a3282c]">Tanda tangan harus sama persis dengan nama lengkap Anda ({name}).</p>}

            {error && <p role="alert" className="mt-5 rounded-xl bg-[#fbe9e7] p-4 text-sm text-[#a3282c]">{error}</p>}
            {notice && <p role="status" className="mt-5 rounded-xl bg-[#e2eee7] p-4 text-sm text-[#0b3d2e]">{notice}</p>}

            <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-[#e8dfd3] pt-6 sm:flex-row sm:items-center">
              <p className="text-sm text-[#65706c]">Dengan menandatangani, Anda terdaftar sebagai <strong className="text-[#0b3d2e]">{PARTNER_ROLES.find((r) => r.value === role)?.label}</strong> dan langsung dapat memasang properti.</p>
              <Button type="submit" disabled={submitting || !canSubmit} className="rounded-full bg-[#0b3d2e] px-6 text-white hover:bg-[#14553f]">
                {submitting ? <><Loader2 className="animate-spin" data-icon="inline-start" /> Menyimpan...</> : <>{alreadySigned ? 'Perbarui & tanda tangani' : 'Tanda tangani & lanjut listing'} <ArrowRight data-icon="inline-end" /></>}
              </Button>
            </div>
          </section>
        </form>
      </div>
    </main>
  )
}
