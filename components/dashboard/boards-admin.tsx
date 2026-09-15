'use client'

import { useMemo, useState } from 'react'
import { AiChat } from '@/components/ai/ai-chat'
import { MetricCard } from '@/components/dashboard-shell'
import { ModerationQueue } from '@/components/moderation-queue'
import type { BoardProps } from '@/components/dashboard/boards-listing'
import { adminAction, rupiah, shortDate, shortDateTime, ui, useDashboard, type DashboardSetting } from '@/lib/dashboard-client'

type AdminType = 'admin' | 'super-admin'

/** useDashboard untuk peran admin & super-admin (payload operasional). */
function useAdminDashboard(type: AdminType) {
  return useDashboard(type)
}

const ROLE_LABEL: Record<string, string> = {
  user: 'Pengguna',
  agent: 'Agen',
  property_owner: 'Pemilik',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

const STATUS_TX: Record<string, { label: string; className: string }> = {
  reported: { label: 'Menunggu verifikasi', className: 'bg-[#fff7e3] text-[#9b762a]' },
  verified: { label: 'Terverifikasi', className: 'bg-[#edf2ed] text-[#4e866d]' },
  rejected: { label: 'Ditolak', className: 'bg-[#fbeeec] text-[#b45c50]' },
}

function Toast({ message }: { message: { tone: 'ok' | 'err'; text: string } | null }) {
  if (!message) return null
  return <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl bg-[#f7f3ec] px-4 py-6 text-center text-sm text-[#718078]">{text}</p>
}

/* ============================ MODERASI LISTING ============================ */
export function ModerationBoard() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={ui.card}>
        <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Antrean moderasi listing</h3>
        <p className="mt-2 text-sm text-[#718078]">Setiap listing baru masuk sebagai <strong>menunggu moderasi</strong>. Setujui untuk menayangkannya di halaman publik, atau tolak dengan catatan agar pemilik bisa memperbaiki dan mengajukan ulang. Keputusan tercatat di log audit dan memicu email ke pemilik (bila email aktif).</p>
      </div>
      <ModerationQueue />
    </div>
  )
}

/* ============================ PENGGUNA & MITRA ============================ */
export function UsersBoard({ data, loading, reload, type }: BoardProps & { type: AdminType }) {
  const users = data.users ?? []
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const canManage = type === 'super-admin'

  const filtered = useMemo(() => users.filter((user) => {
    const matchQuery = !query || `${user.full_name ?? ''} ${user.email ?? ''}`.toLowerCase().includes(query.toLowerCase())
    const matchRole = roleFilter === 'all' || (user.roles ?? []).includes(roleFilter)
    return matchQuery && matchRole
  }), [users, query, roleFilter])

  async function toggleRole(userId: string, role: string, has: boolean) {
    setBusy(userId + role)
    setMessage(null)
    try {
      await adminAction({ kind: has ? 'role.revoke' : 'role.grant', userId, role })
      setMessage({ tone: 'ok', text: has ? `Peran ${ROLE_LABEL[role] ?? role} dicabut.` : `Peran ${ROLE_LABEL[role] ?? role} diberikan.` })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal mengubah peran' })
    } finally {
      setBusy(null)
    }
  }

  const mitra = users.filter((u) => (u.roles ?? []).some((r) => ['agent', 'property_owner'].includes(r))).length
  const admins = users.filter((u) => (u.roles ?? []).some((r) => ['admin', 'super_admin'].includes(r))).length

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Total akun" value={String(users.length)} change="Pengguna terdaftar" icon="users" />
        <MetricCard label="Mitra (agen/pemilik)" value={String(mitra)} change="Punya perjanjian kerja sama" icon="shield" />
        <MetricCard label="Admin & super admin" value={String(admins)} change="Akses operasional" icon="key" />
        <MetricCard label="Punya listing" value={String(users.filter((u) => (u.listings ?? 0) > 0).length)} change="Akun yang sudah memasang properti" icon="home" />
      </div>
      {message && <Toast message={message} />}
      <div className={ui.card}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Pengguna & mitra Homy</h3>
            <p className="mt-1 text-sm text-[#718078]">{canManage ? 'Cari akun, lihat peran, dan atur akses peran (super admin).' : 'Cari akun dan pantau peran serta jumlah listing-nya.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama / email" className={ui.input + ' sm:w-56'} />
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={ui.input + ' sm:w-44'}>
              <option value="all">Semua peran</option>
              {Object.keys(ROLE_LABEL).map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
            </select>
            <button type="button" onClick={reload} className={ui.ghost}>Muat ulang</button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[#a18a61]">
              <tr><th className="pb-3">Akun</th><th className="pb-3">Peran</th><th className="pb-3">Listing</th><th className="pb-3">Terdaftar</th>{canManage && <th className="pb-3">Kelola peran</th>}</tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-t border-[#eee7dc]">
                  <td className="py-3">
                    <p className="font-semibold text-[#20332c]">{user.full_name || 'Tanpa nama'}</p>
                    <p className="text-xs text-[#718078]">{user.email || '—'}</p>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {(user.roles ?? []).map((role) => <span key={role} className={`${ui.badge} bg-[#f7f3ec] text-[#0b3d2e]`}>{ROLE_LABEL[role] ?? role}</span>)}
                    </div>
                  </td>
                  <td className="py-3 font-semibold text-[#0b3d2e]">{user.listings ?? 0}</td>
                  <td className="py-3 text-[#718078]">{shortDate(user.created_at)}</td>
                  {canManage && (
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {['agent', 'property_owner', 'admin', 'super_admin'].map((role) => {
                          const has = (user.roles ?? []).includes(role)
                          return (
                            <button key={role} type="button" disabled={busy === user.id + role} onClick={() => toggleRole(user.id, role, has)} className={has ? ui.ghost : ui.btn}>
                              {has ? '− ' : '+ '}{ROLE_LABEL[role]}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <div className="mt-4"><Empty text="Tidak ada akun yang cocok dengan pencarian." /></div>}
      </div>
    </div>
  )
}

/* ============================ PENAGIHAN & KOMISI ============================ */
export function PlatformBillingBoard({ data, loading, reload, type }: BoardProps & { type: AdminType }) {
  const rows = data.transactions ?? []
  const metrics = data.metrics ?? {}
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? rows : rows.filter((row) => row.status === filter)
  const totalSale = rows.reduce((sum, row) => sum + Number(row.sale_price ?? 0), 0)

  async function decide(id: string, action: 'verify' | 'reject') {
    setBusy(id)
    setMessage(null)
    try {
      await adminAction({ kind: action === 'verify' ? 'billing.verify' : 'billing.reject', id, note: notes[id] ?? '' })
      setMessage({ tone: 'ok', text: action === 'verify' ? 'Komisi diverifikasi — mitra akan melihat status terverifikasi di dashboard-nya.' : 'Laporan transaksi ditolak. Mitra melihat catatan Anda di dashboard-nya.' })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal memproses' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Laporan transaksi" value={String(rows.length)} change={`${metrics.pendingCommissionCount ?? 0} menunggu verifikasi`} icon="wallet" />
        <MetricCard label="Nilai transaksi mitra" value={rupiah(totalSale)} change="Akumulasi harga jual dilaporkan" icon="chart" />
        <MetricCard label="Komisi terverifikasi" value={rupiah(metrics.commissionVerified ?? 0)} change="Pendapatan Homy yang sudah divalidasi" icon="shield" />
        <MetricCard label="Komisi menunggu" value={rupiah(metrics.commissionPending ?? 0)} change="Belum diverifikasi admin" icon="sparkles" />
      </div>
      {message && <Toast message={message} />}
      <div className={ui.card}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Verifikasi laporan transaksi mitra</h3>
            <p className="mt-1 text-sm text-[#718078]">Agen & pemilik wajib melaporkan transaksi (Pasal 4 perjanjian) dengan komisi 0,5%. Verifikasi di sini — status langsung terlihat di dashboard Penagihan mereka{type === 'super-admin' ? ' dan menjadi dasar laporan pendapatan platform.' : '.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {['all', 'reported', 'verified', 'rejected'].map((value) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={value === filter ? ui.btn : ui.ghost}>
                {value === 'all' ? 'Semua' : STATUS_TX[value]?.label ?? value}
              </button>
            ))}
            <button type="button" onClick={reload} className={ui.ghost}>Muat ulang</button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[#a18a61]">
              <tr><th className="pb-3">Properti / pembeli</th><th className="pb-3">Mitra</th><th className="pb-3">Harga jual</th><th className="pb-3">Komisi 0,5%</th><th className="pb-3">Status</th><th className="pb-3">Tindakan</th></tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const status = STATUS_TX[String(row.status)] ?? STATUS_TX.reported
                return (
                  <tr key={row.id} className="border-t border-[#eee7dc] align-top">
                    <td className="py-3">
                      <p className="font-semibold text-[#20332c]">{row.property_title || 'Properti'}</p>
                      <p className="text-xs text-[#718078]">{row.buyer_name || 'Pembeli'} · {row.buyer_contact || 'tanpa kontak'} · {shortDate(row.sold_at)}</p>
                      {row.review_note && <p className="mt-1 text-xs text-[#b45c50]">Catatan: {row.review_note}</p>}
                    </td>
                    <td className="py-3">
                      <p className="font-semibold text-[#20332c]">{row.user?.name || 'Mitra'}</p>
                      <p className="text-xs text-[#718078]">{ROLE_LABEL[String(row.role)] ?? row.role} · {row.user?.email || '—'}</p>
                    </td>
                    <td className="py-3 font-semibold text-[#0b3d2e]">{rupiah(row.sale_price)}</td>
                    <td className="py-3 font-semibold text-[#0b3d2e]">{rupiah(row.commission_amount)}</td>
                    <td className="py-3">
                      <span className={`${ui.badge} ${status.className}`}>{status.label}</span>
                      {row.verified_at && <p className="mt-1 text-xs text-[#718078]">{shortDateTime(row.verified_at)}</p>}
                    </td>
                    <td className="py-3">
                      <input value={notes[row.id] ?? ''} onChange={(event) => setNotes({ ...notes, [row.id]: event.target.value })} placeholder="Catatan (opsional)" className={ui.input + ' mb-2 w-48'} />
                      <div className="flex gap-1">
                        <button type="button" disabled={busy === row.id} onClick={() => decide(row.id, 'verify')} className={ui.btn}>Verifikasi</button>
                        <button type="button" disabled={busy === row.id} onClick={() => decide(row.id, 'reject')} className={ui.ghost}>Tolak</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <div className="mt-4"><Empty text="Belum ada laporan transaksi pada filter ini." /></div>}
      </div>
    </div>
  )
}

/* ============================ LAPORAN & PENIPUAN ============================ */
export function ReportsBoard({ data, loading, reload }: BoardProps) {
  const reports = data.adminReports ?? []
  const duplicates = data.duplicates ?? []
  const noMedia = (data.allProperties ?? []).filter((p) => p.status === 'published' && (data.ai?.listingsWithoutMedia ?? 0) > 0)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  async function act(id: string, kind: 'resolve' | 'investigate' | 'dismiss') {
    setBusy(id)
    setMessage(null)
    try {
      await adminAction({ kind: 'report.' + kind, id, note: notes[id] ?? '' })
      setMessage({ tone: 'ok', text: 'Status laporan diperbarui.' })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal memperbarui laporan' })
    } finally {
      setBusy(null)
    }
  }

  const open = reports.filter((r) => ['open', 'investigating'].includes(String(r.status)))

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Laporan terbuka" value={String(open.length)} change={`${reports.length} total laporan`} icon="flag" />
        <MetricCard label="Listing tanpa foto" value={String(data.ai?.listingsWithoutMedia ?? 0)} change="Perlu ditindaklanjuti saat tayang" icon="home" />
        <MetricCard label="Indikasi duplikat" value={String(duplicates.length)} change="Judul sama antar listing" icon="search" />
        <MetricCard label="Listing ditolak" value={String(data.metrics?.rejected ?? 0)} change="Sudah ditindak moderator" icon="shield" />
      </div>
      {message && <Toast message={message} />}

      <div className={ui.card}>
        <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Laporan dari pengguna</h3>
        <p className="mt-1 text-sm text-[#718078]">Tindak lanjuti laporan penyalahgunaan: tandai sedang diselidiki, selesaikan, atau abaikan bila tidak terbukti.</p>
        <div className="mt-4 space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="rounded-xl border border-[#eee7dc] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#20332c]">{report.property_title || 'Listing tidak diketahui'}</p>
                  <p className="mt-1 text-sm text-[#33433d]">{report.reason || 'Tanpa alasan tertulis'}</p>
                  <p className="mt-1 text-xs text-[#718078]">Pelapor: {report.reported_user?.name || report.reported_user?.email || 'anonim'} · {shortDateTime(report.created_at)} · status: {report.status}</p>
                </div>
                <span className={`${ui.badge} ${['open', 'investigating'].includes(String(report.status)) ? 'bg-[#fff7e3] text-[#9b762a]' : 'bg-[#edf2ed] text-[#4e866d]'}`}>{report.status}</span>
              </div>
              {report.resolution_note && <p className="mt-2 text-xs text-[#4e866d]">Catatan: {report.resolution_note}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={notes[report.id] ?? ''} onChange={(event) => setNotes({ ...notes, [report.id]: event.target.value })} placeholder="Catatan tindakan" className={ui.input + ' sm:w-64'} />
                <button type="button" disabled={busy === report.id} onClick={() => act(report.id, 'investigate')} className={ui.ghost}>Selidiki</button>
                <button type="button" disabled={busy === report.id} onClick={() => act(report.id, 'resolve')} className={ui.btn}>Selesaikan</button>
                <button type="button" disabled={busy === report.id} onClick={() => act(report.id, 'dismiss')} className={ui.ghost}>Abaikan</button>
              </div>
            </div>
          ))}
          {!loading && reports.length === 0 && <Empty text="Tidak ada laporan pengguna saat ini." />}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={ui.card}>
          <h3 className="font-serif text-xl text-[#0b3d2e]">Pemeriksaan otomatis: duplikat</h3>
          <p className="mt-1 text-sm text-[#718078]">Listing dengan judul identik — kemungkinan pemasangan ganda.</p>
          <div className="mt-3 space-y-2">
            {duplicates.map((group) => (
              <div key={group.key} className="rounded-xl bg-[#f7f3ec] p-3 text-sm">
                <p className="font-semibold text-[#20332c]">{group.titles[0]}</p>
                <p className="text-xs text-[#718078]">{group.count} listing dengan judul sama</p>
              </div>
            ))}
            {duplicates.length === 0 && <Empty text="Tidak ada duplikat terdeteksi. 👍" />}
          </div>
        </div>
        <div className={ui.card}>
          <h3 className="font-serif text-xl text-[#0b3d2e]">Pemeriksaan otomatis: kualitas listing</h3>
          <p className="mt-1 text-sm text-[#718078]">Listing tayang yang belum punya foto atau ringkasan AI — kurang menarik bagi pembeli.</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-[#f7f3ec] p-3">
              <span>Listing tayang tanpa foto</span><strong className="text-[#0b3d2e]">{data.ai?.listingsWithoutMedia ?? 0}</strong>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[#f7f3ec] p-3">
              <span>Listing tayang dengan ringkasan AI</span><strong className="text-[#0b3d2e]">{data.ai?.listingsWithSummary ?? 0}</strong>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[#f7f3ec] p-3">
              <span>Listing tayang</span><strong className="text-[#0b3d2e]">{data.metrics?.published ?? 0}</strong>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#718078]">Catatan: {noMedia.length > 0 ? 'ada listing yang perlu foto.' : 'pemeriksaan dihitung dari seluruh listing di database.'}</p>
        </div>
      </div>
    </div>
  )
}

/* ============================ PEMANTAUAN AI ============================ */
export function AiMonitorBoard({ data }: BoardProps) {
  const ai = data.ai ?? {}
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Status Homy AI" value={ai.configured ? 'Aktif' : 'Nonaktif'} change={'Model ' + (ai.model ?? 'deepseek-chat')} icon="sparkles" />
        <MetricCard label="Listing tayang" value={String(data.metrics?.published ?? 0)} change="Sumber jawaban Homy AI" icon="home" />
        <MetricCard label="Ringkasan AI siap" value={String(ai.listingsWithSummary ?? 0)} change={'Cakupan ' + (data.metrics?.aiCoverage ?? 0) + '% listing tayang'} icon="file" />
        <MetricCard label="Aktivitas AI tercatat" value={String(data.metrics?.aiEvents ?? 0)} change="Event audit berawalan ai.*" icon="bot" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
        <div className={ui.card}>
          <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Uji Homy AI langsung</h3>
          <p className="mt-1 text-sm text-[#718078]">Kirim pertanyaan seperti calon pembeli untuk memastikan AI menjawab dari data listing yang tayang.</p>
          <div className="mt-4">
            <AiChat compact intro="Uji kualitas jawaban Homy AI (data live)" suggestions={['Rumah apa saja yang tersedia?', 'Berapa rata-rata harga sewa apartemen?', 'Listing mana yang paling dekat kampus?']} />
          </div>
        </div>
        <div className={ui.card}>
          <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Log aktivitas AI</h3>
          <p className="mt-1 text-sm text-[#718078]">Jejak audit yang berkaitan dengan fitur AI dan moderasi otomatis.</p>
          <div className="mt-3 space-y-2">
            {(data.audit ?? []).filter((row) => String(row.action ?? '').startsWith('ai.') || String(row.action ?? '').includes('suggest')).map((row) => (
              <div key={row.id} className="rounded-xl bg-[#f7f3ec] p-3 text-sm">
                <p className="font-semibold text-[#20332c]">{row.action}</p>
                <p className="text-xs text-[#718078]">{row.actor?.name || row.actor?.email || 'sistem'} · {shortDateTime(row.created_at)}</p>
              </div>
            ))}
            {(data.audit ?? []).filter((row) => String(row.action ?? '').startsWith('ai.')).length === 0 && <Empty text="Belum ada event audit khusus AI. Uji chat di samping untuk memverifikasi jawaban." />}
          </div>
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-[#f7f3ec] p-3"><span>Listing tayang tanpa foto</span><strong className="text-[#0b3d2e]">{ai.listingsWithoutMedia ?? 0}</strong></div>
            <div className="flex items-center justify-between rounded-xl bg-[#f7f3ec] p-3"><span>Status AI</span><strong className="text-[#0b3d2e]">{ai.configured ? 'Kunci AI terpasang' : 'Kunci AI belum ada'}</strong></div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================ LOG AUDIT ============================ */
export function AuditBoard({ data, loading }: BoardProps) {
  const audit = data.audit ?? []
  const [query, setQuery] = useState('')
  const filtered = audit.filter((row) => !query || `${row.action ?? ''} ${row.entity_type ?? ''} ${row.actor?.email ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Event terbaru" value={String(audit.length)} change="80 event terakhir" icon="flag" />
        <MetricCard label="Verifikasi komisi" value={String(audit.filter((r) => String(r.action ?? '').startsWith('transaction.')).length)} change="transaction.verified / rejected" icon="wallet" />
        <MetricCard label="Moderasi listing" value={String(audit.filter((r) => String(r.action ?? '').startsWith('listing.')).length)} change="approve / reject / resubmit" icon="file" />
        <MetricCard label="Perubahan peran" value={String(audit.filter((r) => String(r.action ?? '').startsWith('role.')).length)} change="role.granted / revoked" icon="key" />
      </div>
      <div className={ui.card}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Log audit platform</h3>
            <p className="mt-1 text-sm text-[#718078]">Semua tindakan penting: moderasi, verifikasi komisi, perubahan peran, konfigurasi, dan flag.</p>
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari aksi / pelaku" className={ui.input + ' sm:w-64'} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[#a18a61]"><tr><th className="pb-3">Waktu</th><th className="pb-3">Aksi</th><th className="pb-3">Pelaku</th><th className="pb-3">Entitas</th><th className="pb-3">Detail</th></tr></thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-[#eee7dc] align-top">
                  <td className="py-3 text-[#718078]">{shortDateTime(row.created_at)}</td>
                  <td className="py-3 font-semibold text-[#20332c]">{row.action}</td>
                  <td className="py-3 text-[#33433d]">{row.actor?.name || row.actor?.email || 'sistem'}</td>
                  <td className="py-3 text-[#718078]">{row.entity_type || '—'}</td>
                  <td className="py-3 text-xs text-[#718078]">{row.metadata ? JSON.stringify(row.metadata).slice(0, 120) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <div className="mt-4"><Empty text="Belum ada event audit yang cocok." /></div>}
      </div>
    </div>
  )
}

/* ============================ PERAN & IZIN ============================ */
export function RolesBoard({ data, reload, type }: BoardProps & { type: AdminType }) {
  const counts = data.roleCounts ?? []
  const roleInfo = [
    { role: 'user', title: 'Pengguna', detail: 'Mencari properti, menyimpan favorit, mengirim pertanyaan, dan menjadwalkan kunjungan.' },
    { role: 'property_owner', title: 'Pemilik Properti', detail: 'Memasang properti sendiri, menerima pertanyaan, mengatur jadwal kunjungan, dan wajib melaporkan transaksi.' },
    { role: 'agent', title: 'Agen', detail: 'Mengelola banyak listing, CRM prospek, analitik, dan penagihan komisi 0,5%.' },
    { role: 'admin', title: 'Admin', detail: 'Moderasi listing, verifikasi komisi mitra, menindak laporan, dan memantau AI.' },
    { role: 'super_admin', title: 'Super Admin', detail: 'Semua akses admin plus peran & izin, konfigurasi platform, dan feature flag.' },
  ]
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Total akun" value={String(data.users?.length ?? 0)} change="Semua peran" icon="users" />
        {counts.slice(0, 3).map((item) => (
          <MetricCard key={item.role} label={ROLE_LABEL[item.role] ?? item.role} value={String(item.count)} change="Akun dengan peran ini" icon="shield" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {roleInfo.map((info) => (
          <div key={info.role} className={ui.card}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl text-[#0b3d2e]">{info.title}</h3>
              <span className={`${ui.badge} bg-[#f7f3ec] text-[#0b3d2e]`}>{counts.find((c) => c.role === info.role)?.count ?? 0} akun</span>
            </div>
            <p className="mt-2 text-sm text-[#718078]">{info.detail}</p>
          </div>
        ))}
      </div>
      {type === 'super-admin' && <UsersBoard data={data} loading={false} reload={reload} type={type} />}
    </div>
  )
}

/* ============================ KONFIGURASI PLATFORM ============================ */
export function SettingsBoard({ data, reload }: BoardProps) {
  const settings = data.settings ?? []
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const valueOf = (setting: DashboardSetting) => {
    const value = setting.value as { value?: unknown } | null
    return value && typeof value === 'object' && 'value' in value ? String(value.value ?? '') : String(setting.value ?? '')
  }

  async function save(setting: DashboardSetting) {
    setBusy(setting.key)
    setMessage(null)
    try {
      const raw = draft[setting.key]
      const current = (setting.value as { value?: unknown })?.value
      const parsed = typeof current === 'number' ? Number(raw) : raw === 'true' ? true : raw === 'false' ? false : raw
      await adminAction({ kind: 'setting.update', key: setting.key, value: { value: parsed } })
      setMessage({ tone: 'ok', text: `Konfigurasi ${setting.label ?? setting.key} disimpan.` })
      setDraft((prev) => { const next = { ...prev }; delete next[setting.key]; return next })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal menyimpan konfigurasi' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {message && <Toast message={message} />}
      <div className="grid gap-4 xl:grid-cols-2">
        {settings.map((setting) => (
          <div key={setting.key} className={ui.card}>
            <p className={ui.eyebrow}>{setting.key}</p>
            <h3 className="mt-1 font-serif text-xl text-[#0b3d2e]">{setting.label ?? setting.key}</h3>
            <p className="mt-1 text-xs text-[#718078]">Terakhir diubah {shortDateTime(setting.updated_at)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input value={draft[setting.key] ?? valueOf(setting)} onChange={(event) => setDraft({ ...draft, [setting.key]: event.target.value })} className={ui.input + ' sm:w-48'} />
              <button type="button" disabled={busy === setting.key} onClick={() => save(setting)} className={ui.btn}>Simpan</button>
            </div>
          </div>
        ))}
        {settings.length === 0 && <Empty text="Belum ada konfigurasi tersimpan." />}
      </div>
    </div>
  )
}

/* ============================ FEATURE FLAGS ============================ */
export function FlagsBoard({ data, reload }: BoardProps) {
  const flags = data.flags ?? []
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  async function update(key: string, patch: { enabled?: boolean; rollout?: number }) {
    setBusy(key)
    setMessage(null)
    try {
      await adminAction({ kind: 'flag.update', key, ...patch })
      setMessage({ tone: 'ok', text: 'Feature flag diperbarui.' })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal memperbarui flag' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {message && <Toast message={message} />}
      <div className="space-y-3">
        {flags.map((flag) => (
          <div key={flag.key} className={ui.card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <p className={ui.eyebrow}>{flag.key}</p>
                <h3 className="mt-1 font-serif text-xl text-[#0b3d2e]">{flag.label}</h3>
                <p className="mt-1 text-sm text-[#718078]">{flag.description || 'Tanpa deskripsi.'}</p>
              </div>
              <button type="button" disabled={busy === flag.key} onClick={() => update(flag.key, { enabled: !flag.enabled })} className={flag.enabled ? ui.btn : ui.ghost}>
                {flag.enabled ? 'Aktif — matikan' : 'Nonaktif — nyalakan'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-sm text-[#33433d]">Rollout {flag.rollout}%</label>
              <input type="range" min={0} max={100} step={5} value={flag.rollout} onChange={(event) => update(flag.key, { rollout: Number(event.target.value) })} className="w-56 accent-[#0b3d2e]" />
            </div>
          </div>
        ))}
        {flags.length === 0 && <Empty text="Belum ada feature flag." />}
      </div>
    </div>
  )
}

/* ============================ RINGKASAN (OVERVIEW) ============================ */
export function AdminOverviewBoard({ type }: { type: AdminType }) {
  const { data, loading, reload } = useAdminDashboard(type)
  const metrics = data.metrics ?? {}
  const audit = (data.audit ?? []).slice(0, 6)
  const pendingTx = (data.transactions ?? []).filter((row) => row.status === 'reported').slice(0, 4)

  const tiles: Array<[string, string, string]> = type === 'admin'
    ? [
        ['moderation', 'Moderasi Listing', 'Tinjau & tayangkan listing baru'],
        ['users', 'Pengguna & Agen', 'Pantau akun, peran, dan mitra'],
        ['billing', 'Penagihan & Komisi', 'Verifikasi laporan transaksi mitra'],
        ['reports', 'Laporan & Penipuan', 'Tindak laporan dan pemeriksaan otomatis'],
        ['ai', 'Pemantauan AI', 'Cek kualitas jawaban Homy AI'],
      ]
    : [
        ['roles', 'Peran & Izin', 'Atur akses peran pengguna'],
        ['billing', 'Penagihan Platform', 'Komisi & pendapatan platform'],
        ['audit', 'Log Audit', 'Jejak seluruh tindakan penting'],
        ['system', 'Konfigurasi Sistem', 'Pengaturan platform'],
        ['flags', 'Feature Flag', 'Aktifkan fitur secara bertahap'],
      ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {type === 'admin' ? (
          <>
            <MetricCard label="Menunggu moderasi" value={String(metrics.pendingApprovals ?? 0)} change={`${metrics.totalListings ?? 0} listing total`} icon="file" />
            <MetricCard label="Listing tayang" value={String(metrics.published ?? 0)} change={`${metrics.rejected ?? 0} ditolak`} icon="home" />
            <MetricCard label="Laporan terbuka" value={String(metrics.openReports ?? 0)} change={`${data.duplicates?.length ?? 0} indikasi duplikat`} icon="flag" />
            <MetricCard label="Akun pengguna" value={String(metrics.activeUsers ?? 0)} change={`${data.users?.filter((u) => (u.roles ?? []).includes('agent')).length ?? 0} agen terdaftar`} icon="users" />
          </>
        ) : (
          <>
            <MetricCard label="Total akun" value={String(metrics.activeUsers ?? 0)} change={`${metrics.totalListings ?? 0} listing di platform`} icon="users" />
            <MetricCard label="Komisi terverifikasi" value={rupiah(metrics.commissionVerified ?? 0)} change={`${rupiah(metrics.commissionPending ?? 0)} menunggu`} icon="wallet" />
            <MetricCard label="Listing tayang" value={String(metrics.published ?? 0)} change={`${metrics.pendingApprovals ?? 0} menunggu moderasi`} icon="home" />
            <MetricCard label="Feature flag aktif" value={String((data.flags ?? []).filter((f) => f.enabled).length)} change={`${(data.flags ?? []).length} flag tersedia`} icon="sparkles" />
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(([section, title, detail]) => (
          <a key={section} href={'/dashboard/' + type + '/' + section} className={ui.card + ' block transition hover:-translate-y-0.5 hover:border-[#0b3d2e]'}>
            <p className={ui.eyebrow}>Modul</p>
            <h3 className="mt-1 font-serif text-xl text-[#0b3d2e]">{title}</h3>
            <p className="mt-1 text-sm text-[#718078]">{detail}</p>
          </a>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className={ui.card}>
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Aktivitas terbaru</h3>
            <button type="button" onClick={reload} className={ui.ghost}>Muat ulang</button>
          </div>
          <div className="mt-3 space-y-2">
            {audit.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-xl bg-[#f7f3ec] p-3 text-sm">
                <div>
                  <p className="font-semibold text-[#20332c]">{row.action}</p>
                  <p className="text-xs text-[#718078]">{row.actor?.name || row.actor?.email || 'sistem'}</p>
                </div>
                <span className="shrink-0 text-xs text-[#718078]">{shortDateTime(row.created_at)}</span>
              </div>
            ))}
            {!loading && audit.length === 0 && <Empty text="Belum ada aktivitas tercatat." />}
          </div>
        </div>
        <div className={ui.card}>
          <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Komisi menunggu verifikasi</h3>
          <p className="mt-1 text-sm text-[#718078]">Laporan transaksi mitra yang belum divalidasi.</p>
          <div className="mt-3 space-y-2">
            {pendingTx.map((row) => (
              <div key={row.id} className="rounded-xl bg-[#f7f3ec] p-3 text-sm">
                <p className="font-semibold text-[#20332c]">{row.property_title || 'Properti'}</p>
                <p className="text-xs text-[#718078]">{row.user?.name || 'Mitra'} · komisi {rupiah(row.commission_amount)}</p>
              </div>
            ))}
            {!loading && pendingTx.length === 0 && <Empty text="Tidak ada komisi menunggu. 👍" />}
          </div>
          <a href={'/dashboard/' + type + '/billing'} className={ui.btn + ' mt-4'}>Buka penagihan</a>
        </div>
      </div>
    </div>
  )
}


const LEAD_KIND: Record<string, { label: string; className: string }> = {
  agent: { label: 'Agen Properti', className: 'bg-[#eef3fa] text-[#3f6b9c]' },
  owner: { label: 'Pemilik Properti', className: 'bg-[#edf2ed] text-[#4e866d]' },
  agency: { label: 'Agensi / Broker', className: 'bg-[#f1ecfa] text-[#6a4fa3]' },
  institution: { label: 'Institusi Korporat', className: 'bg-[#fdeee6] text-[#b4661f]' },
  contact: { label: 'Pesan Kontak', className: 'bg-[#f2f0ea] text-[#718078]' },
}

const LEAD_STATUS: Record<string, { label: string; className: string }> = {
  new: { label: 'Baru', className: 'bg-[#fff7e3] text-[#9b762a]' },
  reviewing: { label: 'Ditinjau', className: 'bg-[#eef3fa] text-[#3f6b9c]' },
  contacted: { label: 'Dihubungi', className: 'bg-[#f1ecfa] text-[#6a4fa3]' },
  approved: { label: 'Disetujui', className: 'bg-[#edf2ed] text-[#4e866d]' },
  rejected: { label: 'Ditolak', className: 'bg-[#fbeeec] text-[#b45c50]' },
}

/** Halaman "Partnership": moderasi calon mitra (agen/pemilik/agensi/institusi) + pesan kontak. */
export function PartnershipBoard({ data, loading, reload }: BoardProps) {
  const leads = (data.partnerLeads ?? []) as unknown as Array<Record<string, unknown>>
  const [kind, setKind] = useState('all')
  const [status, setStatus] = useState('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const filtered = useMemo(() => leads.filter((lead) => {
    if (kind !== 'all' && String(lead.kind) !== kind) return false
    if (status !== 'all' && String(lead.status) !== status) return false
    return true
  }), [leads, kind, status])

  const pending = leads.filter((lead) => ['new', 'reviewing'].includes(String(lead.status))).length
  const institutions = leads.filter((lead) => ['agency', 'institution'].includes(String(lead.kind))).length
  const contacts = leads.filter((lead) => String(lead.kind) === 'contact').length

  async function review(id: string, next: string) {
    setBusy(id)
    setMessage(null)
    try {
      await adminAction({ kind: 'partnership.review', id, status: next, note: notes[id] ?? '' })
      setMessage({ tone: 'ok', text: 'Pengajuan diperbarui menjadi "' + (LEAD_STATUS[next]?.label ?? next) + '".' })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal memperbarui pengajuan' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Total pengajuan" value={String(leads.length)} change="Dari halaman Open Partnership & Kontak" icon="users" />
        <MetricCard label="Perlu ditindak" value={String(pending)} change="Status baru / ditinjau" icon="flag" />
        <MetricCard label="Agensi & institusi" value={String(institutions)} change="Skema komisi khusus" icon="chart" />
        <MetricCard label="Pesan kontak" value={String(contacts)} change="Dari halaman Kontak" icon="message" />
      </div>

      <Toast message={message} />

      <div className={ui.card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Calon mitra &amp; pesan masuk</h3>
          <div className="flex flex-wrap gap-2">
            <select value={kind} onChange={(event) => setKind(event.target.value)} className={ui.input + ' h-9 w-44 py-0'}>
              <option value="all">Semua jenis</option>
              <option value="agent">Agen Properti</option>
              <option value="owner">Pemilik Properti</option>
              <option value="agency">Agensi / Broker</option>
              <option value="institution">Institusi Korporat</option>
              <option value="contact">Pesan Kontak</option>
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={ui.input + ' h-9 w-40 py-0'}>
              <option value="all">Semua status</option>
              <option value="new">Baru</option>
              <option value="reviewing">Ditinjau</option>
              <option value="contacted">Dihubungi</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
        </div>

        {loading && <div className="mt-4 h-24 animate-pulse rounded-xl bg-[#f7f3ec]" />}
        {!loading && !filtered.length && <div className="mt-4"><Empty text="Belum ada pengajuan kemitraan dengan filter ini." /></div>}

        <div className="mt-4 space-y-3">
          {filtered.map((lead) => {
            const id = String(lead.id)
            const kindMeta = LEAD_KIND[String(lead.kind)] ?? LEAD_KIND.contact
            const statusMeta = LEAD_STATUS[String(lead.status)] ?? LEAD_STATUS.new
            const isContact = String(lead.kind) === 'contact'
            return (
              <div key={id} className="rounded-xl border border-[#eee7dc] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#20332c]">{String(lead.full_name ?? 'Tanpa nama')}</p>
                      <span className={ui.badge + ' ' + kindMeta.className}>{kindMeta.label}</span>
                      {lead.company ? <span className="text-xs text-[#718078]">{String(lead.company)}</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-[#718078]">
                      {[lead.email, lead.phone].filter(Boolean).map(String).join(' · ') || 'Kontak tidak dicatat'}
                    </p>
                    <p className="mt-0.5 text-xs text-[#718078]">
                      {[lead.position, lead.city, lead.province].filter(Boolean).map(String).join(' · ')}
                      {lead.branches ? ' · ' + String(lead.branches) + ' cabang' : ''}
                      {lead.license_no ? ' · Izin: ' + String(lead.license_no) : ''}
                    </p>
                    {lead.website ? <a href={String(lead.website).startsWith('http') ? String(lead.website) : 'https://' + String(lead.website)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-[#0b3d2e] underline">{String(lead.website)}</a> : null}
                  </div>
                  <span className={ui.badge + ' h-fit shrink-0 ' + statusMeta.className}>{statusMeta.label}</span>
                </div>
                {lead.message ? <p className="mt-2 rounded-lg bg-[#f7f3ec] p-3 text-sm text-[#33433d]">{String(lead.message)}</p> : null}
                <p className="mt-2 text-xs text-[#a18a61]">Masuk {shortDate(String(lead.created_at ?? ''))}{lead.reviewed_at ? ' · ditinjau ' + shortDate(String(lead.reviewed_at)) : ''}</p>
                {lead.review_note ? <p className="mt-1 text-xs text-[#718078]">Catatan: {String(lead.review_note)}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input value={notes[id] ?? ''} onChange={(event) => setNotes({ ...notes, [id]: event.target.value })} placeholder={isContact ? 'Catatan balasan (opsional)' : 'Catatan verifikasi (opsional)'} className={ui.input + ' h-9 max-w-xs py-0'} />
                  {!isContact && String(lead.status) !== 'reviewing' && <button type="button" disabled={busy === id} onClick={() => review(id, 'reviewing')} className={ui.ghost}>Tandai ditinjau</button>}
                  {!isContact && String(lead.status) !== 'contacted' && <button type="button" disabled={busy === id} onClick={() => review(id, 'contacted')} className={ui.ghost}>Sudah dihubungi</button>}
                  {!isContact && String(lead.status) !== 'approved' && <button type="button" disabled={busy === id} onClick={() => review(id, 'approved')} className={ui.btn}>Setujui mitra</button>}
                  {String(lead.status) !== 'rejected' && <button type="button" disabled={busy === id} onClick={() => review(id, 'rejected')} className={ui.ghost}>{isContact ? 'Tandai selesai' : 'Tolak'}</button>}
                  <a href={'mailto:' + String(lead.email ?? '')} className={ui.ghost}>Balas email</a>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={ui.card}>
        <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Prosedur follow-up partnership</h3>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[#33443d]">
          <li>1. Verifikasi identitas &amp; legalitas (KTP/izin usaha) sebelum menandai <strong>Disetujui</strong>.</li>
          <li>2. Untuk agensi/institusi, catat skema komisi bertingkat pada catatan verifikasi.</li>
          <li>3. Setelah disetujui, minta mitra menandatangani Surat Perjanjian Kerja Sama di halaman <a href="/agreement?role=agent&next=/list" className="font-semibold text-[#0b3d2e] underline">Perjanjian</a>.</li>
          <li>4. Komisi wajib: Agen 0,5% dan Pemilik Properti 2% dari harga transaksi final.</li>
          <li>5. Semua tindakan moderasi tercatat otomatis di <strong>Log Audit</strong>.</li>
        </ul>
      </div>
    </div>
  )
}
