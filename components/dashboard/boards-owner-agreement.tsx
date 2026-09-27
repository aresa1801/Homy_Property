'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, FileSignature, FileText, Info, Printer, RefreshCw, ShieldCheck } from 'lucide-react'
import type { BoardProps } from '@/components/dashboard/boards-listing'
import { ui } from '@/lib/dashboard-client'
import {
  OWNER_DOCUMENT_OPTIONS,
  OWNER_EXCLUSIVITY,
  OWNER_FEE_PAYERS,
  OWNER_IDENTITY_TYPES,
  OWNER_LISTING_MODES,
  OWNER_MARKETING_SCOPE_OPTIONS,
  ownerAgreementMissing,
  type OwnerAgreementData,
} from '@/lib/owner-agreement'

type Party = { name: string; identityType: string; identityNumber: string; address: string; city: string; province: string; phone: string; email: string; occupation: string; companyName: string; npwp: string; representative: string }

type Witness = { name: string; address: string; phone: string }

type Form = {
  place: string
  date: string
  number: string
  owner: Party
  agent: Party
  property: {
    propertyType: string
    title: string
    address: string
    city: string
    province: string
    postalCode: string
    certificateType: string
    certificateNumber: string
    landArea: string
    buildingArea: string
    bedrooms: string
    bathrooms: string
    floors: string
    yearBuilt: string
    facilities: string
    imNumber: string
    documents: string[]
    keyHandover: boolean
  }
  terms: {
    listingMode: string
    salePrice: string
    minPrice: string
    rentPrice: string
    rentPeriod: string
    negotiable: boolean
    feePercent: string
    feePayer: string
    feeTiming: string
    exclusivity: string
    durationMonths: string
    startDate: string
    scope: string[]
    specialTerms: string
  }
  witnesses: Witness[]
}

const emptyParty = (): Party => ({ name: '', identityType: 'ktp', identityNumber: '', address: '', city: '', province: '', phone: '', email: '', occupation: '', companyName: '', npwp: '', representative: '' })

function initialForm(): Form {
  const today = new Date().toISOString().slice(0, 10)
  return {
    place: '',
    date: today,
    number: '',
    owner: emptyParty(),
    agent: emptyParty(),
    property: {
      propertyType: 'Rumah', title: '', address: '', city: '', province: '', postalCode: '',
      certificateType: 'SHM', certificateNumber: '', landArea: '', buildingArea: '', bedrooms: '', bathrooms: '',
      floors: '', yearBuilt: '', facilities: '', imNumber: '', documents: [], keyHandover: false,
    },
    terms: {
      listingMode: 'sale', salePrice: '', minPrice: '', rentPrice: '', rentPeriod: 'tahun', negotiable: false,
      feePercent: '2', feePayer: 'pemilik', feeTiming: 'pada saat akad/pelunasan transaksi', exclusivity: 'non-exclusive',
      durationMonths: '3', startDate: today, scope: [...OWNER_MARKETING_SCOPE_OPTIONS], specialTerms: '',
    },
    witnesses: [{ name: '', address: '', phone: '' }, { name: '', address: '', phone: '' }],
  }
}

function currency(value: string) {
  const number = Number(String(value ?? '').replace(/[^0-9]/g, ''))
  if (!number) return '—'
  return 'Rp ' + number.toLocaleString('id-ID')
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#a18a61]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[#8a958e]">{hint}</span>}
    </label>
  )
}

/** Form + unduhan Surat Perjanjian Pemasaran & Penjualan/Penyewaan Properti (Agen ↔ Pemilik). */
export function OwnerAgreementBoard(_props: BoardProps) {
  const [form, setForm] = useState<Form>(initialForm)
  const [busy, setBusy] = useState<'final' | 'template' | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [prefillNote, setPrefillNote] = useState<string>('')

  // Isi otomatis data agen dari profil & verifikasi mitra (kalau sudah ada).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/verify', { cache: 'no-store' })
        const body = await response.json().catch(() => null)
        if (cancelled || !body?.authenticated) return
        const record = body.verifications?.agent ?? null
        const address = [record?.address, record?.rt_rw ? `RT/RW ${record.rt_rw}` : '', record?.village, record?.district]
          .map((part: unknown) => String(part ?? '').trim()).filter(Boolean).join(', ')
        setForm((current) => ({
          ...current,
          agent: {
            ...current.agent,
            name: current.agent.name || String(record?.full_name ?? body.profile?.full_name ?? ''),
            identityType: String(record?.identity_type ?? current.agent.identityType ?? 'ktp'),
            identityNumber: current.agent.identityNumber || String(record?.identity_number ?? ''),
            address: current.agent.address || address,
            city: current.agent.city || String(record?.city ?? ''),
            province: current.agent.province || String(record?.province ?? ''),
            phone: current.agent.phone || String(record?.phone ?? record?.whatsapp ?? body.profile?.phone ?? ''),
            email: current.agent.email || String(record?.email ?? body.user?.email ?? ''),
            companyName: current.agent.companyName || String(record?.company_name ?? ''),
            npwp: current.agent.npwp || String(record?.npwp ?? ''),
            occupation: current.agent.occupation || String(record?.occupation ?? ''),
          },
        }))
        if (record?.full_name) setPrefillNote('Data agen terisi otomatis dari profil verifikasi mitra Anda.')
      } catch { /* abaikan — agen mengisi manual */ }
    })()
    return () => { cancelled = true }
  }, [])

  const payload = useMemo<OwnerAgreementData>(() => ({
    number: form.number,
    place: form.place,
    date: form.date,
    owner: form.owner,
    agent: form.agent,
    property: {
      propertyType: form.property.propertyType,
      title: form.property.title,
      address: form.property.address,
      city: form.property.city,
      province: form.property.province,
      postalCode: form.property.postalCode,
      certificateType: form.property.certificateType,
      certificateNumber: form.property.certificateNumber,
      landArea: form.property.landArea,
      buildingArea: form.property.buildingArea,
      bedrooms: form.property.bedrooms,
      bathrooms: form.property.bathrooms,
      floors: form.property.floors,
      yearBuilt: form.property.yearBuilt,
      facilities: form.property.facilities,
      imNumber: form.property.imNumber,
      documents: form.property.documents,
      keyHandover: form.property.keyHandover,
    },
    terms: {
      listingMode: form.terms.listingMode,
      salePrice: form.terms.salePrice,
      minPrice: form.terms.minPrice,
      rentPrice: form.terms.rentPrice,
      rentPeriod: form.terms.rentPeriod,
      negotiable: form.terms.negotiable,
      feePercent: form.terms.feePercent,
      feePayer: form.terms.feePayer,
      feeTiming: form.terms.feeTiming,
      exclusivity: form.terms.exclusivity,
      durationMonths: form.terms.durationMonths,
      startDate: form.terms.startDate,
      marketingScope: form.terms.scope.join('; '),
      specialTerms: form.terms.specialTerms,
    },
    witnesses: form.witnesses,
  }), [form])

  const missing = useMemo(() => ownerAgreementMissing(payload), [payload])

  async function download(mode: 'final' | 'template') {
    setBusy(mode)
    setMessage(null)
    try {
      const response = await fetch('/api/agent/owner-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, data: payload }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(String(body?.error ?? 'Gagal membuat PDF'))
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = mode === 'template' ? 'Formulir-Perjanjian-Pemilik-Agen.pdf' : 'Perjanjian-Pemilik-Agen.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      setMessage({ tone: 'ok', text: mode === 'template' ? 'Formulir kosong berhasil diunduh — siap dicetak.' : 'Perjanjian berhasil diunduh. Cetak, beri materai, lalu tanda tangani bersama pemilik dan saksi.' })
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Terjadi kesalahan' })
    } finally {
      setBusy(null)
    }
  }

  function setParty(which: 'owner' | 'agent', key: keyof Party, value: string) {
    setForm((current) => ({ ...current, [which]: { ...current[which], [key]: value } }))
  }

  function setProperty<K extends keyof Form['property']>(key: K, value: Form['property'][K]) {
    setForm((current) => ({ ...current, property: { ...current.property, [key]: value } }))
  }

  function setTerms<K extends keyof Form['terms']>(key: K, value: Form['terms'][K]) {
    setForm((current) => ({ ...current, terms: { ...current.terms, [key]: value } }))
  }

  function toggleDocument(item: string) {
    setProperty('documents', form.property.documents.includes(item)
      ? form.property.documents.filter((row) => row !== item)
      : [...form.property.documents, item])
  }

  function toggleScope(item: string) {
    setTerms('scope', form.terms.scope.includes(item)
      ? form.terms.scope.filter((row) => row !== item)
      : [...form.terms.scope, item])
  }

  function setWitness(index: number, key: keyof Witness, value: string) {
    const rows = form.witnesses.map((row, position) => (position === index ? { ...row, [key]: value } : row))
    setForm((current) => ({ ...current, witnesses: rows }))
  }

  const completeness = Math.max(0, Math.round((8 - missing.length) / 8 * 100))
  const feePreview = (() => {
    const base = Number(String(form.terms.salePrice || form.terms.rentPrice).replace(/[^0-9]/g, ''))
    const rate = Number(String(form.terms.feePercent).replace(/[^0-9.]/g, ''))
    if (!base || !rate) return null
    return Math.round((base * rate) / 100)
  })()

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={ui.card}>
        <div className="flex items-center gap-2"><FileSignature className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Surat Perjanjian Pemasaran & Penjualan/Penyewaan Properti</h3></div>
        <p className="mt-2 text-sm leading-6 text-[#718078]">
          Dokumen <strong>mandiri</strong> antara Pemilik Properti dan Agen Properti untuk mengikat perjanjian penitipan properti
          (dijual/disewakan). Formulir ini <strong>tanpa kop Homy Property</strong> — Homy hanya membantu menyusun dan mengunduh.
          Isi datanya, unduh PDF, cetak, beri materai, lalu tanda tangani bersama pemilik dan saksi.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className={ui.soft}><p className="text-xs font-semibold text-[#a18a61]">LANGKAH 1</p><p className="mt-1 text-sm text-[#33433d]">Isi data pemilik, properti, dan ketentuan komisi.</p></div>
          <div className={ui.soft}><p className="text-xs font-semibold text-[#a18a61]">LANGKAH 2</p><p className="mt-1 text-sm text-[#33433d]">Unduh PDF terisi (atau formulir kosong untuk diisi tangan).</p></div>
          <div className={ui.soft}><p className="text-xs font-semibold text-[#a18a61]">LANGKAH 3</p><p className="mt-1 text-sm text-[#33433d]">Cetak 2 rangkap, materai, tanda tangan pemilik, agen, dan saksi.</p></div>
        </div>
        {prefillNote && <p className="mt-3 flex items-center gap-2 text-xs text-[#4e866d]"><Info className="size-4" />{prefillNote}</p>}
      </div>

      <div className={ui.card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a18a61]">Kelengkapan data</p>
            <p className="mt-1 text-sm text-[#33433d]">{missing.length === 0 ? 'Data inti sudah lengkap ✅' : `Kurang: ${missing.join(', ')}`}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ui.btn} disabled={busy !== null} onClick={() => download('final')}>
              {busy === 'final' ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />} Unduh PDF terisi
            </button>
            <button type="button" className={ui.ghost} disabled={busy !== null} onClick={() => download('template')}>
              {busy === 'template' ? <RefreshCw className="size-4 animate-spin" /> : <FileText className="size-4" />} Unduh formulir kosong
            </button>
            <button type="button" className={ui.ghost} onClick={() => { setForm(initialForm()); setMessage(null) }}><RefreshCw className="size-4" /> Kosongkan form</button>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#f0ece3]">
          <div className="h-full rounded-full bg-[#4e866d] transition-all" style={{ width: `${completeness}%` }} />
        </div>
        {message && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#33604d]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>
        )}
        {feePreview !== null && (
          <p className="mt-3 text-xs text-[#718078]">Estimasi imbal jasa agen: <strong className="text-[#0b3d2e]">{currency(String(feePreview))}</strong> ({form.terms.feePercent}% dari harga).</p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={ui.card}>
          <h4 className="font-serif text-lg text-[#0b3d2e]">A. Dokumen & Tempat Perjanjian</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Dibuat di (kota)"><input className={ui.input} value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="Jakarta Selatan" /></Field>
            <Field label="Tanggal perjanjian"><input type="date" className={ui.input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Nomor dokumen (opsional)" hint="Kosongkan untuk penomoran otomatis OA/AGN/tahun/xxxxxx"><input className={ui.input} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="Otomatis" /></Field>
          </div>
        </div>

        <div className={ui.card}>
          <h4 className="font-serif text-lg text-[#0b3d2e]">B. Pihak Kedua — Agen Properti</h4>
          <p className="mt-1 text-xs text-[#8a958e]">Terisi otomatis dari profil verifikasi mitra Anda; sesuaikan bila perlu.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nama lengkap agen"><input className={ui.input} value={form.agent.name} onChange={(e) => setParty('agent', 'name', e.target.value)} /></Field>
            <Field label="Jenis identitas">
              <select className={ui.input} value={form.agent.identityType} onChange={(e) => setParty('agent', 'identityType', e.target.value)}>
                {OWNER_IDENTITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Nomor identitas"><input className={ui.input} value={form.agent.identityNumber} onChange={(e) => setParty('agent', 'identityNumber', e.target.value)} /></Field>
            <Field label="Telepon/WhatsApp"><input className={ui.input} value={form.agent.phone} onChange={(e) => setParty('agent', 'phone', e.target.value)} /></Field>
            <Field label="Alamat agen"><input className={ui.input} value={form.agent.address} onChange={(e) => setParty('agent', 'address', e.target.value)} /></Field>
            <Field label="Kota"><input className={ui.input} value={form.agent.city} onChange={(e) => setParty('agent', 'city', e.target.value)} /></Field>
            <Field label="Surel"><input className={ui.input} value={form.agent.email} onChange={(e) => setParty('agent', 'email', e.target.value)} /></Field>
            <Field label="Agensi/perusahaan (opsional)"><input className={ui.input} value={form.agent.companyName} onChange={(e) => setParty('agent', 'companyName', e.target.value)} /></Field>
            <Field label="NPWP (opsional)"><input className={ui.input} value={form.agent.npwp} onChange={(e) => setParty('agent', 'npwp', e.target.value)} /></Field>
            <Field label="Diwakilkan oleh (opsional)"><input className={ui.input} value={form.agent.representative} onChange={(e) => setParty('agent', 'representative', e.target.value)} /></Field>
          </div>
        </div>

        <div className="xl:col-span-2 rounded-2xl border border-[#e5dccd] bg-white p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]">
          <h4 className="font-serif text-lg text-[#0b3d2e]">C. Pihak Pertama — Pemilik Properti</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nama pemilik"><input className={ui.input} value={form.owner.name} onChange={(e) => setParty('owner', 'name', e.target.value)} /></Field>
            <Field label="Jenis identitas">
              <select className={ui.input} value={form.owner.identityType} onChange={(e) => setParty('owner', 'identityType', e.target.value)}>
                {OWNER_IDENTITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Nomor identitas"><input className={ui.input} value={form.owner.identityNumber} onChange={(e) => setParty('owner', 'identityNumber', e.target.value)} /></Field>
            <Field label="Alamat pemilik"><input className={ui.input} value={form.owner.address} onChange={(e) => setParty('owner', 'address', e.target.value)} /></Field>
            <Field label="Kota"><input className={ui.input} value={form.owner.city} onChange={(e) => setParty('owner', 'city', e.target.value)} /></Field>
            <Field label="Provinsi (opsional)"><input className={ui.input} value={form.owner.province} onChange={(e) => setParty('owner', 'province', e.target.value)} /></Field>
            <Field label="Telepon/WhatsApp"><input className={ui.input} value={form.owner.phone} onChange={(e) => setParty('owner', 'phone', e.target.value)} /></Field>
            <Field label="Surel (opsional)"><input className={ui.input} value={form.owner.email} onChange={(e) => setParty('owner', 'email', e.target.value)} /></Field>
            <Field label="NPWP (opsional)"><input className={ui.input} value={form.owner.npwp} onChange={(e) => setParty('owner', 'npwp', e.target.value)} /></Field>
          </div>
        </div>

        <div className="xl:col-span-2 rounded-2xl border border-[#e5dccd] bg-white p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]">
          <h4 className="font-serif text-lg text-[#0b3d2e]">D. Data Properti</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Jenis properti"><input className={ui.input} value={form.property.propertyType} onChange={(e) => setProperty('propertyType', e.target.value)} placeholder="Rumah / Ruko / Tanah / Apartemen" /></Field>
            <Field label="Judul/nama properti (opsional)"><input className={ui.input} value={form.property.title} onChange={(e) => setProperty('title', e.target.value)} /></Field>
            <Field label="Alamat properti" hint="Jalan, nomor, RT/RW, kelurahan, kecamatan"><input className={ui.input} value={form.property.address} onChange={(e) => setProperty('address', e.target.value)} /></Field>
            <Field label="Kota/kabupaten"><input className={ui.input} value={form.property.city} onChange={(e) => setProperty('city', e.target.value)} /></Field>
            <Field label="Provinsi"><input className={ui.input} value={form.property.province} onChange={(e) => setProperty('province', e.target.value)} /></Field>
            <Field label="Kode pos (opsional)"><input className={ui.input} value={form.property.postalCode} onChange={(e) => setProperty('postalCode', e.target.value)} /></Field>
            <Field label="Bukti kepemilikan">
              <select className={ui.input} value={form.property.certificateType} onChange={(e) => setProperty('certificateType', e.target.value)}>
                {['SHM', 'SHGB', 'AJB', 'Girik/Letter C', 'Hak Pakai', 'Strata Title', 'Lainnya'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Nomor sertifikat"><input className={ui.input} value={form.property.certificateNumber} onChange={(e) => setProperty('certificateNumber', e.target.value)} /></Field>
            <Field label="IMB/PBG/SLF (opsional)"><input className={ui.input} value={form.property.imNumber} onChange={(e) => setProperty('imNumber', e.target.value)} /></Field>
            <Field label="Luas tanah (m2)"><input className={ui.input} value={form.property.landArea} onChange={(e) => setProperty('landArea', e.target.value)} /></Field>
            <Field label="Luas bangunan (m2)"><input className={ui.input} value={form.property.buildingArea} onChange={(e) => setProperty('buildingArea', e.target.value)} /></Field>
            <Field label="Kamar tidur"><input className={ui.input} value={form.property.bedrooms} onChange={(e) => setProperty('bedrooms', e.target.value)} /></Field>
            <Field label="Kamar mandi"><input className={ui.input} value={form.property.bathrooms} onChange={(e) => setProperty('bathrooms', e.target.value)} /></Field>
            <Field label="Jumlah lantai"><input className={ui.input} value={form.property.floors} onChange={(e) => setProperty('floors', e.target.value)} /></Field>
            <Field label="Tahun dibangun"><input className={ui.input} value={form.property.yearBuilt} onChange={(e) => setProperty('yearBuilt', e.target.value)} /></Field>
            <Field label="Fasilitas & kondisi" hint="Listrik, air, AC, carport, kondisi renovasi, dll."><input className={ui.input} value={form.property.facilities} onChange={(e) => setProperty('facilities', e.target.value)} /></Field>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a18a61]">Dokumen yang diserahkan pemilik kepada agen</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {OWNER_DOCUMENT_OPTIONS.map((item) => (
                <label key={item} className="flex items-start gap-2 text-sm text-[#33433d]">
                  <input type="checkbox" className="mt-1" checked={form.property.documents.includes(item)} onChange={() => toggleDocument(item)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-[#33433d]">
              <input type="checkbox" checked={form.property.keyHandover} onChange={(e) => setProperty('keyHandover', e.target.checked)} />
              <span>Pemilik menitipkan kunci/akses properti kepada agen untuk survey</span>
            </label>
          </div>
        </div>

        <div className="xl:col-span-2 rounded-2xl border border-[#e5dccd] bg-white p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]">
          <h4 className="font-serif text-lg text-[#0b3d2e]">E. Ketentuan Pemasaran & Imbal Jasa</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tujuan pemasaran">
              <select className={ui.input} value={form.terms.listingMode} onChange={(e) => setTerms('listingMode', e.target.value)}>
                {OWNER_LISTING_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Sifat penugasan">
              <select className={ui.input} value={form.terms.exclusivity} onChange={(e) => setTerms('exclusivity', e.target.value)}>
                {OWNER_EXCLUSIVITY.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Jangka waktu (bulan)"><input className={ui.input} value={form.terms.durationMonths} onChange={(e) => setTerms('durationMonths', e.target.value)} /></Field>
            <Field label="Mulai berlaku"><input type="date" className={ui.input} value={form.terms.startDate} onChange={(e) => setTerms('startDate', e.target.value)} /></Field>
            <Field label="Harga jual (Rp)" hint={form.terms.salePrice ? currency(form.terms.salePrice) : 'Contoh: 1500000000'}><input className={ui.input} value={form.terms.salePrice} onChange={(e) => setTerms('salePrice', e.target.value)} /></Field>
            <Field label="Batas harga terendah (Rp)" hint={form.terms.minPrice ? currency(form.terms.minPrice) : 'Opsional'}><input className={ui.input} value={form.terms.minPrice} onChange={(e) => setTerms('minPrice', e.target.value)} /></Field>
            <Field label="Harga sewa (Rp)" hint={form.terms.rentPrice ? currency(form.terms.rentPrice) : 'Jika disewakan'}><input className={ui.input} value={form.terms.rentPrice} onChange={(e) => setTerms('rentPrice', e.target.value)} /></Field>
            <Field label="Satuan sewa"><input className={ui.input} value={form.terms.rentPeriod} onChange={(e) => setTerms('rentPeriod', e.target.value)} placeholder="tahun / bulan" /></Field>
            <Field label="Harga dapat dinegosiasikan">
              <select className={ui.input} value={form.terms.negotiable ? 'yes' : 'no'} onChange={(e) => setTerms('negotiable', e.target.value === 'yes')}>
                <option value="no">Tidak (harga bersih minimum)</option>
                <option value="yes">Ya, dapat dinegosiasikan</option>
              </select>
            </Field>
            <Field label="Imbal jasa agen (%)"><input className={ui.input} value={form.terms.feePercent} onChange={(e) => setTerms('feePercent', e.target.value)} /></Field>
            <Field label="Ditanggung oleh">
              <select className={ui.input} value={form.terms.feePayer} onChange={(e) => setTerms('feePayer', e.target.value)}>
                {OWNER_FEE_PAYERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Waktu pembayaran imbal jasa"><input className={ui.input} value={form.terms.feeTiming} onChange={(e) => setTerms('feeTiming', e.target.value)} /></Field>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a18a61]">Cakupan pekerjaan pemasaran</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {OWNER_MARKETING_SCOPE_OPTIONS.map((item) => (
                <label key={item} className="flex items-start gap-2 text-sm text-[#33433d]">
                  <input type="checkbox" className="mt-1" checked={form.terms.scope.includes(item)} onChange={() => toggleScope(item)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Field label="Ketentuan khusus yang disepakati (opsional)" hint="Mis. tanggal serah terima, biaya perbaikan, pembagian bonus, dll.">
              <textarea className={`${ui.input} min-h-[90px]`} value={form.terms.specialTerms} onChange={(e) => setTerms('specialTerms', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="xl:col-span-2 rounded-2xl border border-[#e5dccd] bg-white p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]">
          <h4 className="font-serif text-lg text-[#0b3d2e]">F. Saksi-Saksi (opsional, dianjurkan 2 orang)</h4>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {form.witnesses.map((witness, index) => (
              <div key={index} className={ui.soft}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#a18a61]">Saksi {index + 1}</p>
                <div className="mt-2 space-y-2">
                  <input className={ui.input} placeholder="Nama saksi" value={witness.name} onChange={(e) => setWitness(index, 'name', e.target.value)} />
                  <input className={ui.input} placeholder="Alamat" value={witness.address} onChange={(e) => setWitness(index, 'address', e.target.value)} />
                  <input className={ui.input} placeholder="Telepon (opsional)" value={witness.phone} onChange={(e) => setWitness(index, 'phone', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={ui.card}>
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf2ed] text-[#0b3d2e]"><ShieldCheck className="size-5" /></span>
          <div className="text-sm leading-6 text-[#33433d]">
            <p className="font-semibold text-[#0b3d2e]">Catatan penting sebelum menandatangani</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[#718078]">
              <li>Dokumen ini <strong>tidak memakai kop Homy Property</strong> dan <strong>bukan perjanjian dengan Homy</strong> — Homy bukan pihak di dalamnya.</li>
              <li>Kalau transaksi terjadi melalui platform Homy, komisi platform 0,5% diatur pada Perjanjian Kerja Sama Mitra yang terpisah — beri tahu pemilik secara terbuka.</li>
              <li>Pastikan pemilik benar-benar pemilik sah dan properti tidak sedang dijaminkan/disewakan pihak lain.</li>
              <li>Cetak 2 rangkap, beri materai sesuai ketentuan, tanda tangani pemilik, agen, dan saksi. Simpan satu rangkap untuk masing-masing pihak.</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={ui.btn} disabled={busy !== null} onClick={() => download('final')}>
            {busy === 'final' ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />} Unduh PDF terisi
          </button>
          <button type="button" className={ui.ghost} disabled={busy !== null} onClick={() => download('template')}>
            {busy === 'template' ? <RefreshCw className="size-4 animate-spin" /> : <Printer className="size-4" />} Unduh formulir kosong
          </button>
        </div>
      </div>
    </div>
  )
}
