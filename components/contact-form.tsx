'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

const field = 'h-11 w-full rounded-lg border border-[#d8ccbb] bg-white px-3 text-sm text-[#20332c] outline-none focus:border-[#0b3d2e]'
const label = 'text-xs font-semibold text-[#65706c]'

export function ContactForm() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', subject: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'contact', full_name: form.full_name, email: form.email, phone: form.phone, message: form.subject ? '[' + form.subject + '] ' + form.message : form.message }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(String(payload?.error ?? 'Gagal mengirim pesan'))
      setResult({ tone: 'ok', text: 'Pesan Anda terkirim. Tim Homy akan membalas ke email Anda maksimal 1×24 jam kerja.' })
      setForm({ full_name: '', email: '', phone: '', subject: '', message: '' })
    } catch (error) {
      setResult({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal mengirim pesan' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-[0_10px_35px_rgba(20,42,32,.06)] sm:p-8">
      <h2 className="font-serif text-2xl text-[#0b3d2e]">Kirim pesan</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5"><span className={label}>Nama lengkap *</span><input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={field} placeholder="Nama Anda" /></label>
        <label className="flex flex-col gap-1.5"><span className={label}>Email *</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} placeholder="nama@email.com" /></label>
        <label className="flex flex-col gap-1.5"><span className={label}>Nomor telepon / WhatsApp</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} placeholder="08xxxxxxxxxx" /></label>
        <label className="flex flex-col gap-1.5"><span className={label}>Topik</span><select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={field}><option value="">Umum</option><option value="Akun & Login">Akun & Login</option><option value="Listing & Moderasi">Listing & Moderasi</option><option value="Komisi & Pembayaran">Komisi & Pembayaran</option><option value="Kerjasama Institusi">Kerjasama Institusi</option><option value="Laporan Masalah">Laporan Masalah</option></select></label>
      </div>
      <label className="flex flex-col gap-1.5"><span className={label}>Pesan *</span><textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={field + ' h-auto py-3'} placeholder="Tuliskan kebutuhan Anda sedetail mungkin…" /></label>
      {result && <p className={'rounded-xl px-4 py-3 text-sm font-medium ' + (result.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]')}>{result.text}</p>}
      <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14553f] disabled:opacity-60">
        <Send className="size-4" /> {busy ? 'Mengirim…' : 'Kirim pesan'}
      </button>
      <p className="text-xs text-[#8a928e]">Dengan mengirim formulir ini Anda menyetujui <a className="underline" href="/privacy">Kebijakan Privasi</a> kami.</p>
    </form>
  )
}
