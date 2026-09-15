'use client'

import { useState } from 'react'
import { Handshake } from 'lucide-react'

const field = 'h-11 w-full rounded-lg border border-[#d8ccbb] bg-white px-3 text-sm text-[#20332c] outline-none focus:border-[#0b3d2e]'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-[#65706c]'

const KINDS = [
  { value: 'agent', label: 'Agen Properti (komisi 0,5%)' },
  { value: 'owner', label: 'Pemilik Properti (komisi 2%)' },
  { value: 'agency', label: 'Agensi / Broker Properti' },
  { value: 'institution', label: 'Institusi Korporat (developer, bank, perusahaan)' },
]

export function PartnershipForm() {
  const [form, setForm] = useState({ kind: 'agent', full_name: '', email: '', phone: '', company: '', position: '', city: '', province: '', website: '', branches: '', license_no: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const corporate = form.kind === 'agency' || form.kind === 'institution'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, branches: form.branches ? Number(form.branches) : null }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(String(payload?.error ?? 'Gagal mengirim pengajuan'))
      setResult({ tone: 'ok', text: 'Pengajuan kemitraan Anda diterima. Tim Homy akan menghubungi Anda maksimal 1×24 jam kerja untuk verifikasi dan penandatanganan perjanjian.' })
      setForm({ kind: 'agent', full_name: '', email: '', phone: '', company: '', position: '', city: '', province: '', website: '', branches: '', license_no: '', message: '' })
    } catch (error) {
      setResult({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal mengirim pengajuan' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form id="daftar" onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-[0_10px_35px_rgba(20,42,32,.06)] sm:p-8">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#c9a961] text-[#0b3d2e]"><Handshake /></span><div><h2 className="font-serif text-2xl text-[#0b3d2e]">Ajukan kemitraan</h2><p className="text-sm text-[#718078]">Gratis, tanpa biaya pendaftaran.</p></div></div>
      <label className={label}>Jenis kemitraan *<select required value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={field}>{KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Nama lengkap PIC *<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={field} placeholder="Nama penanggung jawab" /></label>
        <label className={label}>Email *<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} placeholder="nama@perusahaan.com" /></label>
        <label className={label}>Telepon / WhatsApp *<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} placeholder="08xxxxxxxxxx" /></label>
        <label className={label}>Kota *<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={field} placeholder="Jakarta Selatan" /></label>
        {corporate && <label className={label}>Nama perusahaan / agensi *<input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={field} placeholder="PT / Agen properti" /></label>}
        {corporate && <label className={label}>Jabatan<input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className={field} placeholder="Director / Branch Manager" /></label>}
        {corporate && <label className={label}>Website<input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={field} placeholder="https://" /></label>}
        {corporate && <label className={label}>Jumlah cabang<input inputMode="numeric" value={form.branches} onChange={(e) => setForm({ ...form, branches: e.target.value.replace(/[^0-9]/g, '') })} className={field} placeholder="mis. 24" /></label>}
        <label className={label}>Provinsi<input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className={field} placeholder="DKI Jakarta" /></label>
        <label className={label}>No. izin usaha / keanggotaan<input value={form.license_no} onChange={(e) => setForm({ ...form, license_no: e.target.value })} className={field} placeholder="mis. izin broker properti" /></label>
      </div>
      <label className={label}>Pesan / portofolio singkat<textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={field + ' h-auto py-3'} placeholder="Ceritakan jumlah listing, area fokus, atau kebutuhan integrasi Anda…" /></label>
      {result && <p className={'rounded-xl px-4 py-3 text-sm font-medium ' + (result.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]')}>{result.text}</p>}
      <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0b3d2e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14553f] disabled:opacity-60 sm:w-auto">
        {busy ? 'Mengirim…' : 'Kirim pengajuan kemitraan'}
      </button>
      <p className="text-xs text-[#8a928e]">Dengan mengirim formulir Anda menyetujui <a className="underline" href="/terms">Syarat &amp; Ketentuan</a> serta <a className="underline" href="/privacy">Kebijakan Privasi</a>. Data calon mitra tersimpan aman dan hanya dilihat tim partnership Homy.</p>
    </form>
  )
}
