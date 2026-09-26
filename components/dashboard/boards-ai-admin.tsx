'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bot, Building2, CheckCircle2, Database, Loader2, RefreshCw, Send, Sparkles, Users, Wand2 } from 'lucide-react'
import { ui, type DashboardPayload } from '@/lib/dashboard-client'

type BoardProps = { data: DashboardPayload; loading: boolean; reload: () => void; type: string }

type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
  tools?: { tool: string; args?: Record<string, unknown> }[]
}

type Analysis = {
  title: string
  summary: string
  metrics: Record<string, unknown>
  insights: string[]
  recommendations: string[]
  risks: string[]
}

type AnalysisRow = { id: string; target_type: string; target_id: string | null; audience_role: string | null; title: string; summary: string | null; model: string | null; created_at: string }

const TARGET_LABEL: Record<string, string> = {
  platform: 'Seluruh platform', agent: 'Agen', owner: 'Pemilik Properti', property: 'Listing Properti', partner: 'Mitra', user: 'Pengguna',
}

const AUDIENCES = [
  { value: 'admin', label: 'Tim Admin (internal)' },
  { value: 'agent', label: 'Agen' },
  { value: 'property_owner', label: 'Pemilik Properti' },
  { value: 'partner', label: 'Mitra' },
  { value: 'user', label: 'Pengguna' },
]

function fmtMoney(value: unknown): string | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return null
  return 'Rp ' + n.toLocaleString('id-ID')
}

function metricText(value: unknown): string {
  if (typeof value === 'number') return value.toLocaleString('id-ID')
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value ?? '—')
}

/** Homy AI Admin — asisten admin yang tahu seluruh database + pembuat analisa. */
export function AiAdminBoard({ data }: BoardProps) {
  const [tab, setTab] = useState<'chat' | 'analyze'>('chat')

  /* ----------------------- chat ----------------------- */
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const suggestions = [
    'Ringkas kondisi platform hari ini',
    'Berapa listing yang menunggu moderasi?',
    'Agen siapa yang paling banyak prospeknya?',
    'Ada mitra yang sedang disanksi aktif?',
    'Prospek dari Homy AI paling banyak tentang properti apa?',
  ]

  const send = useCallback(async (text: string) => {
    const question = text.trim()
    if (!question || busy) return
    setError(null)
    setInput('')
    const history = turns.map((t) => ({ role: t.role, content: t.content }))
    setTurns((prev) => [...prev, { role: 'user', content: question }])
    setBusy(true)
    try {
      const response = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', message: question, history }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'Gagal menghubungi Homy AI Admin.')
      setTurns((prev) => [...prev, { role: 'assistant', content: String(payload.answer ?? ''), tools: payload.tools ?? [] }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setTurns((prev) => [...prev, { role: 'assistant', content: 'Maaf, terjadi kendala saat mengambil data. Coba lagi.' }])
    } finally {
      setBusy(false)
    }
  }, [busy, turns])

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [turns, busy])

  /* --------------------- analyze ---------------------- */
  const users = data.users ?? []
  const properties = data.properties ?? []
  const agents = useMemo(() => users.filter((u) => (u.roles ?? []).some((r) => r === 'agent' || r.startsWith('agent('))), [users])
  const owners = useMemo(() => users.filter((u) => (u.roles ?? []).some((r) => r === 'property_owner' || r.startsWith('property_owner('))), [users])

  const [form, setForm] = useState({ targetType: 'platform', targetId: '', audience: 'admin', notify: false })
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [notified, setNotified] = useState(false)
  const [aBusy, setABusy] = useState(false)
  const [aError, setAError] = useState<string | null>(null)
  const [history, setHistory] = useState<AnalysisRow[]>([])

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/ai', { cache: 'no-store' })
      if (!response.ok) return
      const payload = await response.json().catch(() => ({}))
      setHistory((payload.analyses ?? []) as AnalysisRow[])
    } catch { /* senyap */ }
  }, [])
  useEffect(() => { void loadHistory() }, [loadHistory])

  const targetOptions = useMemo(() => {
    if (form.targetType === 'agent') return agents.map((u) => ({ id: u.id, label: `${u.full_name ?? u.email ?? 'Agen'}${u.listings ? ` · ${u.listings} listing` : ''}` }))
    if (form.targetType === 'owner') return owners.map((u) => ({ id: u.id, label: u.full_name ?? u.email ?? 'Pemilik' }))
    if (form.targetType === 'user') return users.map((u) => ({ id: u.id, label: `${u.full_name ?? u.email ?? 'Pengguna'} (${(u.roles ?? ['user']).join(', ')})` }))
    if (form.targetType === 'property') return properties.map((p) => ({ id: String(p.id), label: `${p.title ?? 'Listing'} · ${[p.district, p.city].filter(Boolean).join(', ')}` }))
    return []
  }, [form.targetType, agents, owners, users, properties])

  const needsTarget = form.targetType !== 'platform'

  async function generate() {
    setABusy(true)
    setAError(null)
    setAnalysis(null)
    setSavedId(null)
    setNotified(false)
    try {
      const response = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'analyze',
          target: { type: form.targetType, id: needsTarget ? form.targetId || undefined : undefined },
          audience: form.audience,
          notify: form.notify,
          save: true,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'Gagal membuat analisa.')
      setAnalysis(payload.analysis as Analysis)
      setSavedId(payload.saved?.id ?? null)
      setNotified(Boolean(payload.saved?.notified))
      void loadHistory()
    } catch (err) {
      setAError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setABusy(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={ui.card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><Bot className="size-4" /> Homy AI Admin — asisten sadar-database</p>
            <p className="mt-1 text-sm text-[#718078]">Tanyakan apa saja tentang data Homy (pengguna, listing, prospek, kunjungan, komisi, sanksi, mitra) atau minta analisa siap-kirim untuk agen, pemilik, dan mitra.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTab('chat')} className={tab === 'chat' ? ui.btn : ui.ghost}><Database className="size-4" /> Tanya Data</button>
            <button type="button" onClick={() => setTab('analyze')} className={tab === 'analyze' ? ui.btn : ui.ghost}><Wand2 className="size-4" /> Buat Analisa</button>
          </div>
        </div>
      </div>

      {tab === 'chat' && (
        <div className={ui.card}>
          <div ref={listRef} className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {!turns.length && (
              <div className="space-y-3">
                <p className="text-sm text-[#718078]">Mulai dengan salah satu pertanyaan ini, atau tulis sendiri. AI akan membaca database untuk menjawab.</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)} className={ui.ghost}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((turn, index) => (
              <div key={index} className={turn.role === 'user' ? 'text-right' : 'text-left'}>
                {!!turn.tools?.length && (
                  <div className="mb-1 flex flex-wrap gap-1">
                    {turn.tools.map((tool, i) => (
                      <span key={i} className="rounded-full bg-[#edf2ed] px-2 py-0.5 text-[11px] font-semibold text-[#4e866d]">🔎 {tool.tool}</span>
                    ))}
                  </div>
                )}
                <div className={'inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ' + (turn.role === 'user' ? 'bg-[#0b3d2e] text-white' : 'bg-[#f7f3ec] text-[#20332c]')}>
                  {turn.content || '…'}
                </div>
              </div>
            ))}
            {busy && <p className="flex items-center gap-2 text-sm text-[#718078]"><Loader2 className="size-4 animate-spin" /> Membaca database & menyusun jawaban…</p>}
          </div>

          {error && <p className="mt-3 rounded-lg bg-[#fbeeec] px-3 py-2 text-sm text-[#b45c50]">{error}</p>}

          <form
            className="mt-4 flex items-end gap-2"
            onSubmit={(event) => { event.preventDefault(); void send(input) }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(input) } }}
              rows={2}
              placeholder="Contoh: ada berapa pengguna yang belum verifikasi mitra? kirim pengingat ke mereka."
              className={ui.input}
            />
            <button type="submit" disabled={busy || !input.trim()} className={`${ui.btn} h-10 px-4`}><Send className="size-4" /> Kirim</button>
          </form>
          <p className="mt-2 text-xs text-[#8a9a92]">AI dapat mengirim notifikasi & membalas pertanyaan atas perintah admin. Semua aksi tercatat di log audit.</p>
        </div>
      )}

      {tab === 'analyze' && (
        <div className="space-y-5">
          <div className={ui.card}>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><Sparkles className="size-4" /> Buat analisa AI</p>
            <p className="mt-1 text-sm text-[#718078]">Pilih target dan audiens. AI akan membaca data terkait lalu menyusun ringkasan, temuan, dan rekomendasi.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1"><span className={ui.eyebrow}>Target</span>
                <select value={form.targetType} onChange={(e) => setForm((p) => ({ ...p, targetType: e.target.value, targetId: '' }))} className={ui.input}>
                  <option value="platform">Seluruh platform</option>
                  <option value="agent">Agen tertentu</option>
                  <option value="owner">Pemilik tertentu</option>
                  <option value="property">Listing tertentu</option>
                  <option value="user">Pengguna tertentu</option>
                </select>
              </label>
              {needsTarget && (
                <label className="space-y-1 sm:col-span-2"><span className={ui.eyebrow}>Pilih {TARGET_LABEL[form.targetType]}</span>
                  <select value={form.targetId} onChange={(e) => setForm((p) => ({ ...p, targetId: e.target.value }))} className={ui.input}>
                    <option value="">— pilih —</option>
                    {targetOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </label>
              )}
              <label className="space-y-1"><span className={ui.eyebrow}>Audiens laporan</span>
                <select value={form.audience} onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))} className={ui.input}>
                  {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </label>
            </div>
            {needsTarget && !targetOptions.length && <p className="mt-2 text-xs text-[#9b762a]">Belum ada {TARGET_LABEL[form.targetType]} pada data dasbor ini.</p>}
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[#33433d]">
                <input type="checkbox" checked={form.notify} onChange={(e) => setForm((p) => ({ ...p, notify: e.target.checked }))} />
                Kirim analisa ke notifikasi target
              </label>
              <button type="button" onClick={generate} disabled={aBusy || (needsTarget && !form.targetId)} className={`${ui.btn} px-4 py-2`}>
                {aBusy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                {aBusy ? 'Menganalisa data…' : 'Buat analisa'}
              </button>
            </div>
            {aError && <p className="mt-3 rounded-lg bg-[#fbeeec] px-3 py-2 text-sm text-[#b45c50]">{aError}</p>}
          </div>

          {analysis && (
            <div className="space-y-4">
              <div className={ui.card}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-xl text-[#0b3d2e]">{analysis.title}</h3>
                  <div className="flex items-center gap-2">
                    {savedId && <span className={`${ui.badge} bg-[#edf2ed] text-[#4e866d]`}>Tersimpan</span>}
                    {notified && <span className={`${ui.badge} bg-[#edf2ed] text-[#4e866d]`}>Notifikasi terkirim</span>}
                  </div>
                </div>
                {analysis.summary && <p className="mt-3 text-sm leading-6 text-[#33433d]">{analysis.summary}</p>}
                {!!Object.keys(analysis.metrics ?? {}).length && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(analysis.metrics).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-[#f7f3ec] px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-[#a18a61]">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-semibold text-[#0b3d2e]">{fmtMoney(value) ?? metricText(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ListCard title="Temuan" icon="insight" items={analysis.insights} />
                <ListCard title="Rekomendasi" icon="action" items={analysis.recommendations} />
              </div>
              {!!analysis.risks?.length && <ListCard title="Risiko & perhatian" icon="risk" items={analysis.risks} />}
            </div>
          )}

          <div className={ui.card}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0b3d2e]">Riwayat analisa</p>
              <button type="button" onClick={() => void loadHistory()} className={ui.ghost}><RefreshCw className="size-4" /> Muat ulang</button>
            </div>
            {!history.length ? (
              <p className="mt-3 text-sm text-[#718078]">Belum ada analisa tersimpan.</p>
            ) : (
              <div className="mt-3 divide-y divide-[#eee7dc]">
                {history.map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#20332c]">{row.title}</p>
                      <p className="mt-0.5 text-xs text-[#718078]">{[TARGET_LABEL[row.target_type] ?? row.target_type, row.audience_role ? `→ ${row.audience_role}` : null, new Date(row.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ListCard({ title, items, icon }: { title: string; items: string[]; icon: 'insight' | 'action' | 'risk' }) {
  if (!items?.length) return null
  const Icon = icon === 'risk' ? AlertTriangle : icon === 'action' ? CheckCircle2 : Users
  const tone = icon === 'risk' ? 'text-[#b45c50]' : 'text-[#0b3d2e]'
  return (
    <div className={ui.card}>
      <p className={`flex items-center gap-2 text-sm font-semibold ${tone}`}><Icon className="size-4" /> {title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-[#33433d]">
        {items.map((item, index) => <li key={index} className="flex gap-2"><span className="text-[#a18a61]">•</span><span>{item}</span></li>)}
      </ul>
    </div>
  )
}

/** Kartu kecil untuk overview admin (dipakai bila perlu). */
export function AiAdminKpi({ icon, value }: { icon?: string; value?: string }) {
  return (
    <div className={ui.soft}>
      <p className="flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><Building2 className="size-4" /> {value ?? '—'}</p>
    </div>
  )
}
