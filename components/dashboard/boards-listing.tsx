'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, RefreshCw, Search } from 'lucide-react'
import { MetricCard } from '@/components/dashboard-shell'
import { resubmitListing, rupiah, runAction, shortDate, STAGE_LABEL, STATUS_LABEL, ui, type DashboardPayload, type DashboardProperty } from '@/lib/dashboard-client'

export type BoardProps = { data: DashboardPayload; loading: boolean; reload: () => void }

const FILTERS: Array<[string, string]> = [['all', 'Semua'], ['published', 'Tayang'], ['pending', 'Menunggu'], ['rejected', 'Ditolak'], ['draft', 'Draf']]

function StatusBadge({ status }: { status?: string }) {
  const meta = STATUS_LABEL[String(status ?? 'draft')] ?? STATUS_LABEL.draft
  return <span className={`${ui.badge} ${meta.className}`}>{meta.label}</span>
}

/** Halaman "Listing Saya" / "Properti Saya": papan lengkap listing + aksi per listing. */
export function ListingBoard({ data, loading, reload, type }: BoardProps & { type: 'agent' | 'property-owner' }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const listings = data.properties ?? []
  const inquiryCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const inquiry of data.inquiries ?? []) counts[String(inquiry.property_id)] = (counts[String(inquiry.property_id)] ?? 0) + 1
    return counts
  }, [data.inquiries])

  const rows = listings.filter((item) => {
    const matchFilter = filter === 'all' || item.status === filter
    const haystack = `${item.title ?? ''} ${item.city ?? ''} ${item.province ?? ''}`.toLowerCase()
    return matchFilter && haystack.includes(query.toLowerCase().trim())
  })

  async function onResubmit(id: string) {
    setBusy(id)
    setMessage(null)
    try {
      await resubmitListing(id)
      setMessage({ tone: 'ok', text: 'Listing diajukan ulang dan masuk antrean moderasi. 😊' })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal mengajukan ulang' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label={type === 'agent' ? 'Total listing' : 'Total properti'} value={String(listings.length)} change={`${listings.filter((p) => p.status === 'published').length} tayang`} icon="home" />
        <MetricCard label="Menunggu moderasi" value={String(listings.filter((p) => p.status === 'pending').length)} change="Perlu ditinjau admin" icon="shield" />
        <MetricCard label="Ditolak" value={String(listings.filter((p) => p.status === 'rejected').length)} change="Bisa diajukan ulang" icon="flag" />
        <MetricCard label="Prospek masuk" value={String((data.inquiries ?? []).length)} change={`${(data.inquiries ?? []).filter((i) => i.status === 'open').length} belum ditindak`} icon="users" />
      </div>

      <div className={ui.card}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === value ? 'bg-[#0b3d2e] text-white' : 'border border-[#d8ccbb] text-[#33433d] hover:bg-[#f7f3ec]'}`}>
                {label}
                {value !== 'all' && <span className="ml-1 opacity-70">{listings.filter((p) => p.status === value).length}</span>}
              </button>
            ))}
          </div>
          <label className="flex w-full items-center gap-2 rounded-lg border border-[#d8ccbb] bg-white px-3 py-2 lg:w-72">
            <Search className="size-4 text-[#a18a61]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul atau kota…" className="w-full bg-transparent text-sm outline-none" />
          </label>
        </div>

        {message && <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>}

        <div className="mt-4 space-y-3">
          {loading && <div className="h-20 animate-pulse rounded-xl bg-[#f7f3ec]" />}
          {!loading && !rows.length && <p className={ui.soft + ' text-sm text-[#718078]'}>Belum ada listing pada filter ini. Mulai pasang properti pertama Anda.</p>}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-1 sm:gap-3">
          {rows.map((item: DashboardProperty) => {
            const stages = (data.inquiries ?? []).filter((inquiry) => inquiry.property_id === item.id)
            const openStages = stages.filter((inquiry) => inquiry.status === 'open').length
            return (
              <div key={item.id} className="rounded-xl border border-[#eee7dc] p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[#20332c] sm:text-base">{item.title ?? 'Listing properti'}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-[#718078] sm:mt-1 sm:text-sm">{[item.district, item.city, item.province].filter(Boolean).join(', ') || 'Lokasi belum diisi'}</p>
                    <p className="mt-0.5 text-xs text-[#718078] sm:mt-1 sm:text-sm">
                      {item.listing_type === 'rent' ? 'Disewakan' : item.listing_type === 'sale' ? 'Dijual' : String(item.listing_type ?? 'Properti')} · {rupiah(item.price)}{item.listing_type === 'rent' ? '/bln' : ''} · {item.property_type ?? '—'} · dikirim {shortDate(item.created_at)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] sm:mt-2 sm:gap-2 sm:text-xs">
                      <span className="rounded-full bg-[#f2f0ea] px-2 py-0.5 font-semibold text-[#718078] sm:px-2.5 sm:py-1">{stages.length} prospek</span>
                      {openStages > 0 && <span className="rounded-full bg-[#fff7e3] px-2 py-0.5 font-semibold text-[#9b762a] sm:px-2.5 sm:py-1">{openStages} belum ditindak</span>}
                      {item.verified_at && <span className="rounded-full bg-[#edf2ed] px-2 py-0.5 font-semibold text-[#4e866d] sm:px-2.5 sm:py-1">Terverifikasi {shortDate(item.verified_at)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.status === 'rejected' && (
                      <button type="button" onClick={() => onResubmit(item.id)} disabled={busy === item.id} className={ui.btn}>
                        <RefreshCw className={`size-3.5 ${busy === item.id ? 'animate-spin' : ''}`} />
                        {busy === item.id ? 'Mengajukan…' : 'Ajukan ulang'}
                      </button>
                    )}
                    {item.status === 'published' && (
                      <a href={`/property/${item.id}`} className={ui.ghost}><ExternalLink className="size-3.5" />Lihat listing</a>
                    )}
                  </div>
                </div>
                {item.status === 'rejected' && item.moderation_note && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff7e3] p-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#9b762a]" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#9b762a]">Catatan moderator</p>
                      <p className="mt-1 text-sm leading-6 text-[#5b4a1f]">{item.moderation_note}</p>
                    </div>
                  </div>
                )}
                {item.ai_summary && <p className="mt-3 border-t border-[#f2ede4] pt-3 text-xs leading-5 text-[#8a938f]">{String(item.ai_summary).slice(0, 240)}</p>}
              </div>
            )
          })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Halaman "Pertanyaan" (owner) / "CRM Prospek" (agent): pipeline + balasan. */
export function LeadsBoard({ data, loading, reload, type }: BoardProps & { type: 'agent' | 'property-owner' }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const leads = data.inquiries ?? []
  const counts = Object.keys(STAGE_LABEL).map((stage) => [stage, leads.filter((lead) => (lead.status ?? 'open') === stage).length] as const)

  async function update(id: string, patch: Record<string, unknown>, successText: string) {
    setBusy(true)
    setMessage(null)
    try {
      await runAction({ kind: 'inquiry.update', id, ...patch })
      setMessage({ tone: 'ok', text: successText })
      setOpenId(null)
      setReply('')
      setNote('')
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal memperbarui prospek' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
        {counts.map(([stage, total]) => (
          <div key={stage} className="rounded-2xl border border-[#e5dccd] bg-white p-3 shadow-[0_10px_30px_rgba(20,42,32,.04)] sm:p-5">
            <p className="text-xs leading-snug text-[#718078] sm:text-sm">{STAGE_LABEL[stage].label}</p>
            <p className="mt-1 font-serif text-base leading-tight text-[#0b3d2e] sm:mt-2 sm:text-3xl">{total}</p>
          </div>
        ))}
      </div>

      {message && <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {loading && <div className="h-28 animate-pulse rounded-2xl bg-white" />}
        {!loading && !leads.length && <p className={ui.card + ' text-sm text-[#718078]'}>Belum ada {type === 'agent' ? 'prospek' : 'pertanyaan'} masuk. Begitu ada yang bertanya, semua tersimpan di sini.</p>}
        {leads.map((lead) => {
          const stage = STAGE_LABEL[String(lead.status ?? 'open')] ?? STAGE_LABEL.open
          const expanded = openId === lead.id
          return (
            <div key={lead.id} className={ui.card}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#20332c]">{lead.from?.name || 'Calon pembeli'}</p>
                  <p className="mt-0.5 truncate text-xs text-[#718078]">{lead.property_title ?? 'Properti'} · {shortDate(lead.created_at)}</p>
                  {lead.from?.email && <p className="mt-0.5 truncate text-xs text-[#a18a61]">{lead.from.email}{lead.from.phone ? ` · ${lead.from.phone}` : ''}</p>}
                </div>
                <span className={`${ui.badge} ${stage.className}`}>{stage.label}</span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#33433d]">{lead.message ?? 'Tidak ada pesan.'}</p>
              {lead.reply_message && (
                <div className="mt-3 rounded-xl bg-[#edf2ed] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#4e866d]">Balasan Anda · {shortDate(lead.replied_at)}</p>
                  <p className="mt-1 text-sm text-[#0b3d2e]">{lead.reply_message}</p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => { setOpenId(expanded ? null : lead.id); setReply(lead.reply_message ?? ''); setNote(lead.follow_up_note ?? '') }} className={ui.ghost}>{expanded ? 'Tutup' : 'Tindak lanjut'}</button>
                {lead.status !== 'closed' && <button type="button" disabled={busy} onClick={() => update(lead.id, { status: 'closed' }, 'Prospek ditandai selesai.')} className={ui.ghost}>Tandai selesai</button>}
              </div>
              {expanded && (
                <div className="mt-4 space-y-3 border-t border-[#f2ede4] pt-4">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STAGE_LABEL).map(([value, meta]) => (
                      <button key={value} type="button" disabled={busy} onClick={() => update(lead.id, { status: value }, `Tahap diubah ke ${meta.label}.`)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${lead.status === value ? 'bg-[#0b3d2e] text-white' : 'border border-[#d8ccbb] text-[#33433d]'}`}>{meta.label}</button>
                    ))}
                  </div>
                  <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder="Tulis balasan untuk calon pembeli…" className={ui.input} />
                  <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan internal (tidak dikirim ke pembeli)" className={ui.input} />
                  <button type="button" disabled={busy || (!reply.trim() && !note.trim())} onClick={() => update(lead.id, { reply, notes: note }, 'Balasan disimpan.')} className={ui.btn}>{busy ? 'Menyimpan…' : 'Simpan balasan'}</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Halaman "Analitik": kinerja listing & prospek per properti. */
export function AnalyticsBoard({ data, loading, type }: BoardProps & { type: 'agent' | 'property-owner' }) {
  const listings = data.properties ?? []
  const leads = data.inquiries ?? []
  const priceOf = (item: DashboardProperty) => (typeof item.price === 'string' ? Number(item.price) : item.price ?? 0)
  const avgPrice = listings.length ? Math.round(listings.reduce((sum, item) => sum + Number(priceOf(item) ?? 0), 0) / listings.length) : 0
  const closed = leads.filter((lead) => lead.status === 'closed').length
  const replied = leads.filter((lead) => lead.reply_message).length
  const responseRate = leads.length ? Math.round((replied / leads.length) * 100) : 0
  const conversion = leads.length ? Math.round((closed / leads.length) * 100) : 0
  const maxLead = Math.max(1, ...Object.values(STAGE_LABEL).map((_, index) => leads.filter((lead) => (lead.status ?? 'open') === Object.keys(STAGE_LABEL)[index]).length))
  const cities = listings.reduce<Record<string, number>>((acc, item) => { const key = item.city ?? 'Lainnya'; acc[key] = (acc[key] ?? 0) + 1; return acc }, {})

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Listing aktif" value={String(listings.filter((item) => item.status === 'published').length)} change={`dari ${listings.length} listing`} icon="home" />
        <MetricCard label="Harga rata-rata" value={rupiah(avgPrice)} change="Semua listing Anda" icon="chart" />
        <MetricCard label="Tingkat respons" value={`${responseRate}%`} change={`${replied} dari ${leads.length} prospek dibalas`} icon="message" />
        <MetricCard label="Konversi selesai" value={`${conversion}%`} change={`${closed} prospek selesai`} icon="sparkles" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={ui.card}>
          <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Prospek per tahap</h3>
          <div className="mt-4 space-y-3">
            {Object.entries(STAGE_LABEL).map(([stage, meta]) => {
              const total = leads.filter((lead) => (lead.status ?? 'open') === stage).length
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between text-sm"><span className="text-[#33433d]">{meta.label}</span><span className="font-semibold text-[#0b3d2e]">{total}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-[#f2f0ea]"><div className="h-2 rounded-full bg-[#c9a961]" style={{ width: `${Math.round((total / maxLead) * 100)}%` }} /></div>
                </div>
              )
            })}
          </div>
        </div>
        <div className={ui.card}>
          <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Sebaran kota</h3>
          {Object.keys(cities).length === 0 && <p className="mt-3 text-sm text-[#718078]">Belum ada data lokasi.</p>}
          <div className="mt-4 space-y-3">
            {Object.entries(cities).sort((a, b) => b[1] - a[1]).map(([city, total]) => (
              <div key={city}>
                <div className="flex items-center justify-between text-sm"><span className="text-[#33433d]">{city}</span><span className="font-semibold text-[#0b3d2e]">{total}</span></div>
                <div className="mt-1 h-2 rounded-full bg-[#f2f0ea]"><div className="h-2 rounded-full bg-[#0b3d2e]" style={{ width: `${Math.round((total / Math.max(1, listings.length)) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={ui.card}>
        <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Kinerja per {type === 'agent' ? 'listing' : 'properti'}</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#a18a61]">
              <tr><th className="pb-3">Properti</th><th className="pb-3">Status</th><th className="pb-3">Harga</th><th className="pb-3">Prospek</th><th className="pb-3">Dibalas</th><th className="pb-3">Selesai</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td className="py-3 text-[#718078]" colSpan={6}>Memuat…</td></tr>}
              {!loading && !listings.length && <tr><td className="py-3 text-[#718078]" colSpan={6}>Belum ada listing.</td></tr>}
              {listings.map((item) => {
                const own = leads.filter((lead) => lead.property_id === item.id)
                return (
                  <tr key={item.id} className="border-t border-[#f2ede4]">
                    <td className="py-3 font-medium text-[#20332c]">{item.title ?? 'Listing'}<p className="text-xs font-normal text-[#718078]">{item.city ?? ''}</p></td>
                    <td className="py-3"><span className={`${ui.badge} ${(STATUS_LABEL[String(item.status)] ?? STATUS_LABEL.draft).className}`}>{(STATUS_LABEL[String(item.status)] ?? STATUS_LABEL.draft).label}</span></td>
                    <td className="py-3 text-[#33433d]">{rupiah(item.price)}{item.listing_type === 'rent' ? '/bln' : ''}</td>
                    <td className="py-3 text-[#33433d]">{own.length}</td>
                    <td className="py-3 text-[#33433d]">{own.filter((lead) => lead.reply_message).length}</td>
                    <td className="py-3 text-[#33433d]">{own.filter((lead) => lead.status === 'closed').length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
