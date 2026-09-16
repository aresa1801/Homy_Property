'use client'

import { useMemo, useState } from 'react'
import { DashboardGreeting, DashboardShell } from '@/components/dashboard-shell'
import { useDashboard, shortDate } from '@/lib/dashboard-client'
import { FINANCING_LABEL, INTENT_LABEL, STAGE_LABEL, VERDICT_LABEL, INTEREST_STAGES, TIMELINE_OPTIONS } from '@/lib/interest'

type AdminInterest = {
  id: string
  property_id?: string
  property_title?: string
  user_id?: string
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
  score?: number | null
  ai_verdict?: string | null
  ai_confidence?: number | null
  ai_summary?: string | null
  agent_notes?: string | null
  updated_at?: string | null
  buyer?: { name?: string; email?: string; phone?: string } | null
  owner?: { name?: string; email?: string; phone?: string } | null
}

function rupiah(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) && number > 0 ? 'Rp ' + number.toLocaleString('id-ID') : '-'
}

export default function AdminInterestPage() {
  const { data, loading, reload } = useDashboard('admin')
  const metrics = data.metrics ?? {}
  const rows = (data.interests ?? []) as AdminInterest[]
  const [stage, setStage] = useState('all')
  const [verdict, setVerdict] = useState('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const filtered = useMemo(() => rows.filter((row) => {
    if (stage !== 'all' && String(row.stage ?? 'interest') !== stage) return false
    if (verdict !== 'all' && String(row.ai_verdict ?? 'unclear') !== verdict) return false
    const needle = query.toLowerCase().trim()
    if (!needle) return true
    return `${row.buyer?.name ?? ''} ${row.buyer?.email ?? ''} ${row.owner?.name ?? ''} ${row.property_title ?? ''}`.toLowerCase().includes(needle)
  }), [rows, stage, verdict, query])

  async function updateStage(row: AdminInterest, next: string) {
    setBusy(row.id); setMessage(null)
    try {
      const response = await fetch('/api/interest', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, stage: next }),
      })
      if (!response.ok) throw new Error('Gagal memperbarui tahap.')
      setMessage('Tahap negosiasi diperbarui. Pembeli & agen mendapat notifikasi.')
      reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memperbarui tahap.')
    } finally { setBusy(null) }
  }

  return (
    <DashboardShell role="Admin">
      <div className="mb-5 sm:mb-8">
        <DashboardGreeting
          welcome="Halo, {name}"
          headline="Konfirmasi Ketertarikan & Negosiasi."
          description="Pemantauan lintas platform: siapa yang serius membeli, di properti mana, sejauh mana negosiasinya, dan kesimpulan Homy AI atas peluang transaksinya."
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
        {[
          { label: 'Total konfirmasi', value: metrics.interests ?? rows.length, hint: 'Seluruh platform' },
          { label: 'Cenderung membeli', value: metrics.interestBuyLikely ?? 0, hint: 'Kesimpulan Homy AI' },
          { label: 'Negosiasi', value: metrics.interestNegotiation ?? 0, hint: 'Nego/penawaran' },
          { label: 'Kesepakatan', value: metrics.interestDeal ?? 0, hint: 'Sudah deal' },
          { label: 'Batal', value: metrics.interestLost ?? 0, hint: 'Tidak lanjut' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#e5dccd] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#a18a61]">{item.label}</p>
            <p className="mt-2 font-serif text-2xl text-[#0b3d2e]">{item.value}</p>
            <p className="mt-1 text-xs text-[#718078]">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#e5dccd] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', ...INTEREST_STAGES] as const).map((value) => (
            <button key={value} type="button" onClick={() => setStage(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${stage === value ? 'bg-[#0b3d2e] text-white' : 'border border-[#d8ccbb] text-[#33433d]'}`}>
              {value === 'all' ? `Semua tahap (${rows.length})` : STAGE_LABEL[value].label}
            </button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-[#e5dccd] sm:block" />
          {(['all', 'buy_likely', 'comparing', 'exploring', 'unclear'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setVerdict(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${verdict === value ? 'bg-[#c9a961] text-white' : 'border border-[#d8ccbb] text-[#33433d]'}`}>
              {value === 'all' ? 'Semua kesimpulan' : VERDICT_LABEL[value].label}
            </button>
          ))}
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari pembeli / properti / pemilik…" className="ml-auto w-full rounded-lg border border-[#e8dfd3] px-3 py-2 text-xs sm:w-64" />
        </div>
        {message && <p className="mt-3 rounded-xl bg-[#e8f6ec] px-3 py-2 text-xs text-[#1d6b3a]">{message}</p>}
      </div>

      <div className="mt-4 space-y-3">
        {loading && <div className="h-24 animate-pulse rounded-2xl bg-[#f7f3ec]" />}
        {!loading && !filtered.length && <p className="rounded-2xl border border-[#e5dccd] bg-white p-5 text-sm text-[#718078]">Belum ada konfirmasi ketertarikan pada filter ini.</p>}
        {filtered.map((row) => {
          const stageMeta = STAGE_LABEL[String(row.stage ?? 'interest')] ?? STAGE_LABEL.interest
          const verdictMeta = VERDICT_LABEL[String(row.ai_verdict ?? 'unclear')] ?? VERDICT_LABEL.unclear
          return (
            <div key={row.id} className="rounded-2xl border border-[#e5dccd] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <a href={'/property/' + String(row.property_id)} className="font-semibold text-[#0b3d2e]">{row.property_title ?? 'Properti'}</a>
                <span className={'rounded-full px-2.5 py-1 text-[11px] font-semibold ' + stageMeta.className}>{stageMeta.label}</span>
                <span className={'rounded-full px-2.5 py-1 text-[11px] font-semibold ' + verdictMeta.className}>{verdictMeta.label}{row.ai_confidence ? ` · ${row.ai_confidence}%` : ''}</span>
                <span className="text-[11px] text-[#718078]">skor {Number(row.score ?? 0)}/100 · diperbarui {shortDate(row.updated_at)}</span>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-[#43504a] sm:grid-cols-2">
                <p><strong>Calon pembeli:</strong> {row.buyer?.name ?? 'Pengguna'}{row.buyer?.email ? ` · ${row.buyer.email}` : ''}{row.buyer?.phone ? ` · ${row.buyer.phone}` : ''}</p>
                <p><strong>Pemilik/agen:</strong> {row.owner?.name ?? '-'}{row.owner?.email ? ` · ${row.owner.email}` : ''}</p>
                <p>{INTENT_LABEL[String(row.intent ?? 'undecided')]} · anggaran {rupiah(row.budget)}{row.budget_flexible ? ' (fleksibel)' : ''}</p>
                <p>{FINANCING_LABEL[String(row.financing ?? 'unknown')]} · DP {rupiah(row.down_payment)} · {TIMELINE_OPTIONS.find((option) => option.value === row.timeline)?.label ?? row.timeline ?? '-'}</p>
                <p><strong>Membandingkan properti lain:</strong> {row.has_other_options ? 'Ya' : 'Tidak'}</p>
                <p><strong>Kesiapan:</strong> {row.readiness ?? '-'}</p>
              </div>
              {row.priorities && <p className="mt-1 text-xs text-[#43504a]"><strong>Prioritas:</strong> {row.priorities}</p>}
              {row.comparison_notes && <p className="mt-1 text-xs text-[#43504a]"><strong>Pembanding:</strong> {row.comparison_notes}</p>}
              {row.ai_summary && <p className="mt-2 rounded-xl bg-[#fbfaf7] p-3 text-xs text-[#20332c]"><strong>Kesimpulan Homy AI:</strong> {row.ai_summary}</p>}
              {row.agent_notes && <p className="mt-1 text-xs text-[#43508c]"><strong>Catatan agen:</strong> {row.agent_notes}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-[#43504a]">Ubah tahap:</span>
                {INTEREST_STAGES.map((value) => (
                  <button key={value} type="button" disabled={busy === row.id || value === String(row.stage ?? 'interest')} onClick={() => updateStage(row, value)} className="rounded-full border border-[#d8ccbb] px-3 py-1.5 text-[11px] font-semibold text-[#33433d] disabled:opacity-40">{STAGE_LABEL[value].label}</button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </DashboardShell>
  )
}
