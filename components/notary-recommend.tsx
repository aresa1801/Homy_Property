'use client'

import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, ExternalLink, Loader2, MapPin, MessageCircle, Phone, Scale, Send } from 'lucide-react'
import { PROVINCES } from '@/lib/regions'
import { areaLabel, notaryLabel } from '@/lib/notary'

type NotaryCard = {
  id: string
  name?: string | null
  office_name?: string | null
  province?: string | null
  kabupaten?: string | null
  kecamatan?: string | null
  services?: string | null
  focus_areas?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  website?: string | null
  featured?: boolean | null
  notary_areas?: Array<{ province?: string | null; kabupaten?: string | null; kecamatan?: string | null }> | null
}

type Props = {
  propertyId?: string
  propertyTitle?: string
  province?: string | null
  kabupaten?: string | null
  kecamatan?: string | null
  entity?: 'user' | 'agent'
}

const field = 'h-10 w-full rounded-lg border border-[#d8ccbb] bg-white px-3 text-sm text-[#20332c] outline-none focus:border-[#0b3d2e]'
const label = 'flex flex-col gap-1 text-[11px] font-semibold text-[#65706c]'

function waLink(value?: string | null) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '')
  if (!digits) return null
  return `https://wa.me/${digits.startsWith('0') ? '62' + digits.slice(1) : digits}`
}

/**
 * Kartu rekomendasi Notaris/PPAT (opsional) + pengajuan pendampingan notaris.
 * Dipakai di halaman properti: rekomendasi murni dari platform Homy — pengguna bebas
 * memakai notaris pilihannya sendiri.
 */
export function NotaryRecommendCard({ propertyId, propertyTitle, province, kabupaten, kecamatan, entity = 'user' }: Props) {
  const [notaries, setNotaries] = useState<NotaryCard[]>([])
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [canRequest, setCanRequest] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [form, setForm] = useState({
    province: province ?? '',
    kabupaten: kabupaten ?? '',
    kecamatan: kecamatan ?? '',
    message: '',
  })

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (propertyId) params.set('property_id', propertyId)
    if (province) params.set('province', province)
    if (kabupaten) params.set('kabupaten', kabupaten)
    if (kecamatan) params.set('kecamatan', kecamatan)
    return params.toString()
  }, [propertyId, province, kabupaten, kecamatan])

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/notaries?${query}`)
      .then((response) => response.json())
      .then((body) => {
        if (!alive) return
        setNotaries(Array.isArray(body?.data) ? body.data : [])
        setAuthenticated(Boolean(body?.authenticated))
        setCanRequest(Boolean(body?.can_request))
        setReason(typeof body?.reason === 'string' ? body.reason : null)
      })
      .catch(() => { if (alive) setNotaries([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [query])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch('/api/notary-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId ?? null, ...form, intent: entity === 'agent' ? undefined : 'buy' }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401) throw new Error('Masuk dulu untuk mengajukan pendampingan notaris.')
      if (!response.ok) throw new Error(String(body?.error ?? 'Gagal mengirim pengajuan'))
      setResult({ tone: 'ok', text: 'Pengajuan diterima. Tim Homy akan menghubungi Anda dan mengarahkan notaris/PPAT terdekat. Rekomendasi di bawah bersifat opsional.' })
      setOpen(false)
      if (Array.isArray(body?.recommended) && body.recommended.length) setNotaries(body.recommended)
    } catch (error) {
      setResult({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal mengirim pengajuan' })
    } finally {
      setBusy(false)
    }
  }

  const loginHref = `/auth/login?next=${encodeURIComponent(propertyId ? `/property/${propertyId}` : '/notaris')}`

  return (
    <section className="rounded-2xl border border-[#e8dfd3] bg-white p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf2ed] text-[#0b3d2e]"><Scale className="size-5" /></span>
        <div>
          <h2 className="font-serif text-xl text-[#0b3d2e]">Notaris &amp; PPAT pendamping</h2>
          <p className="mt-1 text-sm leading-6 text-[#65706c]">
            Rekomendasi <strong>opsional</strong> dari platform Homy untuk membantu pengurusan AJB/PPAT, balik nama, dan legalitas transaksi.
            Anda tetap bebas memakai notaris pilihan sendiri.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#8a928e]"><Loader2 className="size-4 animate-spin" /> Memuat rekomendasi…</p>
      ) : notaries.length ? (
        <ul className="mt-4 space-y-3">
          {notaries.slice(0, 4).map((notary) => {
            const areas = Array.isArray(notary.notary_areas) ? notary.notary_areas.map((area) => areaLabel(area)).filter(Boolean) : []
            const wa = waLink(notary.whatsapp || notary.phone)
            return (
              <li key={notary.id} className="rounded-xl border border-[#efe7db] p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#0b3d2e]">{notaryLabel(notary)}</p>
                  {notary.featured ? <span className="rounded-full bg-[#fff7e3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9b762a]">Mitra</span> : null}
                  {notary.name && notary.office_name ? <span className="inline-flex items-center gap-1 text-xs text-[#718078]"><BadgeCheck className="size-3.5 text-[#4e866d]" /> {notary.name}</span> : null}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[#718078]">
                  <MapPin className="size-3.5" />
                  {[notary.kecamatan, notary.kabupaten, notary.province].filter(Boolean).join(', ') || areas[0] || 'Wilayah belum dicantumkan'}
                </p>
                {notary.services ? <p className="mt-1 text-xs text-[#65706c]">Layanan: {notary.services}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {wa ? <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b3d2e] px-3 py-1.5 text-xs font-semibold text-white"><MessageCircle className="size-3.5" /> WhatsApp</a> : null}
                  {notary.phone ? <a href={`tel:${notary.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ccbb] px-3 py-1.5 text-xs font-semibold text-[#33433d]"><Phone className="size-3.5" /> Telepon</a> : null}
                  {notary.website ? <a href={notary.website.startsWith('http') ? notary.website : `https://${notary.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ccbb] px-3 py-1.5 text-xs font-semibold text-[#33433d]"><ExternalLink className="size-3.5" /> Profil</a> : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl bg-[#f7f3ec] px-4 py-3 text-sm text-[#65706c]">
          Belum ada notaris mitra Homy di wilayah ini. Anda tetap bisa mengajukan pendampingan — tim Homy akan membantu mencarikan notaris/PPAT terdekat.
        </p>
      )}

      <div className="mt-4 border-t border-[#f0e9df] pt-4">
        {result ? <p className={'mb-3 rounded-xl px-4 py-3 text-sm font-medium ' + (result.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]')}>{result.text}</p> : null}

        {!authenticated ? (
          <a href={loginHref} className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-4 py-2.5 text-sm font-semibold text-white">Masuk untuk ajukan pendampingan notaris</a>
        ) : canRequest ? (
          open ? null : (
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-4 py-2.5 text-sm font-semibold text-white">
              <Scale className="size-4" /> Ajukan pendampingan notaris
            </button>
          )
        ) : (
          <p className="rounded-xl bg-[#f7f3ec] px-4 py-3 text-sm text-[#65706c]">
            🔒 Pengajuan pendampingan notaris aktif setelah Anda menyatakan <strong>minat dan siap bertransaksi</strong> pada properti ini
            (atau bila Anda agen/pemilik properti terkait).
          </p>
        )}

        {authenticated && canRequest && open ? (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={label}>Provinsi
                <select value={form.province} onChange={(event) => setForm((prev) => ({ ...prev, province: event.target.value }))} className={field}>
                  <option value="">— Pilih —</option>
                  {PROVINCES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className={label}>Kabupaten / Kota
                <input value={form.kabupaten} onChange={(event) => setForm((prev) => ({ ...prev, kabupaten: event.target.value }))} className={field} placeholder="mis. Sleman" />
              </label>
              <label className={label}>Kecamatan
                <input value={form.kecamatan} onChange={(event) => setForm((prev) => ({ ...prev, kecamatan: event.target.value }))} className={field} placeholder="mis. Depok" />
              </label>
            </div>
            <label className={label}>Catatan <span className="font-normal">(opsional)</span>
              <textarea rows={2} value={form.message} onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))} className={field + ' h-auto py-2'} placeholder={propertyTitle ? `Kebutuhan legalitas untuk ${propertyTitle}` : 'Kebutuhan legalitas Anda'} />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Kirim pengajuan
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-[#d8ccbb] px-4 py-2.5 text-sm font-semibold text-[#33433d]">Batal</button>
            </div>
          </form>
        ) : null}

        <p className="mt-3 text-xs text-[#8a928e]">
          Rekomendasi bersifat opsional — Homy tidak mewajibkan penggunaan notaris mitra, dan tidak memungut biaya atas pengajuan ini.
        </p>
      </div>
    </section>
  )
}
