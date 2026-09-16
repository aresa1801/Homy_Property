'use client'

/**
 * Konfirmasi Ketertarikan — panel bersama.
 *
 * - mode="user"  → pembeli/penyewa mengisi & memperbarui konfirmasi + melihat kesimpulan Homy AI.
 * - mode="agent" → agen/pemilik memantau konfirmasi atas listing-nya, ubah tahap negosiasi,
 *                  dan melihat kesimpulan AI (akan membeli / membandingkan / cari opsi lain).
 */

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { BadgeCheck, Brain, Building2, CalendarClock, Coins, RefreshCw, Scale, Sparkles, Trash2, Wallet } from 'lucide-react'
import {
  FINANCING_LABEL, INTENT_LABEL, READINESS_LABEL, STAGE_LABEL, VERDICT_LABEL,
  TIMELINE_OPTIONS, INTEREST_STAGES,
} from '@/lib/interest'
import { firstMediaUrl, formatPriceWithPeriod, propertyLocation } from '@/lib/property-format'

type InterestRow = {
  id: string
  property_id: string
  user_id: string
  intent?: string | null
  readiness?: string | null
  stage?: string | null
  budget?: number | string | null
  budget_flexible?: boolean | null
  timeline?: string | null
  financing?: string | null
  down_payment?: number | string | null
  has_other_options?: boolean | null
  comparison_notes?: string | null
  priorities?: string | null
  deal_breakers?: string | null
  contact_preference?: string | null
  score?: number | null
  ai_verdict?: string | null
  ai_confidence?: number | null
  ai_summary?: string | null
  ai_signals?: unknown
  ai_analyzed_at?: string | null
  agent_notes?: string | null
  updated_at?: string | null
  property?: Record<string, unknown> | null
  buyer?: { name?: string; email?: string; phone?: string } | null
}

const fetcher = (url: string) => fetch(url).then((response) => response.json())

function rupiah(value: unknown): string {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number <= 0) return '-'
  return 'Rp ' + number.toLocaleString('id-ID')
}

function when(value?: string | null) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB'
  } catch { return '-' }
}

function verdictMeta(verdict?: string | null) {
  return VERDICT_LABEL[String(verdict ?? 'unclear')] ?? VERDICT_LABEL.unclear
}

const EMPTY_FORM = {
  propertyId: '',
  intent: 'buy',
  readiness: 'comparing',
  timeline: '1-3-bulan',
  financing: 'kpr',
  budget: '',
  budgetFlexible: false,
  downPayment: '',
  hasOtherOptions: false,
  comparisonNotes: '',
  priorities: '',
  dealBreakers: '',
  contactPreference: 'chat',
}

function VerdictCard({ row }: { row: InterestRow }) {
  const meta = verdictMeta(row.ai_verdict)
  const confidence = Number(row.ai_confidence ?? 0)
  const signals = Array.isArray(row.ai_signals) ? (row.ai_signals as unknown[]).map((item) => String(item)) : []
  if (!row.ai_verdict && !row.ai_summary) return null
  return (
    <div className="mt-3 rounded-xl border border-[#e5dccd] bg-[#fbfaf7] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0b3d2e]"><Brain className="size-3.5" /> Kesimpulan Homy AI</span>
        <span className={'rounded-full px-2.5 py-1 text-[11px] font-semibold ' + meta.className}>{meta.label}</span>
        {confidence > 0 && <span className="text-[11px] text-[#718078]">keyakinan {confidence}%</span>}
        {row.ai_analyzed_at && <span className="text-[11px] text-[#a18a61]">dianalisis {when(row.ai_analyzed_at)}</span>}
      </div>
      {confidence > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-[#edf2ed]"><div className="h-1.5 rounded-full bg-[#c9a961]" style={{ width: Math.max(4, Math.min(100, confidence)) + '%' }} /></div>
      )}
      {row.ai_summary && <p className="mt-2 text-sm leading-6 text-[#20332c]">{row.ai_summary}</p>}
      {signals.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#43504a]">{signals.map((signal, index) => <li key={index}>{signal}</li>)}</ul>
      )}
    </div>
  )
}

function ScoreBar({ score }: { score?: number | null }) {
  const value = Number(score ?? 0)
  const tone = value >= 70 ? '#1d6b3a' : value >= 45 ? '#c9a961' : '#a1553a'
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-semibold text-[#718078]"><span>Skor ketertarikan</span><span>{value}/100</span></div>
      <div className="mt-1 h-2 rounded-full bg-[#edf2ed]"><div className="h-2 rounded-full" style={{ width: Math.max(3, Math.min(100, value)) + '%', background: tone }} /></div>
    </div>
  )
}

export function InterestPanel({ mode = 'user', compact = false, presetPropertyId = null }: { mode?: 'user' | 'agent'; compact?: boolean; presetPropertyId?: string | null }) {
  const endpoint = mode === 'agent' ? '/api/interest?scope=leads' : '/api/interest'
  const { data, isLoading, mutate } = useSWR<{ data?: InterestRow[]; error?: string }>(endpoint, fetcher)
  const rows = useMemo(() => data?.data ?? [], [data])
  const [form, setForm] = useState({ ...EMPTY_FORM, propertyId: presetPropertyId ?? '' })
  const [editing, setEditing] = useState<string | null>(null)
  const [openForm, setOpenForm] = useState<boolean>(Boolean(presetPropertyId))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [stageDraft, setStageDraft] = useState<Record<string, string>>({})
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})

  useEffect(() => { if (presetPropertyId) { setForm((prev) => ({ ...prev, propertyId: presetPropertyId })); setOpenForm(true) } }, [presetPropertyId])

  const visible = compact ? rows.slice(0, 2) : rows

  function fill(row: InterestRow) {
    setEditing(row.id)
    setOpenForm(true)
    setMessage(null)
    setForm({
      propertyId: row.property_id,
      intent: String(row.intent ?? 'buy'),
      readiness: String(row.readiness ?? 'comparing'),
      timeline: String(row.timeline ?? '1-3-bulan'),
      financing: String(row.financing ?? 'kpr'),
      budget: row.budget ? String(Math.round(Number(row.budget))) : '',
      budgetFlexible: Boolean(row.budget_flexible),
      downPayment: row.down_payment ? String(Math.round(Number(row.down_payment))) : '',
      hasOtherOptions: Boolean(row.has_other_options),
      comparisonNotes: String(row.comparison_notes ?? ''),
      priorities: String(row.priorities ?? ''),
      dealBreakers: String(row.deal_breakers ?? ''),
      contactPreference: String(row.contact_preference ?? 'chat'),
    })
  }

  async function submit() {
    if (!form.propertyId) { setMessage({ tone: 'err', text: 'Pilih properti dulu (buka dari detail properti atau favorit).' }); return }
    setBusy(true); setMessage(null)
    try {
      const response = await fetch('/api/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, budget: form.budget || null, downPayment: form.downPayment || null, analyze: true }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? 'Gagal menyimpan konfirmasi.')
      setMessage({ tone: 'ok', text: 'Konfirmasi tersimpan. Homy AI sudah menganalisis niat Anda.' })
      setEditing(null)
      await mutate()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal menyimpan konfirmasi.' })
    } finally { setBusy(false) }
  }

  async function reanalyze(row: InterestRow) {
    setBusy(true); setMessage(null)
    try {
      const response = await fetch('/api/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: row.property_id,
          intent: row.intent, readiness: row.readiness, timeline: row.timeline, financing: row.financing,
          budget: row.budget, budgetFlexible: row.budget_flexible, downPayment: row.down_payment,
          hasOtherOptions: row.has_other_options, comparisonNotes: row.comparison_notes,
          priorities: row.priorities, dealBreakers: row.deal_breakers, contactPreference: row.contact_preference,
          stage: row.stage, analyze: true,
        }),
      })
      if (!response.ok) throw new Error('Gagal menganalisis ulang.')
      setMessage({ tone: 'ok', text: 'Analisis Homy AI diperbarui.' })
      await mutate()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal menganalisis ulang.' })
    } finally { setBusy(false) }
  }

  async function cancel(row: InterestRow) {
    setBusy(true)
    try {
      const response = await fetch('/api/interest?id=' + row.id, { method: 'DELETE' })
      if (!response.ok) throw new Error('Gagal membatalkan.')
      setMessage({ tone: 'ok', text: 'Konfirmasi dibatalkan.' })
      await mutate()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal membatalkan.' })
    } finally { setBusy(false) }
  }

  async function saveStage(row: InterestRow) {
    const stage = stageDraft[row.id] ?? String(row.stage ?? 'interest')
    setBusy(true)
    try {
      const response = await fetch('/api/interest', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, stage, agentNotes: noteDraft[row.id] ?? row.agent_notes ?? '' }),
      })
      if (!response.ok) throw new Error('Gagal memperbarui tahap.')
      setMessage({ tone: 'ok', text: 'Tahap negosiasi diperbarui. Pembeli mendapat notifikasi.' })
      await mutate()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal memperbarui tahap.' })
    } finally { setBusy(false) }
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {isLoading && <div className="h-16 animate-pulse rounded-xl bg-[#f7f3ec]" />}
        {!isLoading && !rows.length && (
          <p className="text-sm text-[#718078]">Belum ada konfirmasi ketertarikan. Buka properti yang Anda minati, lalu isi <strong>Konfirmasi Ketertarikan</strong> agar Homy Property dapat menyiapkan solusi terbaik untuk kebutuhan Anda.</p>
        )}
        {visible.map((row) => {
          const meta = verdictMeta(row.ai_verdict)
          const stage = STAGE_LABEL[String(row.stage ?? 'interest')] ?? STAGE_LABEL.interest
          return (
            <a key={row.id} href="/dashboard/user/interest" className="block rounded-xl border border-[#eee7dc] p-3 hover:border-[#c9a961]">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-[#20332c]">{String(row.property?.title ?? 'Properti')}</span>
                <span className={'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ' + stage.className}>{stage.label}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#718078]">
                <span className={'rounded-full px-2 py-0.5 font-semibold ' + meta.className}>{meta.label}</span>
                <span>skor {Number(row.score ?? 0)}/100</span>
                <span>diperbarui {when(row.updated_at)}</span>
              </div>
            </a>
          )
        })}
        <a href="/dashboard/user/interest" className="inline-block text-sm font-semibold text-[#0b3d2e]">Kelola konfirmasi ketertarikan →</a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {message && <p className={'rounded-xl px-3 py-2 text-sm ' + (message.tone === 'ok' ? 'bg-[#e8f6ec] text-[#1d6b3a]' : 'bg-[#fdeceb] text-[#a13b2f]')}>{message.text}</p>}

      {mode === 'user' && (
        <div className="rounded-2xl border border-[#e5dccd] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[#33433d]">Ceritakan kebutuhan dan rencana Anda. Dengan mengisi <strong className="text-[#0b3d2e]">Konfirmasi Ketertarikan</strong> ini, Homy Property akan membantu menemukan solusi terbaik untuk investasi maupun kebutuhan properti Anda — dari properti yang paling sesuai, simulasi pembiayaan, hingga langkah terbaik berikutnya.</p>
            <button type="button" onClick={() => { setOpenForm(!openForm); setEditing(null) }} className="rounded-full bg-[#0b3d2e] px-4 py-2 text-xs font-semibold text-white">{openForm ? 'Tutup formulir' : 'Isi konfirmasi baru'}</button>
          </div>

          {openForm && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#43504a] sm:col-span-2">
                ID properti
                <input value={form.propertyId} onChange={(event) => setForm({ ...form, propertyId: event.target.value })} placeholder="Buka dari halaman properti agar terisi otomatis" className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-[#43504a]">Niat
                <select value={form.intent} onChange={(event) => setForm({ ...form, intent: event.target.value })} className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal">
                  {Object.entries(INTENT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-[#43504a]">Kesiapan
                <select value={form.readiness} onChange={(event) => setForm({ ...form, readiness: event.target.value })} className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal">
                  {Object.entries(READINESS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-[#43504a]">Rencana waktu
                <select value={form.timeline} onChange={(event) => setForm({ ...form, timeline: event.target.value })} className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal">
                  {TIMELINE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-[#43504a]">Pembiayaan
                <select value={form.financing} onChange={(event) => setForm({ ...form, financing: event.target.value })} className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal">
                  {Object.entries(FINANCING_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-[#43504a]">Anggaran maksimal (Rp)
                <input value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} inputMode="numeric" placeholder="1500000000" className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-[#43504a]">Dana siap / DP (Rp)
                <input value={form.downPayment} onChange={(event) => setForm({ ...form, downPayment: event.target.value })} inputMode="numeric" placeholder="0" className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal" />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#43504a]"><input type="checkbox" checked={form.budgetFlexible} onChange={(event) => setForm({ ...form, budgetFlexible: event.target.checked })} /> Anggaran masih bisa fleksibel</label>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#43504a]"><input type="checkbox" checked={form.hasOtherOptions} onChange={(event) => setForm({ ...form, hasOtherOptions: event.target.checked })} /> Sedang membandingkan properti lain</label>
              <label className="text-xs font-semibold text-[#43504a] sm:col-span-2">Properti pembanding (yang sedang Anda lihat)
                <textarea value={form.comparisonNotes} onChange={(event) => setForm({ ...form, comparisonNotes: event.target.value })} rows={2} placeholder="Contoh: rumah di Condongcatur harga 1,4 M luas tanah lebih besar" className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-[#43504a]">Hal terpenting bagi Anda
                <textarea value={form.priorities} onChange={(event) => setForm({ ...form, priorities: event.target.value })} rows={2} placeholder="Contoh: dekat sekolah, sertifikat SHM, akses jalan 2 mobil" className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-[#43504a]">Yang bisa membatalkan niat Anda
                <textarea value={form.dealBreakers} onChange={(event) => setForm({ ...form, dealBreakers: event.target.value })} rows={2} placeholder="Contoh: banjir, tidak bisa KPR, harga tidak turun" className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal" />
              </label>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy} onClick={submit} className="rounded-full bg-[#0b3d2e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Menyimpan…' : editing ? 'Perbarui & analisis' : 'Kirim & analisis dengan Homy AI'}</button>
                <span className="text-[11px] text-[#718078]">Semakin lengkap jawaban Anda, semakin tepat solusi yang Homy Property siapkan untuk Anda.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading && <div className="h-24 animate-pulse rounded-xl bg-[#f7f3ec]" />}

      {!isLoading && !rows.length && mode === 'agent' && (
        <p className="rounded-xl border border-[#eee7dc] p-4 text-sm text-[#718078]">Belum ada calon pembeli yang mengonfirmasi ketertarikan pada listing Anda.</p>
      )}

      {rows.map((row) => {
        const stage = STAGE_LABEL[String(row.stage ?? 'interest')] ?? STAGE_LABEL.interest
        const image = row.property ? firstMediaUrl(row.property as never, process.env.NEXT_PUBLIC_SUPABASE_URL) : null
        const title = String(row.property?.title ?? 'Properti')
        return (
          <div key={row.id} className="rounded-2xl border border-[#e5dccd] bg-white p-4">
            <div className="flex gap-3">
              <a href={'/property/' + row.property_id} className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-[#f2f0ea] sm:size-24">
                {image ? <img src={image} alt={title} className="size-full object-cover" /> : <span className="grid size-full place-items-center text-[#a18a61]"><Building2 className="size-5" /></span>}
              </a>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={'/property/' + row.property_id} className="truncate font-semibold text-[#0b3d2e]">{title}</a>
                  <span className={'rounded-full px-2.5 py-1 text-[11px] font-semibold ' + stage.className}>{stage.label}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[#718078]">{row.property ? propertyLocation(row.property as never) : 'Lokasi menyusul'} · {row.property ? formatPriceWithPeriod(Number(row.property.price ?? 0), (row.property.price_period ?? null) as string | null) : '-'}</p>
                {mode === 'agent' && (
                  <p className="mt-1 text-xs font-semibold text-[#33433d]">
                    {row.buyer?.name ?? 'Calon pembeli'} · <span className="font-normal text-[#718078]">{row.buyer?.email ?? '-'}{row.buyer?.phone ? ' · ' + row.buyer.phone : ''}</span>
                  </p>
                )}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p className="flex items-center gap-1 text-xs text-[#43504a]"><Coins className="size-3.5 text-[#a18a61]" />{INTENT_LABEL[String(row.intent ?? 'undecided')]} · anggaran {rupiah(row.budget)}{row.budget_flexible ? ' (fleksibel)' : ''}</p>
                  <p className="flex items-center gap-1 text-xs text-[#43504a]"><Wallet className="size-3.5 text-[#a18a61]" />{FINANCING_LABEL[String(row.financing ?? 'unknown')]} · DP {rupiah(row.down_payment)}</p>
                  <p className="flex items-center gap-1 text-xs text-[#43504a]"><CalendarClock className="size-3.5 text-[#a18a61]" />Rencana: {TIMELINE_OPTIONS.find((option) => option.value === row.timeline)?.label ?? (row.timeline ?? '-')}</p>
                  <p className="flex items-center gap-1 text-xs text-[#43504a]"><Scale className="size-3.5 text-[#a18a61]" />{row.has_other_options ? 'Sedang membandingkan properti lain' : 'Belum membandingkan properti lain'}</p>
                </div>
                <div className="mt-2"><ScoreBar score={row.score} /></div>
                {row.priorities && <p className="mt-2 text-xs text-[#43504a]"><strong>Prioritas:</strong> {row.priorities}</p>}
                {row.comparison_notes && <p className="mt-1 text-xs text-[#43504a]"><strong>Pembanding:</strong> {row.comparison_notes}</p>}
                {row.deal_breakers && <p className="mt-1 text-xs text-[#43504a]"><strong>Bisa membatalkan:</strong> {row.deal_breakers}</p>}
                <VerdictCard row={row} />
                {row.agent_notes && <p className="mt-2 rounded-xl bg-[#f7f9ff] p-3 text-xs text-[#43508c]"><strong>Catatan agen:</strong> {row.agent_notes}</p>}
                {mode === 'user' ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => fill(row)} className="rounded-full border border-[#d8ccbb] px-3 py-1.5 text-xs font-semibold text-[#33433d]">Perbarui</button>
                    <button type="button" disabled={busy} onClick={() => reanalyze(row)} className="inline-flex items-center gap-1 rounded-full border border-[#d8ccbb] px-3 py-1.5 text-xs font-semibold text-[#33433d] disabled:opacity-60"><RefreshCw className="size-3.5" /> Analisis ulang</button>
                    <button type="button" disabled={busy} onClick={() => cancel(row)} className="inline-flex items-center gap-1 rounded-full border border-[#f0d6d2] px-3 py-1.5 text-xs font-semibold text-[#a13b2f] disabled:opacity-60"><Trash2 className="size-3.5" /> Batalkan</button>
                    <span className="text-[11px] text-[#718078]">Diperbarui {when(row.updated_at)}</span>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="text-xs font-semibold text-[#43504a]">Tahap negosiasi
                      <select value={stageDraft[row.id] ?? String(row.stage ?? 'interest')} onChange={(event) => setStageDraft({ ...stageDraft, [row.id]: event.target.value })} className="mt-1 block rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal">
                        {INTEREST_STAGES.map((value) => <option key={value} value={value}>{STAGE_LABEL[value].label}</option>)}
                      </select>
                    </label>
                    <label className="min-w-[220px] flex-1 text-xs font-semibold text-[#43504a]">Catatan agen
                      <input value={noteDraft[row.id] ?? String(row.agent_notes ?? '')} onChange={(event) => setNoteDraft({ ...noteDraft, [row.id]: event.target.value })} placeholder="Contoh: nego harga, minta KPR 15 tahun" className="mt-1 w-full rounded-lg border border-[#e2d8c9] px-3 py-2 text-sm font-normal" />
                    </label>
                    <button type="button" disabled={busy} onClick={() => saveStage(row)} className="inline-flex items-center gap-1 rounded-full bg-[#0b3d2e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"><BadgeCheck className="size-3.5" /> Simpan progres</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {mode === 'user' && rows.length > 0 && (
        <p className="flex items-center gap-1 text-[11px] text-[#718078]"><Sparkles className="size-3.5 text-[#c9a961]" /> Kesimpulan Homy AI bersifat perkiraan dari data yang Anda isi dan riwayat pertanyaan Anda.</p>
      )}
    </div>
  )
}
