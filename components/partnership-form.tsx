'use client'

import { useState } from 'react'
import { Handshake } from 'lucide-react'
import {
  CONTACT_CHANNELS,
  CONTACT_TIMES,
  ENTITY_TYPES,
  FOCUS_AREA_OPTIONS,
  PARTNER_KIND_ORDER,
  PARTNER_KINDS,
  SERVICE_OPTIONS,
  VOLUME_OPTIONS,
  type PartnerKind,
} from '@/lib/partnership'

const field = 'h-11 w-full rounded-lg border border-[#d8ccbb] bg-white px-3 text-sm text-[#20332c] outline-none focus:border-[#0b3d2e]'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]'
const sectionTitle = 'text-sm font-bold text-[#0b3d2e]'

type FormState = {
  kind: PartnerKind
  full_name: string
  position: string
  email: string
  phone: string
  city: string
  province: string
  company: string
  entity_type: string
  website: string
  founded_year: string
  team_size: string
  license_no: string
  npwp: string
  coverage_area: string
  listings_ready: string
  branches: string
  focus_areas: string[]
  services: string[]
  volume: string
  preferred_contact: string
  contact_time: string
  doc_url: string
  message: string
  agree_terms: boolean
}

const EMPTY: FormState = {
  kind: 'agent',
  full_name: '',
  position: '',
  email: '',
  phone: '',
  city: '',
  province: '',
  company: '',
  entity_type: '',
  website: '',
  founded_year: '',
  team_size: '',
  license_no: '',
  npwp: '',
  coverage_area: '',
  listings_ready: '',
  branches: '',
  focus_areas: [],
  services: [],
  volume: '',
  preferred_contact: 'WhatsApp',
  contact_time: '',
  doc_url: '',
  message: '',
  agree_terms: false,
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-[#efe7db] p-3 sm:p-4">
      <div>
        <p className={sectionTitle}>{title}</p>
        {note ? <p className="mt-0.5 text-xs text-[#8a928e]">{note}</p> : null}
      </div>
      {children}
    </div>
  )
}

function Chips({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (item: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value.includes(option)
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition ' +
              (active ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white' : 'border-[#e0d5c4] bg-white text-[#33433d] hover:border-[#0b3d2e]')
            }
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

export function PartnershipForm() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const isOwner = form.kind === 'owner'
  const isCorporate = form.kind === 'agency' || form.kind === 'institution' || form.kind === 'notary'
  const isNotary = form.kind === 'notary'
  const showBusiness = !isOwner
  const serviceOptions = SERVICE_OPTIONS[form.kind]
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))
  const toggle = (key: 'focus_areas' | 'services', item: string) =>
    setForm((prev) => ({ ...prev, [key]: prev[key].includes(item) ? prev[key].filter((entry) => entry !== item) : [...prev[key], item] }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      const payload = {
        ...form,
        branches: form.branches || null,
        founded_year: form.founded_year || null,
        team_size: form.team_size || null,
        listings_ready: form.listings_ready || null,
      }
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(String(body?.error ?? 'Gagal mengirim pengajuan'))
      setResult({ tone: 'ok', text: 'Pengajuan kemitraan Anda diterima. Tim Homy akan menghubungi Anda maksimal 1×24 jam kerja untuk verifikasi dan penandatanganan perjanjian.' })
      setForm(EMPTY)
    } catch (error) {
      setResult({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal mengirim pengajuan' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form id="daftar" onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-4 shadow-[0_10px_35px_rgba(20,42,32,.06)] sm:p-6 md:p-8">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-[#c9a961] text-[#0b3d2e]"><Handshake /></span>
        <div>
          <h2 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Ajukan kemitraan</h2>
          <p className="text-sm text-[#718078]">Gratis, tanpa biaya pendaftaran. Isi data selengkap mungkin agar verifikasi lebih cepat.</p>
        </div>
      </div>

      <Section title="Jenis kemitraan" note="Pilih salah satu; kolom di bawah menyesuaikan otomatis.">
        <label className={label}>Jenis kemitraan *
          <select required value={form.kind} onChange={(event) => set('kind', event.target.value as PartnerKind)} className={field}>
            {PARTNER_KIND_ORDER.map((kind) => <option key={kind} value={kind}>{PARTNER_KINDS[kind].label}</option>)}
          </select>
        </label>
      </Section>

      <Section title="Data penanggung jawab">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Nama lengkap PIC *<input required value={form.full_name} onChange={(event) => set('full_name', event.target.value)} className={field} placeholder="Nama penanggung jawab" /></label>
          <label className={label}>Jabatan / peran<input value={form.position} onChange={(event) => set('position', event.target.value)} className={field} placeholder="mis. Director / Branch Manager / Notaris" /></label>
          <label className={label}>Email *<input required type="email" value={form.email} onChange={(event) => set('email', event.target.value)} className={field} placeholder="nama@perusahaan.com" /></label>
          <label className={label}>Telepon / WhatsApp *<input required value={form.phone} onChange={(event) => set('phone', event.target.value)} className={field} placeholder="08xxxxxxxxxx" /></label>
          <label className={label}>Kota *<input required value={form.city} onChange={(event) => set('city', event.target.value)} className={field} placeholder="Jakarta Selatan" /></label>
          <label className={label}>Provinsi<input value={form.province} onChange={(event) => set('province', event.target.value)} className={field} placeholder="DKI Jakarta" /></label>
        </div>
      </Section>

      {showBusiness && (
        <Section
          title={isNotary ? 'Data kantor notaris/PPAT' : 'Data usaha'}
          note={isOwner ? undefined : isCorporate ? 'Wajib untuk agensi, institusi, dan kantor notaris.' : 'Opsional untuk agen perorangan.'}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>{isNotary ? 'Nama kantor notaris/PPAT' : 'Nama perusahaan / agensi'} {isCorporate ? '*' : ''}
              <input required={isCorporate} value={form.company} onChange={(event) => set('company', event.target.value)} className={field} placeholder={isNotary ? 'Kantor Notaris & PPAT ...' : 'PT / Agen properti'} />
            </label>
            <label className={label}>Bentuk badan / kantor
              <select value={form.entity_type} onChange={(event) => set('entity_type', event.target.value)} className={field}>
                <option value="">— Pilih —</option>
                {ENTITY_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>Website<input value={form.website} onChange={(event) => set('website', event.target.value)} className={field} placeholder="https://" /></label>
            <label className={label}>NPWP<input value={form.npwp} onChange={(event) => set('npwp', event.target.value)} className={field} placeholder="00.000.000.0-000.000" /></label>
            <label className={label}>Tahun berdiri<input inputMode="numeric" value={form.founded_year} onChange={(event) => set('founded_year', event.target.value.replace(/[^0-9]/g, '').slice(0, 4))} className={field} placeholder="mis. 2015" /></label>
            <label className={label}>Jumlah personel/agent<input inputMode="numeric" value={form.team_size} onChange={(event) => set('team_size', event.target.value.replace(/[^0-9]/g, ''))} className={field} placeholder="mis. 20" /></label>
            {!isNotary && <label className={label}>Jumlah cabang<input inputMode="numeric" value={form.branches} onChange={(event) => set('branches', event.target.value.replace(/[^0-9]/g, ''))} className={field} placeholder="mis. 24" /></label>}
            <label className={label}>{isNotary ? 'Nomor SK Kemenkumham / keanggotaan INI' : 'No. izin usaha / keanggotaan asosiasi'}
              <input value={form.license_no} onChange={(event) => set('license_no', event.target.value)} className={field} placeholder={isNotary ? 'mis. AHU-... / No. INI' : 'mis. izin broker properti (AREBI)'} />
            </label>
          </div>
        </Section>
      )}

      <Section title={isNotary ? 'Wilayah kerja & layanan' : 'Kapasitas & area fokus'}>
        <label className={label}>{isNotary ? 'Wilayah kerja' : 'Wilayah kerja / cakupan'}<input value={form.coverage_area} onChange={(event) => set('coverage_area', event.target.value)} className={field} placeholder={isNotary ? 'mis. Jakarta Selatan, Depok, Tangerang' : 'mis. Jabodetabek'} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>{isOwner ? 'Jumlah properti yang akan dipasang' : isNotary ? 'Estimasi klien per bulan' : 'Listing siap tayang'}
            <input inputMode="numeric" value={form.listings_ready} onChange={(event) => set('listings_ready', event.target.value.replace(/[^0-9]/g, ''))} className={field} placeholder="mis. 10" />
          </label>
          <label className={label}>Estimasi transaksi / bulan
            <select value={form.volume} onChange={(event) => set('volume', event.target.value)} className={field}>
              <option value="">— Pilih —</option>
              {VOLUME_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div className="space-y-1.5">
          <p className={label}>Fokus area properti <span className="font-normal">(boleh pilih beberapa)</span></p>
          <Chips options={FOCUS_AREA_OPTIONS} value={form.focus_areas} onToggle={(item) => toggle('focus_areas', item)} />
        </div>
        {serviceOptions.length > 0 && (
          <div className="space-y-1.5">
            <p className={label}>{isNotary ? 'Layanan legal yang ditawarkan' : 'Layanan yang Anda tawarkan'} <span className="font-normal">(boleh pilih beberapa)</span></p>
            <Chips options={serviceOptions} value={form.services} onToggle={(item) => toggle('services', item)} />
          </div>
        )}
      </Section>

      <Section title="Preferensi kontak & catatan">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Cara dihubungi
            <select value={form.preferred_contact} onChange={(event) => set('preferred_contact', event.target.value)} className={field}>
              {CONTACT_CHANNELS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={label}>Waktu nyaman dihubungi
            <select value={form.contact_time} onChange={(event) => set('contact_time', event.target.value)} className={field}>
              <option value="">— Pilih —</option>
              {CONTACT_TIMES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <label className={label}>Tautan dokumen pendukung <span className="font-normal">(NIB/akta/SK — opsional)</span>
          <input value={form.doc_url} onChange={(event) => set('doc_url', event.target.value)} className={field} placeholder="https://drive.google.com/..." />
        </label>
        <label className={label}>Pesan / portofolio singkat<textarea rows={4} value={form.message} onChange={(event) => set('message', event.target.value)} className={field + ' h-auto py-3'} placeholder="Ceritakan jumlah listing, area fokus, atau kebutuhan integrasi Anda…" /></label>
      </Section>

      <label className="flex items-start gap-2.5 rounded-xl bg-[#f7f3ec] p-3 text-xs text-[#33433d]">
        <input required type="checkbox" checked={form.agree_terms} onChange={(event) => set('agree_terms', event.target.checked)} className="mt-0.5 size-4 accent-[#0b3d2e]" />
        <span>Saya menyatakan data di atas benar dan menyetujui <a className="font-semibold underline" href="/terms">Syarat &amp; Ketentuan</a> serta <a className="font-semibold underline" href="/privacy">Kebijakan Privasi</a> Homy Property.</span>
      </label>

      {result && <p className={'rounded-xl px-4 py-3 text-sm font-medium ' + (result.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]')}>{result.text}</p>}

      <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0b3d2e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14553f] disabled:opacity-60 sm:w-auto">
        {busy ? 'Mengirim…' : 'Kirim pengajuan kemitraan'}
      </button>
      <p className="text-xs text-[#8a928e]">Data calon mitra tersimpan aman dan hanya dilihat tim partnership Homy. Kami tidak pernah meminta transfer dana ke rekening pribadi; pembayaran komisi hanya ke rekening resmi HOMY (BCA 5211082705 a.n. Anastasia Evi Rahma Dewi).</p>
    </form>
  )
}
