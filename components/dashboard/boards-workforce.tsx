'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, AtSign, Building2, Camera, Check, CheckCircle2, ChevronRight, ClipboardList, Clock,
  Copy, FileText, Loader2, MessageSquare, PenLine, Play, Power, RefreshCw, Send, ShieldAlert, Sparkles, Target, TrendingUp, Users, X,
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
type Target = {
  id: string; period: string; title: string; metric: string | null
  target_value: number; current_value: number; unit: string | null
  owner_slug: string | null; status: string; source: string; notes: string | null; created_at: string
}
type Payload = {
  configured: boolean; model: string; employees: Employee[]; items: Item[]; runs: Run[]; targets: Target[]
  stats: { activeEmployees: number; totalEmployees: number; awaitingApproval: number; openAlerts: number; itemsToday: number; doneToday: number; lastRunAt: string | null }
}

const KIND_META: Record<string, { label: string; icon: typeof FileText }> = {
  briefing: { label: 'Briefing', icon: Sparkles },
  report: { label: 'Laporan', icon: FileText },
  alert: { label: 'Anomali', icon: ShieldAlert },
  reply_draft: { label: 'Draf Balasan', icon: MessageSquare },
  content_draft: { label: 'Konten Sosial', icon: PenLine },
  growth_plan: { label: 'Rencana Pertumbuhan', icon: TrendingUp },
  listing_task: { label: 'Tugas Listing', icon: Building2 },
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
async function copyText(t: string) { try { await navigator.clipboard.writeText(t) } catch { /* abaikan */ } }

/** Homy AI Workforce — kantor AI: karyawan elite + antrean kerja + laporan. */
export function WorkforceBoard(props: BoardProps & { type?: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'office' | 'reports' | 'jobs' | 'chat' | 'targets' | 'social'>('office')
  const [social, setSocial] = useState<SocialStatus | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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

  const loadSocial = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/meta/status', { cache: 'no-store' })
      const p = await res.json().catch(() => ({}))
      if (res.ok) setSocial(p as SocialStatus)
    } catch { /* abaikan */ }
  }, [])

  useEffect(() => { void load(); void loadSocial() }, [load, loadSocial])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const meta = sp.get('meta')
    if (!meta) return
    if (meta === 'ok') { setNotice(sp.get('msg') || 'Koneksi sosial berhasil disimpan.'); setTab('social') }
    else { setError(sp.get('msg') || 'Koneksi sosial gagal.'); setTab('social') }
    const u = new URL(window.location.href)
    u.searchParams.delete('meta'); u.searchParams.delete('msg')
    window.history.replaceState({}, '', u.toString())
  }, [])

  const run = useCallback(async (scope: 'core' | 'content' | 'extended' = 'core') => {
    setBusy(`run:${scope}`); setError(null)
    try {
      const res = await fetch('/api/admin/workforce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run', scope }) })
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

  const disconnect = useCallback(async (channel: string) => {
    setBusy(`dc:${channel}`); setError(null)
    try {
      const res = await fetch('/api/admin/meta/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect', channel }) })
      const p = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(p?.error ?? 'Gagal memutuskan koneksi.')
      setSocial((s) => (s ? { ...s, connections: Array.isArray(p.connections) ? p.connections : [] } : s))
      setNotice('Koneksi diputuskan.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Terjadi kesalahan') }
    finally { setBusy(null) }
  }, [])

  const publish = useCallback(async (id: string) => {
    setBusy(`pub:${id}`); setError(null); setNotice(null)
    try {
      const res = await fetch('/api/admin/meta/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: id }) })
      const p = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(p?.error ?? 'Gagal menerbitkan.')
      setNotice(`Terkirim ke ${str(p.channel)} ✅ (id ${str(p.externalId)})`)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Terjadi kesalahan') }
    finally { setBusy(null) }
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
            <button type="button" onClick={() => void run('content')} className={ui.ghost} disabled={!!busy}>{busy === 'run:content' ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />} Konten</button>
            <button type="button" onClick={() => void run('extended')} className={ui.ghost} disabled={!!busy}>{busy === 'run:extended' ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />} Pertumbuhan</button>
            <button type="button" onClick={() => void run('core')} className={ui.btn} disabled={!!busy}>{busy === 'run:core' ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {busy === 'run:core' ? 'Menjalankan…' : 'Jalankan Siklus'}</button>
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
      {notice && <p className="rounded-lg bg-[#e7f2ea] px-3 py-2 text-sm text-[#2f7a52]">{notice}</p>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'chat'} onClick={() => setTab('chat')} icon={MessageSquare}>Chat dengan COO</TabButton>
        <TabButton active={tab === 'social'} onClick={() => setTab('social')} icon={AtSign}>Koneksi Sosial</TabButton>
        <TabButton active={tab === 'office'} onClick={() => setTab('office')} icon={Building2}>Kantor & Antrean</TabButton>
        <TabButton active={tab === 'targets'} onClick={() => setTab('targets')} icon={Target}>Target & Kinerja</TabButton>
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

      {tab === 'chat' && <ChatPanel />}

      {tab === 'social' && <SocialPanel status={social} items={items} busy={busy} onReload={loadSocial} onDisconnect={disconnect} onPublish={publish} />}

      {tab === 'targets' && <TargetsPanel targets={data?.targets ?? []} employees={employees} onChange={() => void load()} />}

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
  const channel = item.kind === 'content_draft' ? str(item.payload?.channel) : ''
  const postBody = item.kind === 'content_draft' ? str(item.payload?.body) : ''
  const hashtags = item.kind === 'content_draft' ? arr(item.payload?.hashtags) : []
  const cta = item.kind === 'content_draft' ? str(item.payload?.cta) : ''
  const postText = [postBody, cta, hashtags.join(' ')].filter(Boolean).join('\n\n')
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
      {item.kind === 'content_draft' && (
        <div className="mt-2 rounded-lg border border-[#d8ccbb] bg-white px-3 py-2 text-sm leading-6 text-[#33433d]">
          <div className="mb-1 flex items-center gap-2">
            {channel === 'threads' ? <AtSign className="size-4 text-[#0b3d2e]" /> : <Camera className="size-4 text-[#0b3d2e]" />}
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#a18a61]">{channel === 'threads' ? 'Threads' : 'Instagram'}</span>
          </div>
          <p className="whitespace-pre-wrap">{postBody}</p>
          {cta && <p className="mt-1 font-medium text-[#0b3d2e]">{cta}</p>}
          {!!hashtags.length && <p className="mt-1 text-[#4e866d]">{hashtags.join(' ')}</p>}
          <button type="button" onClick={() => void copyText(postText)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0b3d2e] hover:underline"><Copy className="size-3.5" /> Salin teks</button>
        </div>
      )}
      {!reply && item.kind !== 'content_draft' && item.summary && <p className="mt-2 text-sm leading-6 text-[#33433d]">{item.summary}</p>}

      {canDecide ? (
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => onDecide(item.id, 'reject')} className={ui.ghost}><X className="size-4" /> Tolak</button>
          <button type="button" disabled={busy} onClick={() => onDecide(item.id, 'approve')} className={ui.btn}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {item.kind === 'reply_draft' ? 'Setujui & kirim' : item.kind === 'content_draft' ? 'Setujui (siap unggah)' : 'Setujui'}</button>
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

type ChatMsg = { id: string; role: string; content: string }

/** Chat langsung dengan COO: tanya kondisi, tetapkan target, minta review. */
function ChatPanel() {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/workforce/coo', { cache: 'no-store' })
      const p = await res.json().catch(() => ({}))
      if (res.ok) setMessages(Array.isArray(p.messages) ? p.messages : [])
    } catch { /* abaikan */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, sending])

  const send = useCallback(async (preset?: string) => {
    const content = (preset ?? text).trim()
    if (!content || sending) return
    setSending(true); setErr(null); setText('')
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content }])
    try {
      const res = await fetch('/api/admin/workforce/coo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: content }) })
      const p = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(p?.error ?? 'COO tidak merespons.')
      const actions: string[] = Array.isArray(p.actions) ? p.actions : []
      const body = [str(p.reply), actions.length ? actions.map((a) => `• ${a}`).join('\n') : ''].filter(Boolean).join('\n\n')
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: body }])
    } catch (e) { setErr(e instanceof Error ? e.message : 'Terjadi kesalahan') }
    finally { setSending(false) }
  }, [text, sending])

  const chips = ['Apa yang perlu saya putuskan hari ini?', 'Buat target mingguan', 'Review kerja tim hari ini', 'Bagaimana kondisi pipeline sekarang?']

  return (
    <div className={`${ui.card} flex h-[70vh] flex-col`}>
      <div className="flex items-center gap-3 border-b border-[#eee7dc] pb-3">
        <span className="grid size-11 place-items-center rounded-xl bg-[#0b3d2e] text-xl">🧠</span>
        <div>
          <p className="text-sm font-semibold text-[#0b3d2e]">Ayana — Chief Operating Officer</p>
          <p className="text-xs text-[#8a9a92]">Tetapkan target, minta review, atau tanyakan kondisi operasional.</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-3">
        {loading ? <p className="text-sm text-[#718078]">Memuat percakapan…</p> : null}
        {!loading && !messages.length ? (
          <div className="rounded-xl bg-[#f7f3ec] px-3 py-3 text-sm text-[#5c5133]">
            Mulai percakapan dengan COO. Contoh: <span className="italic">“Buat target mingguan: 10 prospek dibalas.”</span>
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={m.role === 'user' ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-[#0b3d2e] px-3.5 py-2 text-sm leading-6 text-white' : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-[#f7f3ec] px-3.5 py-2 text-sm leading-6 text-[#33433d]'}>{m.content}</div>
          </div>
        ))}
        {sending ? <div className="flex justify-start"><div className="rounded-2xl bg-[#f7f3ec] px-3.5 py-2 text-sm text-[#718078]"><Loader2 className="inline size-4 animate-spin" /> Ayana sedang menyusun…</div></div> : null}
        <div ref={endRef} />
      </div>

      {err && <p className="mb-2 rounded-lg bg-[#fbeeec] px-3 py-2 text-sm text-[#b45c50]">{err}</p>}

      <div className="flex flex-wrap gap-1.5 pb-2">
        {chips.map((c) => (
          <button key={c} type="button" disabled={sending} onClick={() => void send(c)} className="rounded-full bg-[#f2ecdf] px-2.5 py-1 text-[11px] font-semibold text-[#7a6031] hover:bg-[#ece2cd] disabled:opacity-50">{c}</button>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-[#eee7dc] pt-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} rows={2} placeholder="Tulis pesan untuk COO…" className="min-h-[44px] flex-1 resize-none rounded-xl border border-[#e2d9c9] bg-white px-3 py-2 text-sm text-[#33433d] outline-none focus:border-[#0b3d2e]" />
        <button type="button" onClick={() => void send()} disabled={sending || !text.trim()} className={ui.btn}><Send className="size-4" /> Kirim</button>
      </div>
    </div>
  )
}

const PERIOD_LABEL: Record<string, string> = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' }
const inputCls = 'w-full rounded-xl border border-[#e2d9c9] bg-white px-3 py-2 text-sm text-[#33433d] outline-none focus:border-[#0b3d2e]'

/** Tetapkan & pantau target harian/mingguan/bulanan. */
function TargetsPanel({ targets, employees, onChange }: { targets: Target[]; employees: Employee[]; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ period: 'weekly', title: '', metric: '', target_value: '', unit: '', owner_slug: '' })

  const post = useCallback(async (body: Record<string, unknown>, key: string) => {
    setBusy(key); setErr(null)
    try {
      const res = await fetch('/api/admin/workforce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const p = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(p?.error ?? 'Gagal menyimpan.')
      onChange()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Terjadi kesalahan') }
    finally { setBusy(null) }
  }, [onChange])

  const active = targets.filter((t) => t.status === 'active')
  const groups: [string, Target[]][] = [['daily', []], ['weekly', []], ['monthly', []]]
  for (const t of active) { const g = groups.find(([p]) => p === t.period); if (g) g[1].push(t) }

  return (
    <div className="space-y-4">
      <div className={ui.card}>
        <p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><Target className="size-4" /> Tetapkan target baru</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className={inputCls}>
            <option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option>
          </select>
          <input placeholder="Judul target" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          <input placeholder="Metrik (mis. prospek dibalas)" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className={inputCls} />
          <input placeholder="Nilai target" type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} className={inputCls} />
          <input placeholder="Satuan (mis. prospek)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls} />
          <select value={form.owner_slug} onChange={(e) => setForm({ ...form, owner_slug: e.target.value })} className={inputCls}>
            <option value="">Penanggung jawab (opsional)</option>{employees.map((e) => <option key={e.slug} value={e.slug}>{e.name}</option>)}
          </select>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={busy === 'create' || !form.title.trim()} onClick={() => void post({ action: 'target', op: 'create', period: form.period, title: form.title, metric: form.metric, target_value: Number(form.target_value) || 0, unit: form.unit, owner_slug: form.owner_slug }, 'create')} className={ui.btn}>{busy === 'create' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Tambah Target</button>
        </div>
        {err && <p className="mt-2 text-sm text-[#b45c50]">{err}</p>}
      </div>

      {groups.map(([period, list]) => (
        <div key={period} className="space-y-2">
          <p className={ui.eyebrow}>Target {PERIOD_LABEL[period]}</p>
          {!list.length ? <div className={ui.card}><p className="text-sm text-[#718078]">Belum ada target {PERIOD_LABEL[period].toLowerCase()}.</p></div> : list.map((t) => <TargetCard key={t.id} t={t} busy={busy === t.id} onUpdate={(body) => void post({ action: 'target', op: 'update', id: t.id, ...body }, t.id)} />)}
        </div>
      ))}
    </div>
  )
}

function TargetCard({ t, busy, onUpdate }: { t: Target; busy: boolean; onUpdate: (body: Record<string, unknown>) => void }) {
  const pct = t.target_value > 0 ? Math.min(100, Math.round((t.current_value / t.target_value) * 100)) : 0
  const done = t.status === 'achieved'
  return (
    <div className={ui.card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0b3d2e]">{t.title}</p>
          <p className="text-xs text-[#8a9a92]">{t.metric ?? '—'}{t.owner_slug ? ` · ${t.owner_slug}` : ''}{t.source === 'coo' ? ' · dari COO' : ''}</p>
        </div>
        <span className={`${ui.badge} ${done ? 'bg-[#e7f2ea] text-[#2f7a52]' : 'bg-[#f2ecdf] text-[#9b762a]'}`}>{done ? 'Tercapai' : `${pct}%`}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#eee7dc]">
        <div className={`h-full ${done ? 'bg-[#2f7a52]' : 'bg-[#0b3d2e]'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-[#718078]">Capaian: <span className="font-semibold text-[#0b3d2e]">{t.current_value.toLocaleString('id-ID')}</span> / {t.target_value.toLocaleString('id-ID')} {t.unit ?? ''}</p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={() => onUpdate({ current_value: t.current_value + 1 })} className={ui.ghost}>+1 capaian</button>
        {!done && <button type="button" disabled={busy} onClick={() => onUpdate({ status: 'achieved' })} className={ui.btn}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Tandai tercapai</button>}
        <button type="button" disabled={busy} onClick={() => onUpdate({ status: 'archived' })} className={ui.ghost}>Arsip</button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Koneksi Sosial — hubungkan Instagram / Threads & terbitkan konten    */
/* ------------------------------------------------------------------ */

type Connection = {
  channel: 'instagram' | 'threads'; accountId: string | null; username: string | null
  pageId: string | null; pageName: string | null; status: string; expiresAt: string | null
  scopes: string | null; connectedAt: string | null; lastError: string | null
}
type SocialStatus = { configured: { instagram: boolean; threads: boolean }; redirectUri: string; connections: Connection[] }

const CHANNEL_META: Record<'instagram' | 'threads', { label: string; emoji: string }> = {
  instagram: { label: 'Instagram', emoji: '📸' },
  threads: { label: 'Threads', emoji: '🧵' },
}

function SocialPanel({ status, items, busy, onReload, onDisconnect, onPublish }: {
  status: SocialStatus | null; items: Item[]; busy: string | null
  onReload: () => void; onDisconnect: (channel: string) => void; onPublish: (id: string) => void
}) {
  const drafts = items.filter((i) => i.kind === 'content_draft')
  const conn = (ch: 'instagram' | 'threads') => status?.connections.find((c) => c.channel === ch)
  return (
    <div className="space-y-4">
      <div className={ui.card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><AtSign className="size-4" /> Koneksi Sosial</p>
            <p className="mt-1 text-sm text-[#718078]">Hubungkan akun <strong>Instagram Business</strong> &amp; <strong>Threads</strong> sekali di sini. Setelah terhubung, draf konten yang sudah Boss <strong>setujui</strong> bisa langsung diterbitkan — tetap approve-first, tidak ada post otomatis.</p>
          </div>
          <button type="button" onClick={onReload} className={ui.ghost}><RefreshCw className="size-4" /> Muat ulang</button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(['instagram', 'threads'] as const).map((ch) => {
            const c = conn(ch)
            const isConfigured = status?.configured?.[ch]
            const connected = !!c && c.status === 'connected'
            return (
              <div key={ch} className="rounded-xl border border-[#eee7dc] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0b3d2e]">{CHANNEL_META[ch].emoji} {CHANNEL_META[ch].label}</p>
                  <span className={`${ui.badge} ${connected ? 'bg-[#e7f2ea] text-[#2f7a52]' : c?.status === 'error' ? 'bg-[#fbeeec] text-[#b45c50]' : 'bg-[#f2ecdf] text-[#9b762a]'}`}>{connected ? 'Terhubung' : c?.status === 'error' ? 'Error' : 'Belum'}</span>
                </div>
                {connected ? (
                  <div className="mt-2 text-xs text-[#718078]">
                    <p>Akun: <span className="font-semibold text-[#0b3d2e]">@{c?.username || c?.accountId}</span></p>
                    {c?.pageName ? <p>Halaman: {c.pageName}</p> : null}
                    <p>Sejak: {when(c?.connectedAt)}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#8a9a92]">{isConfigured ? 'Belum terhubung.' : 'Kredensial app belum diset di server.'}</p>
                )}
                {c?.lastError ? <p className="mt-1 text-xs text-[#b45c50]">{c.lastError}</p> : null}
                <div className="mt-3 flex gap-2">
                  <a href={`/api/admin/meta/connect?channel=${ch}`} className={ui.btn}>{connected ? 'Hubungkan ulang' : 'Hubungkan'}</a>
                  {c ? <button type="button" disabled={busy === `dc:${ch}`} onClick={() => onDisconnect(ch)} className={ui.ghost}>{busy === `dc:${ch}` ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Putuskan</button> : null}
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[11px] text-[#8a9a92]">Redirect URI (daftarkan di Meta app): <span className="rounded bg-[#f7f3ec] px-1.5 py-0.5 text-[#5c5133]">{status?.redirectUri ?? '—'}</span></p>
      </div>

      <div className="space-y-3">
        <p className={ui.eyebrow}>Draf konten &amp; publikasi ({drafts.length})</p>
        {!drafts.length ? <div className={ui.card}><p className="text-sm text-[#718078]">Belum ada draf konten. Jalankan siklus “Konten”.</p></div> : drafts.map((i) => {
          const ch = String((i.payload as Record<string, unknown>).channel || 'instagram') === 'threads' ? 'threads' : 'instagram'
          return <PublishCard key={i.id} item={i} busy={busy === `pub:${i.id}`} connected={!!conn(ch)} onPublish={onPublish} />
        })}
      </div>
    </div>
  )
}

function PublishCard({ item, busy, connected, onPublish }: { item: Item; busy: boolean; connected: boolean; onPublish: (id: string) => void }) {
  const p = item.payload as Record<string, unknown>
  const pub = p.published as Record<string, unknown> | undefined
  const body = str(p.body)
  const hashtags = arr(p.hashtags)
  return (
    <div className={ui.card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0b3d2e]">{item.title}</p>
          <p className="text-xs text-[#8a9a92]">{str(p.channel)} · {item.status === 'approved' ? 'disetujui' : item.status === 'awaiting_approval' ? 'menunggu keputusan' : item.status}</p>
        </div>
        {pub?.external_id ? <span className={`${ui.badge} bg-[#e7f2ea] text-[#2f7a52]`}>Terbit</span> : <span className={ui.badge}>{str(p.channel)}</span>}
      </div>
      {p.hook ? <p className="mt-2 text-sm font-semibold text-[#33433d]">{str(p.hook)}</p> : null}
      {body ? <p className="mt-1 whitespace-pre-wrap text-sm text-[#5c5133]">{body}</p> : null}
      {hashtags.length ? <p className="mt-1 text-xs text-[#8a9a92]">{hashtags.join(' ')}</p> : null}
      {pub?.external_id ? (
        <p className="mt-2 text-xs text-[#2f7a52]">Terkirim {when(str(pub.posted_at))} · id {str(pub.external_id)}</p>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-[#8a9a92]">{item.status === 'approved' ? (connected ? 'Siap diterbitkan.' : 'Kanal belum terhubung.') : 'Setujui dulu di tab “Kantor & Antrean”.'}</p>
          <button type="button" disabled={busy || item.status !== 'approved' || !connected} onClick={() => onPublish(item.id)} className={ui.btn}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Terbitkan</button>
        </div>
      )}
      {p.publish_error ? <p className="mt-2 text-xs text-[#b45c50]">Gagal: {str(p.publish_error)}</p> : null}
    </div>
  )
}
