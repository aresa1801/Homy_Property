'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Building2, Check, CheckCircle2, ChevronRight, ClipboardList, Clock,
  FileText, Loader2, MessageSquare, Play, Power, RefreshCw, ShieldAlert, Sparkles, Users, X,
} from 'lucide-react'
import { ui, type DashboardPayload } from '@/lib/dashboard-client'

type BoardProps = { data: DashboardPayload; loading: boolean; reload: () => void; type: string }

type JobCard = { responsibilities?: string[]; standards?: string[]; guardrails?: string[]; escalates?: string[] }
type Employee = {
  id: string; slug: string; name: string; role_title: string; department: string; emoji: string
  mission: string; job_card: JobCard; kpis: string[]; autonomy: string; status: string; sort_order: number
}
type Item = {
  id: string; employee_slug: string; kind: string; title: string; summary: string | null
  status: string; priority: string; requires_approval: boolean
  target_type: string | null; target_id: string | null
  payload: Record<string, unknown>; decided_at: string | null; decision_note: string | null; created_at: string
}
type Run = {
  id: string; trigger: string; status: string; summary: string | null; items_created: number
  employees: { slug: string; work: number; note?: string }[]; started_at: string; finished_at: string | null
}
type Payload = {
  configured: boolean; model: string; employees: Employee[]; items: Item[]; runs: Run[]
  stats: { activeEmployees: number; totalEmployees: number; awaitingApproval: number; openAlerts: number; itemsToday: number; doneToday: number; lastRunAt: string | null }
}

const KIND_META: Record<string, { label: string; icon: typeof FileText }> = {
  briefing: { label: 'Briefing', icon: Sparkles },
  report: { label: 'Laporan', icon: FileText },
  alert: { label: 'Anomali', icon: ShieldAlert },
  reply_draft: { label: 'Draf Balasan', icon: MessageSquare },
  follow_up: { label: 'Tindak Lanjut', icon: Clock },
  task: { label: 'Tugas', icon: ClipboardList },
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: 'Aktif', cls: 'bg-[#e7f2ea] text-[#2f7a52]' },
  planned: { label: 'Segera', cls: 'bg-[#f2ecdf] text-[#9b762a]' },
  paused: { label: 'Nonaktif', cls: 'bg-[#ececec] text-[#6b6b6b]' },
  open: { label: 'Terbuka', cls: 'bg-[#f2ecdf] text-[#9b762a]' },
  awaiting_approval: { label: 'Menunggu keputusan', cls: 'bg-[#fbe9e6] text-[#b4553f]' },
  escalated: { label: 'Eskalasi', cls: 'bg-[#fbe9e6] text-[#b4553f]' },
  approved: { label: 'Disetujui', cls: 'bg-[#e7f2ea] text-[#2f7a52]' },
  done: { label: 'Selesai', cls: 'bg-[#e7f2ea] text-[#2f7a52]' },
  rejected: { label: 'Ditolak', cls: 'bg-[#ececec] text-[#6b6b6b]' },
}

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  urgent: { label: 'Urgent', cls: 'bg-[#b4553f] text-white' },
  high: { label: 'Tinggi', cls: 'bg-[#e8a23d] text-white' },
  normal: { label: 'Normal', cls: 'bg-[#e6ddca] text-[#5c5133]' },
  low: { label: 'Rendah', cls: 'bg-[#eee] text-[#666]' },
}

const AUTONOMY_LABEL: Record<string, string> = { auto: 'Otonom', approve: 'Perlu persetujuan', draft: 'Hanya draf' }

function ago(iso?: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '—'
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.round(h / 24)} hari lalu`
}
function when(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function str(v: unknown): string { return v === null || v === undefined ? '' : String(v) }
function arr(v: unknown): string[] { return Array.isArray(v) ? v.map(String) : [] }

/** Homy AI Workforce — kantor AI: karyawan elite + antrean kerja + laporan. */
export function WorkforceBoard(props: BoardProps & { type?: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'office' | 'reports' | 'jobs'>('office')

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/workforce', { cache: 'no-store' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error ?? 'Gagal memuat AI Workforce.')
      setData(payload as Payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const run = useCallback(async () => {
    setBusy('run'); setError(null)
    try {
      const res = await fetch('/api/admin/workforce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run' }) })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error ?? 'Siklus gagal dijalankan.')
      setData(payload as Payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally { setBusy(null) }
  }, [])

  const decide = useCallback(async (id: string, decision: 'approve' | 'reject') => {
    setBusy(id); setError(null)
    try {
      const res = await fetch('/api/admin/workforce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decide', id, decision }) })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error ?? 'Gagal memproses keputusan.')
      setData(payload as Payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally { setBusy(null) }
  }, [])

  const toggle = useCallback(async (slug: string, status: string) => {
    setBusy(slug); setError(null)
    try {
      const res = await fetch('/api/admin/workforce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle', slug, status }) })
      if (!res.ok) { const p = await res.json().catch(() => ({})); throw new Error(p?.error ?? 'Gagal mengubah status.') }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally { setBusy(null) }
  }, [load])

  const employees = data?.employees ?? []
  const items = data?.items ?? []
  const runs = data?.runs ?? []
  const stats = data?.stats

  const empBySlug = useMemo(() => Object.fromEntries(employees.map((e) => [e.slug, e])), [employees])
  const queue = items.filter((i) => i.status === 'awaiting_approval' || i.status === 'escalated' || i.status === 'open')
  const reports = items.filter((i) => i.kind === 'report' || i.kind === 'briefing')

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className={ui.card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#0b3d2e] text-xl">🏢</span>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]">Kantor AI Homy <span className={`${ui.badge} ${STATUS_META.active.cls}`}>beroperasi</span></p>
              <p className="mt-1 max-w-2xl text-sm text-[#718078]">Tim kecil karyawan AI berkualitas tinggi + 1 mesin koordinasi (COO). Mereka membaca data nyata, menyusun laporan, dan mengusulkan tindakan — keputusan akhir tetap pada manusia.</p>
              <p className="mt-1 text-xs text-[#8a9a92]">Model: {data?.model ?? '—'} · Siklus terakhir: {ago(stats?.lastRunAt)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className={ui.ghost} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Muat ulang</button>
            <button type="button" onClick={() => void run()} className={ui.btn} disabled={busy === 'run'}>{busy === 'run' ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {busy === 'run' ? 'Menjalankan…' : 'Jalankan Siklus'}</button>
          </div>
        </div>

        {/* KPI */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Karyawan aktif" value={`${stats?.activeEmployees ?? 0}/${stats?.totalEmployees ?? 0}`} tone="brand" />
          <Kpi label="Menunggu keputusan" value={String(stats?.awaitingApproval ?? 0)} tone={stats?.awaitingApproval ? 'warn' : 'muted'} />
          <Kpi label="Anomali terbuka" value={String(stats?.openAlerts ?? 0)} tone={stats?.openAlerts ? 'danger' : 'muted'} />
          <Kpi label="Item hari ini" value={String(stats?.itemsToday ?? 0)} tone="muted" />
          <Kpi label="Laporan hari ini" value={String(stats?.doneToday ?? 0)} tone="muted" />
          <Kpi label="Siklus tersimpan" value={String(runs.length)} tone="muted" />
        </div>
      </div>

      {error && <p className="rounded-lg bg-[#fbeeec] px-3 py-2 text-sm text-[#b45c50]">{error}</p>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'office'} onClick={() => setTab('office')} icon={Building2}>Kantor & Antrean</TabButton>
        <TabButton active={tab === 'reports'} onClick={() => setTab('reports')} icon={FileText}>Laporan & Briefing</TabButton>
        <TabButton active={tab === 'jobs'} onClick={() => setTab('jobs')} icon={ClipboardList}>Job Card Karyawan</TabButton>
      </div>

      {tab === 'office' && (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          {/* Kantor: grid karyawan */}
          <div className="space-y-3">
            <p className={ui.eyebrow}>Denah kantor</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {employees.map((e) => <EmployeeCard key={e.slug} e={e} awaiting={items.filter((i) => i.employee_slug === e.slug && (i.status === 'awaiting_approval' || i.status === 'escalated')).length} />)}
            </div>

            <p className={`${ui.eyebrow} pt-2`}>Riwayat siklus</p>
            <div className={ui.card}>
              {!runs.length ? <p className="text-sm text-[#718078]">Belum ada siklus. Klik “Jalankan Siklus”.</p> : (
                <div className="divide-y divide-[#eee7dc]">
                  {runs.slice(0, 6).map((r) => (
                    <div key={r.id} className="flex items-start gap-3 py-2.5">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${r.status === 'ok' ? 'bg-[#2f7a52]' : r.status === 'error' ? 'bg-[#b4553f]' : 'bg-[#e8a23d]'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[#33433d]">{r.summary ? r.summary.slice(0, 160) : 'Siklus dijalankan'}</p>
                        <p className="mt-0.5 text-xs text-[#8a9a92]">{when(r.started_at)} · {r.trigger} · {r.items_created} item{r.employees?.length ? ` · ${r.employees.map((x) => x.slug).join(', ')}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Antrean kerja */}
          <div className="space-y-3">
            <p className={ui.eyebrow}>Antrean kerja & keputusan ({queue.length})</p>
            {!queue.length ? (
              <div className={ui.card}><p className="text-sm text-[#718078]">Tidak ada item menunggu. Kantor bersih. ✅</p></div>
            ) : (
              <div className="space-y-3">
                {queue.map((i) => <QueueCard key={i.id} item={i} employee={empBySlug[i.employee_slug]} busy={busy === i.id} onDecide={decide} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          {!reports.length ? <div className={ui.card}><p className="text-sm text-[#718078]">Belum ada laporan. Jalankan siklus untuk membuat laporan harian.</p></div> : reports.map((i) => <ReportCard key={i.id} item={i} employee={empBySlug[i.employee_slug]} />)}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {employees.map((e) => (
            <div key={e.slug} className={ui.card}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-[#f7f3ec] text-xl">{e.emoji}</span>
                  <div>
                    <p className="font-serif text-lg text-[#0b3d2e]">{e.name}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#a18a61]">{e.role_title}</p>
                  </div>
                </div>
                <span className={`${ui.badge} ${STATUS_META[e.status]?.cls ?? ''}`}>{STATUS_META[e.status]?.label ?? e.status}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#33433d]">{e.mission}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-full bg-[#edf2ed] px-2 py-0.5 font-semibold text-[#4e866d]">{e.department}</span>
                <span className="rounded-full bg-[#f2ecdf] px-2 py-0.5 font-semibold text-[#9b762a]">{AUTONOMY_LABEL[e.autonomy] ?? e.autonomy}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <JobList title="Tanggung jawab" items={e.job_card?.responsibilities} />
                <JobList title="Standar mutu" items={e.job_card?.standards} />
                <JobList title="Batas aman" items={e.job_card?.guardrails} />
                <JobList title="Eskalasi ke manusia" items={e.job_card?.escalates} />
              </div>
              {!!e.kpis?.length && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a18a61]">KPI</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {e.kpis.map((k, idx) => <li key={idx} className="rounded-full bg-[#f7f3ec] px-2 py-0.5 text-[11px] text-[#5c5133]">{k}</li>)}
                  </ul>
                </div>
              )}
              {e.slug !== 'coo' && (
                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={() => void toggle(e.slug, e.status === 'active' ? 'paused' : 'active')} disabled={busy === e.slug} className={e.status === 'active' ? ui.ghost : ui.btn}>
                    <Power className="size-4" /> {e.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'brand' | 'warn' | 'danger' | 'muted' }) {
  const cls = tone === 'brand' ? 'bg-[#0b3d2e] text-white' : tone === 'warn' ? 'bg-[#fbf3e3] text-[#9b762a]' : tone === 'danger' ? 'bg-[#fbe9e6] text-[#b4553f]' : 'bg-[#f7f3ec] text-[#33433d]'
  return (
    <div className={`rounded-xl px-3 py-2 ${cls}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={active ? ui.btn : ui.ghost}><Icon className="size-4" /> {children}</button>
  )
}

function EmployeeCard({ e, awaiting }: { e: Employee; awaiting: number }) {
  return (
    <div className={ui.card}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f7f3ec] text-xl">{e.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-[#0b3d2e]">{e.name}</p>
            <span className={`${ui.badge} ${STATUS_META[e.status]?.cls ?? ''}`}>{STATUS_META[e.status]?.label ?? e.status}</span>
          </div>
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[#a18a61]">{e.role_title}</p>
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#718078]">{e.mission}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-[#8a9a92]">{e.department}</span>
        {awaiting > 0 ? <span className="rounded-full bg-[#fbe9e6] px-2 py-0.5 text-[11px] font-semibold text-[#b4553f]">{awaiting} menunggu</span> : <span className="text-[11px] text-[#8a9a92]">lengang</span>}
      </div>
    </div>
  )
}

function QueueCard({ item, employee, busy, onDecide }: { item: Item; employee?: Employee; busy: boolean; onDecide: (id: string, d: 'approve' | 'reject') => void }) {
  const meta = KIND_META[item.kind] ?? { label: item.kind, icon: ClipboardList }
  const Icon = meta.icon
  const prio = PRIORITY_META[item.priority] ?? PRIORITY_META.normal
  const reply = item.kind === 'reply_draft' ? str(item.payload?.reply) : ''
  const buyerMessage = item.kind === 'reply_draft' ? str(item.payload?.buyer_message) : ''
  const canDecide = item.requires_approval && (item.status === 'awaiting_approval' || item.status === 'escalated' || item.status === 'open')
  return (
    <div className={ui.card}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {employee && <span className="text-lg">{employee.emoji}</span>}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><Icon className="size-4 shrink-0" /> <span className="truncate">{item.title}</span></p>
            <p className="mt-0.5 text-[11px] text-[#8a9a92]">{meta.label} · {employee?.name ?? item.employee_slug} · {ago(item.created_at)}</p>
          </div>
        </div>
        <span className={`${ui.badge} ${prio.cls}`}>{prio.label}</span>
      </div>

      {buyerMessage && <p className="mt-3 rounded-lg bg-[#f7f3ec] px-3 py-2 text-xs text-[#5c5133]"><span className="font-semibold">Pesan prospek:</span> {buyerMessage}</p>}
      {reply && <p className="mt-2 rounded-lg border border-[#d8ccbb] bg-white px-3 py-2 text-sm leading-6 text-[#33433d]"><span className="font-semibold text-[#0b3d2e]">Draf balasan:</span> {reply}</p>}
      {!reply && item.summary && <p className="mt-2 text-sm leading-6 text-[#33433d]">{item.summary}</p>}

      {canDecide ? (
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => onDecide(item.id, 'reject')} className={ui.ghost}><X className="size-4" /> Tolak</button>
          <button type="button" disabled={busy} onClick={() => onDecide(item.id, 'approve')} className={ui.btn}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {item.kind === 'reply_draft' ? 'Setujui & kirim' : 'Setujui'}</button>
        </div>
      ) : (
        <div className="mt-2"><span className={`${ui.badge} ${STATUS_META[item.status]?.cls ?? ''}`}>{STATUS_META[item.status]?.label ?? item.status}</span></div>
      )}
    </div>
  )
}

function ReportCard({ item, employee }: { item: Item; employee?: Employee }) {
  const isBriefing = item.kind === 'briefing'
  const p = item.payload ?? {}
  const metrics = (p.metrics && typeof p.metrics === 'object' ? p.metrics : {}) as Record<string, unknown>
  const showMetrics = !isBriefing && Object.keys(metrics).length > 0
  return (
    <div className={ui.card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-serif text-xl text-[#0b3d2e]">{employee?.emoji} {item.title}</h3>
        <span className="text-xs text-[#8a9a92]">{employee?.name ?? item.employee_slug} · {when(item.created_at)}</span>
      </div>

      <p className="mt-3 text-sm leading-6 text-[#33433d]">{isBriefing ? str(p.briefing) || item.summary : (item.summary || '')}</p>

      {showMetrics && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(metrics).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-[#f7f3ec] px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-[#a18a61]">{k.replace(/_/g, ' ')}</p>
              <p className="text-sm font-semibold text-[#0b3d2e]">{typeof v === 'number' ? v.toLocaleString('id-ID') : str(v)}</p>
            </div>
          ))}
        </div>
      )}

      {isBriefing && !!arr(p.priorities).length && (
        <div className="mt-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><ChevronRight className="size-4" /> Prioritas hari ini</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#33433d]">
            {arr(p.priorities).map((x, i) => <li key={i} className="flex gap-2"><span className="text-[#a18a61]">•</span><span>{x}</span></li>)}
          </ul>
        </div>
      )}

      {!isBriefing && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <MiniList title="Temuan" items={arr(p.insights)} tone="brand" icon={CheckCircle2} />
          <MiniList title="Rekomendasi" items={arr(p.recommendations)} tone="brand" icon={Sparkles} />
        </div>
      )}
      {!isBriefing && !!arr(p.risks).length && <div className="mt-4"><MiniList title="Risiko & perhatian" items={arr(p.risks)} tone="danger" icon={AlertTriangle} /></div>}
    </div>
  )
}

function MiniList({ title, items, tone, icon: Icon }: { title: string; items: string[]; tone: 'brand' | 'danger'; icon: typeof FileText }) {
  if (!items?.length) return null
  return (
    <div>
      <p className={`flex items-center gap-2 text-sm font-semibold ${tone === 'danger' ? 'text-[#b4553f]' : 'text-[#0b3d2e]'}`}><Icon className="size-4" /> {title}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#33433d]">
        {items.map((x, i) => <li key={i} className="flex gap-2"><span className="text-[#a18a61]">•</span><span>{x}</span></li>)}
      </ul>
    </div>
  )
}

function JobList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a18a61]">{title}</p>
      <ul className="mt-1 space-y-1 text-xs leading-5 text-[#4b5a53]">
        {items.map((x, i) => <li key={i} className="flex gap-1.5"><span className="text-[#c3b48d]">–</span><span>{x}</span></li>)}
      </ul>
    </div>
  )
}

/** Kartu kecil overview (dipakai bila perlu). */
export function WorkforceKpi({ value }: { value?: string }) {
  return <div className={ui.soft}><p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><Users className="size-4" /> {value ?? '—'}</p></div>
}
