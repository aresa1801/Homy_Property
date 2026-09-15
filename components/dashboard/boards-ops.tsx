'use client'

import { useState } from 'react'
import { BadgeCheck, CalendarDays, CheckCircle2, FileSignature, Plus, RefreshCw, WalletCards } from 'lucide-react'
import { MetricCard } from '@/components/dashboard-shell'
import { resubmitListing, rupiah, runAction, shortDate, shortDateTime, STATUS_LABEL, ui, VISIT_LABEL, type DashboardPayload, type DashboardVisit } from '@/lib/dashboard-client'
import type { BoardProps } from '@/components/dashboard/boards-listing'

const ROLE_KEY = { agent: 'agent', 'property-owner': 'property_owner' } as const

/** Komisi platform: Agen 0,5% dari harga jual, Pemilik Properti 2%. */
const COMMISSION = { agent: 0.5, 'property-owner': 2 } as const

/** Halaman "Penagihan": lapor transaksi + komisi 0,5% untuk Homy. */
export function BillingBoard({ data, loading, reload, type }: BoardProps & { type: 'agent' | 'property-owner' }) {
  const rate = COMMISSION[type]
  const reports = data.transactions ?? []
  const totalValue = reports.reduce((sum, row) => sum + Number(row.sale_price ?? 0), 0)
  const totalCommission = reports.reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0)
  const [form, setForm] = useState({ propertyId: '', propertyTitle: '', buyerName: '', buyerContact: '', salePrice: '', soldAt: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const preview = Math.round((Number(form.salePrice || 0) * rate) / 100)

  async function submit() {
    setBusy(true)
    setMessage(null)
    try {
      await runAction({ kind: 'transaction.report', ...form, role: ROLE_KEY[type] })
      setMessage({ tone: 'ok', text: 'Laporan transaksi terkirim ke Homy. Terima kasih! 🙏' })
      setForm({ propertyId: '', propertyTitle: '', buyerName: '', buyerContact: '', salePrice: '', soldAt: '', notes: '' })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal mengirim laporan' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Transaksi dilaporkan" value={String(reports.length)} change="Wajib lapor ≤3 hari kerja" icon="wallet" />
        <MetricCard label="Nilai transaksi" value={rupiah(totalValue)} change="Akumulasi harga jual" icon="chart" />
        <MetricCard label={'Komisi Homy (' + String(rate).replace('.', ',') + '%)'} value={rupiah(totalCommission)} change="Dihitung otomatis dari harga jual" icon="sparkles" />
        <MetricCard label="Terverifikasi" value={String(reports.filter((row) => row.status === 'verified').length)} change={`${reports.filter((row) => row.status === 'reported').length} menunggu verifikasi`} icon="shield" />
      </div>

      {message && <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className={ui.card}>
          <div className="flex items-center gap-2"><WalletCards className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Lapor transaksi baru</h3></div>
          <p className="mt-2 text-sm text-[#718078]">{'Sesuai Pasal 4 perjanjian kerja sama, setiap transaksi wajib dilaporkan ke Homy maksimal 3 hari kerja. Komisi ' + String(rate).replace('.', ',') + '% dari harga jual dihitung otomatis (' + (type === 'agent' ? 'Agen' : 'Pemilik Properti') + ').'}</p>
          <div className="mt-4 space-y-3">
            <select value={form.propertyId} onChange={(event) => { const item = (data.properties ?? []).find((row) => row.id === event.target.value); setForm({ ...form, propertyId: event.target.value, propertyTitle: item?.title ?? '' }) }} className={ui.input}>
              <option value="">Pilih properti (opsional)</option>
              {(data.properties ?? []).map((item) => <option key={item.id} value={item.id}>{item.title ?? 'Listing'} — {item.city ?? ''}</option>)}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.buyerName} onChange={(event) => setForm({ ...form, buyerName: event.target.value })} placeholder="Nama pembeli" className={ui.input} />
              <input value={form.buyerContact} onChange={(event) => setForm({ ...form, buyerContact: event.target.value })} placeholder="Kontak pembeli (WA/email)" className={ui.input} />
              <input value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="Harga jual (Rp)" className={ui.input} />
              <input type="date" value={form.soldAt} onChange={(event) => setForm({ ...form, soldAt: event.target.value })} className={ui.input} />
            </div>
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} placeholder="Catatan (opsional)" className={ui.input} />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f3ec] px-4 py-3">
              <p className="text-sm text-[#718078]">{'Komisi Homy (' + String(rate).replace('.', ',') + '%)'}</p>
              <p className="font-serif text-xl text-[#0b3d2e]">{rupiah(preview)}</p>
            </div>
            <button type="button" disabled={busy || !Number(form.salePrice)} onClick={submit} className={ui.btn}>{busy ? 'Mengirim…' : 'Kirim laporan transaksi'}</button>
          </div>
        </div>

        <div className={ui.card}>
          <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Riwayat laporan</h3>
          <div className="mt-4 space-y-3">
            {loading && <div className="h-16 animate-pulse rounded-xl bg-[#f7f3ec]" />}
            {!loading && !reports.length && <p className={ui.soft + ' text-sm text-[#718078]'}>Belum ada transaksi dilaporkan.</p>}
            {reports.map((row) => (
              <div key={row.id} className="rounded-xl border border-[#eee7dc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#20332c]">{row.property_title || 'Properti'}</p>
                    <p className="mt-0.5 text-xs text-[#718078]">{row.buyer_name || 'Pembeli tidak dicatat'} · jual {shortDate(row.sold_at ?? null)} · dilapor {shortDate(row.created_at)}</p>
                  </div>
                  <span className={`${ui.badge} ${row.status === 'verified' ? 'bg-[#edf2ed] text-[#4e866d]' : row.status === 'rejected' ? 'bg-[#fbeeec] text-[#b45c50]' : 'bg-[#fff7e3] text-[#9b762a]'}`}>{row.status === 'verified' ? 'Terverifikasi' : row.status === 'rejected' ? 'Ditolak' : 'Menunggu'}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-[#33433d]">
                  <span>Harga: <strong>{rupiah(row.sale_price)}</strong></span>
                  <span>Komisi {String(row.commission_rate ?? 0.5)}%: <strong>{rupiah(row.commission_amount)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Halaman "Kalender": jadwal kunjungan calon pembeli. */
export function CalendarBoard({ data, loading, reload }: BoardProps & { type: 'agent' | 'property-owner' }) {
  const visits = data.visits ?? []
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ scheduledAt: '', notes: '' })
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const now = Date.now()
  const today = new Date().toDateString()
  const active = visits.filter((visit) => visit.status !== 'cancelled' && visit.status !== 'completed')
  const todayVisits = active.filter((visit) => visit.scheduled_at && new Date(visit.scheduled_at).toDateString() === today)
  const upcoming = active.filter((visit) => visit.scheduled_at && new Date(visit.scheduled_at).getTime() > now && new Date(visit.scheduled_at).toDateString() !== today)
  const done = visits.filter((visit) => visit.status === 'completed' || visit.status === 'cancelled')

  async function update(visit: DashboardVisit, patch: Record<string, unknown>, text: string) {
    setBusy(visit.id)
    setMessage(null)
    try {
      await runAction({ kind: 'visit.update', id: visit.id, ...patch })
      setMessage({ tone: 'ok', text })
      setEditing(null)
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal memperbarui jadwal' })
    } finally {
      setBusy(null)
    }
  }

  const group = (title: string, items: DashboardVisit[]) => (
    <div className={ui.card}>
      <div className="flex items-center gap-2"><CalendarDays className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">{title}</h3><span className="rounded-full bg-[#f2f0ea] px-2.5 py-1 text-xs font-semibold text-[#718078]">{items.length}</span></div>
      <div className="mt-4 space-y-3">
        {!items.length && <p className={ui.soft + ' text-sm text-[#718078]'}>Tidak ada jadwal di bagian ini.</p>}
        {items.map((visit) => {
          const meta = VISIT_LABEL[String(visit.status ?? 'requested')] ?? VISIT_LABEL.requested
          const open = editing === visit.id
          return (
            <div key={visit.id} className="rounded-xl border border-[#eee7dc] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#20332c]">{visit.property_title ?? 'Properti'}</p>
                  <p className="mt-0.5 text-sm text-[#33433d]">{shortDateTime(visit.scheduled_at)}</p>
                  <p className="mt-0.5 text-xs text-[#718078]">{visit.visitor?.name || 'Calon pembeli'}{visit.visitor?.phone ? ` · ${visit.visitor.phone}` : visit.visitor?.email ? ` · ${visit.visitor.email}` : ''}</p>
                </div>
                <span className={`${ui.badge} ${meta.className} h-fit shrink-0`}>{meta.label}</span>
              </div>
              {visit.notes && <p className="mt-2 rounded-lg bg-[#f7f3ec] p-3 text-sm text-[#33433d]">{visit.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {visit.status === 'requested' && <button type="button" disabled={busy === visit.id} onClick={() => update(visit, { status: 'confirmed' }, 'Kunjungan dikonfirmasi.')} className={ui.btn}>Konfirmasi</button>}
                {visit.status !== 'completed' && <button type="button" disabled={busy === visit.id} onClick={() => update(visit, { status: 'completed' }, 'Kunjungan ditandai selesai.')} className={ui.ghost}>Selesai</button>}
                {visit.status !== 'cancelled' && visit.status !== 'completed' && <button type="button" disabled={busy === visit.id} onClick={() => update(visit, { status: 'cancelled' }, 'Kunjungan dibatalkan.')} className={ui.ghost}>Batalkan</button>}
                <button type="button" onClick={() => { setEditing(open ? null : visit.id); setDraft({ scheduledAt: (visit.scheduled_at ?? '').slice(0, 16), notes: visit.notes ?? '' }) }} className={ui.ghost}>{open ? 'Tutup' : 'Ubah jadwal / catatan'}</button>
              </div>
              {open && (
                <div className="mt-3 space-y-3 border-t border-[#f2ede4] pt-3">
                  <input type="datetime-local" value={draft.scheduledAt} onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })} className={ui.input} />
                  <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={2} placeholder="Catatan untuk kunjungan ini" className={ui.input} />
                  <button type="button" disabled={busy === visit.id} onClick={() => update(visit, { scheduledAt: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : undefined, notes: draft.notes }, 'Jadwal diperbarui.')} className={ui.btn}>Simpan perubahan</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Kunjungan hari ini" value={String(todayVisits.length)} change="Siapkan properti" icon="calendar" />
        <MetricCard label="Akan datang" value={String(upcoming.length)} change="Terjadwal" icon="calendar" />
        <MetricCard label="Menunggu konfirmasi" value={String(active.filter((visit) => visit.status === 'requested').length)} change="Perlu tindakan Anda" icon="message" />
        <MetricCard label="Selesai / batal" value={String(done.length)} change="Riwayat kunjungan" icon="file" />
      </div>
      {message && <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>}
      {loading && <div className="h-28 animate-pulse rounded-2xl bg-white" />}
      {!loading && (
        <div className="grid gap-4 xl:grid-cols-2">
          {group('Hari ini', todayVisits)}
          {group('Akan datang', upcoming)}
          {group('Riwayat', done)}
        </div>
      )}
    </div>
  )
}

/** Halaman "Perjanjian Kerjasama": status + ringkasan kewajiban mitra. */
export function AgreementBoard({ data, loading, type }: BoardProps & { type: 'agent' | 'property-owner' }) {
  const key = ROLE_KEY[type]
  const agreement = (data.agreements ?? []).find((row) => row.role === key)
  const active = agreement?.status === 'active'
  const signHref = `/agreement?role=${key}&next=/dashboard/${type}/listings`
  const obligations = [
    'Menjual/menyewakan properti dengan data yang benar dan tidak menyesatkan.',
    'Menyetujui komisi penjualan ' + String(COMMISSION[type]).replace('.', ',') + '% dari harga jual untuk Homy Property (Pasal 3).',
    'Melaporkan setiap transaksi ke Homy maksimal 3 hari kerja setelah kesepakatan (Pasal 4).',
    'Menjaga kerahasiaan data calon pembeli dan tidak memindahkan transaksi ke luar platform.',
    'Mematuhi aturan moderasi listing Homy (foto asli, lokasi akurat, harga transparan).',
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className={ui.card}>
          <div className="flex items-center gap-2"><FileSignature className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Surat Perjanjian Kerja Sama</h3></div>
          {loading && <div className="mt-4 h-16 animate-pulse rounded-xl bg-[#f7f3ec]" />}
          {!loading && active && (
            <div className="mt-4 space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#edf2ed] px-3 py-1 text-xs font-semibold text-[#4e866d]"><CheckCircle2 className="size-4" /> Perjanjian aktif</span>
              <dl className="grid gap-3 sm:grid-cols-2">
                {[['Nama mitra', agreement?.full_name], ['Peran', type === 'agent' ? 'Agen' : 'Pemilik Properti'], ['Nomor identitas', agreement?.identity_number ? `••••${String(agreement.identity_number).slice(-4)}` : '—'], ['Telepon', agreement?.phone], ['Komisi penjualan', `${agreement?.commission_rate ?? 0.5}% dari harga jual`], ['Versi', agreement?.agreement_version ?? 'v1.0'], ['Ditandatangani', shortDate(agreement?.signed_at)], ['Domisili', agreement?.address]].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-[#f7f3ec] p-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#a18a61]">{label}</dt>
                    <dd className="mt-1 text-sm text-[#20332c]">{String(value || '—')}</dd>
                  </div>
                ))}
              </dl>
              <a href={signHref} className={ui.btn}>Lihat / perbarui perjanjian</a>
            </div>
          )}
          {!loading && !active && (
            <div className="mt-4 space-y-3">
              <span className="inline-flex rounded-full bg-[#fff7e3] px-3 py-1 text-xs font-semibold text-[#9b762a]">Belum ditandatangani</span>
              <p className="text-sm leading-6 text-[#718078]">{'Wajib sebelum memasang properti: daftar sebagai Mitra, tanda tangani perjanjian kerja sama, setujui komisi penjualan ' + String(COMMISSION[type]).replace('.', ',') + '%, dan laporkan setiap transaksi kepada Homy.'}</p>
              <a href={signHref} className={ui.btn}>Tanda tangani perjanjian</a>
            </div>
          )}
        </div>

        <div className={ui.card}>
          <div className="flex items-center gap-2"><BadgeCheck className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Kewajiban Anda</h3></div>
          <ul className="mt-4 space-y-3">
            {obligations.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-[#33433d]"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#4e866d]" />{item}</li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-[#f7f3ec] p-3 text-xs leading-5 text-[#718078]">Pelanggaran kewajiban dapat menyebabkan penangguhan akun mitra dan pembatalan listing. Pertanyaan? Hubungi tim Homy melalui Asisten AI.</p>
        </div>
      </div>
    </div>
  )
}

/** Halaman "Pasang Properti": prasyarat, draf, dan mulai listing baru. */
export function ListLauncher({ data, loading, reload, type }: BoardProps & { type: 'agent' | 'property-owner' }) {
  const key = ROLE_KEY[type]
  const agreementActive = (data.agreements ?? []).some((row) => row.role === key && row.status === 'active')
  const listings = data.properties ?? []
  const drafts = listings.filter((item) => item.status === 'draft' || item.status === 'pending' || item.status === 'rejected')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const signHref = `/agreement?role=${key}&next=/list`

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
      <div className={ui.card}>
        <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Prasyarat publikasi</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={`flex items-start gap-3 rounded-xl p-4 ${agreementActive ? 'bg-[#edf2ed]' : 'bg-[#fff7e3]'}`}>
            <FileSignature className={`mt-0.5 size-5 ${agreementActive ? 'text-[#4e866d]' : 'text-[#9b762a]'}`} />
            <div>
              <p className="text-sm font-semibold text-[#20332c]">Perjanjian kerja sama {agreementActive ? 'aktif ✓' : 'belum ditandatangani'}</p>
              <p className="mt-1 text-xs text-[#718078]">{'Wajib: perjanjian mitra + komisi penjualan ' + String(COMMISSION[type]).replace('.', ',') + '% + kewajiban lapor transaksi.'}</p>
              {!agreementActive && <a href={signHref} className="mt-2 inline-flex text-xs font-semibold text-[#0b3d2e] underline">Tanda tangani sekarang</a>}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-[#f7f3ec] p-4">
            <BadgeCheck className="mt-0.5 size-5 text-[#0b3d2e]" />
            <div>
              <p className="text-sm font-semibold text-[#20332c]">Form listing lengkap & terbaca AI</p>
              <p className="mt-1 text-xs text-[#718078]">Isi spesifikasi, fasilitas, dan harga. Data disimpan rapi di database sehingga Asisten AI bisa menjawab pertanyaan calon pembeli.</p>
            </div>
          </div>
        </div>
        <a href="/list" className={ui.btn + ' mt-4'}><Plus className="size-4" />Mulai listing baru</a>
      </div>

      {message && <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>}

      <div className={ui.card}>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Perlu diselesaikan</h3>
          <span className="rounded-full bg-[#f2f0ea] px-2.5 py-1 text-xs font-semibold text-[#718078]">{drafts.length} listing</span>
        </div>
        <div className="mt-4 space-y-3">
          {loading && <div className="h-16 animate-pulse rounded-xl bg-[#f7f3ec]" />}
          {!loading && !drafts.length && <p className={ui.soft + ' text-sm text-[#718078]'}>Tidak ada yang tertunda. Semua listing sudah tayang atau menunggu moderasi.</p>}
          {drafts.map((item) => {
            const meta = STATUS_LABEL[String(item.status)] ?? STATUS_LABEL.draft
            return (
              <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-[#eee7dc] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#20332c]">{item.title ?? 'Listing properti'}</p>
                  <p className="mt-1 text-xs text-[#718078]">{[item.city, item.province].filter(Boolean).join(', ') || 'Lokasi belum diisi'} · dikirim {shortDate(item.created_at)}</p>
                  {item.status === 'rejected' && item.moderation_note && <p className="mt-2 rounded-lg bg-[#fff7e3] p-2 text-xs text-[#5b4a1f]">Catatan moderator: {item.moderation_note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`${ui.badge} ${meta.className}`}>{meta.label}</span>
                  {item.status === 'rejected' && <button type="button" disabled={busy === item.id} onClick={() => onResubmit(item.id)} className={ui.btn}><RefreshCw className={`size-3.5 ${busy === item.id ? 'animate-spin' : ''}`} />Ajukan ulang</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const SLOTS = [30, 45, 60, 90, 120]
const MODE_LABEL: Record<string, string> = { onsite: 'Di lokasi', online: 'Online', both: 'Lokasi & online' }

type DaySlot = { weekday: number; is_active: boolean; start_time: string; end_time: string; slot_minutes: number; mode: string; location: string; notes: string }

function defaultDays(rows: Array<Record<string, unknown>>): DaySlot[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const row = rows.find((item) => Number(item.weekday) === weekday)
    return {
      weekday,
      is_active: row ? row.is_active !== false : weekday >= 1 && weekday <= 5,
      start_time: String(row?.start_time ?? '09:00').slice(0, 5),
      end_time: String(row?.end_time ?? '17:00').slice(0, 5),
      slot_minutes: Number(row?.slot_minutes ?? 60),
      mode: String(row?.mode ?? 'both'),
      location: String(row?.location ?? ''),
      notes: String(row?.notes ?? ''),
    }
  })
}

function minutesOf(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return (Number.isFinite(hour) ? hour : 9) * 60 + (Number.isFinite(minute) ? minute : 0)
}

/** Halaman "Ketersediaan": atur hari & jam siap menerima meeting/kunjungan calon pembeli. */
export function AvailabilityBoard({ data, loading, reload }: BoardProps & { type: 'agent' | 'property-owner' }) {
  const stored = (data.availability ?? []) as unknown as Array<Record<string, unknown>>
  const [days, setDays] = useState<DaySlot[]>(() => defaultDays(stored))
  const [hydrated, setHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  if (!hydrated && !loading) {
    setHydrated(true)
    if (stored.length) setDays(defaultDays(stored))
  }

  const activeDays = days.filter((day) => day.is_active)
  const weeklyMinutes = activeDays.reduce((total, day) => total + Math.max(0, minutesOf(day.end_time) - minutesOf(day.start_time)), 0)
  const slotCount = activeDays.reduce((total, day) => {
    const span = Math.max(0, minutesOf(day.end_time) - minutesOf(day.start_time))
    return total + Math.floor(span / (day.slot_minutes || 60))
  }, 0)
  const openDays = activeDays.map((day) => WEEKDAYS[day.weekday]).join(', ') || 'Belum ada hari aktif'

  const patch = (weekday: number, changes: Partial<DaySlot>) => setDays((current) => current.map((day) => (day.weekday === weekday ? { ...day, ...changes } : day)))

  const applyTemplate = (targets: number[], source?: DaySlot) => {
    const base = source ?? days.find((day) => day.is_active) ?? days[1]
    setDays((current) => current.map((day) => (targets.includes(day.weekday) ? { ...day, is_active: true, start_time: base.start_time, end_time: base.end_time, slot_minutes: base.slot_minutes, mode: base.mode } : day)))
    setMessage({ tone: 'ok', text: 'Template jam diterapkan. Jangan lupa simpan.' })
  }

  async function save() {
    setBusy(true)
    setMessage(null)
    try {
      await runAction({ kind: 'availability.save', days })
      setMessage({ tone: 'ok', text: 'Ketersediaan tersimpan. Calon pembeli akan melihat slot ini saat menjadwalkan kunjungan.' })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal menyimpan ketersediaan' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Hari aktif" value={String(activeDays.length)} change="Dari 7 hari" icon="calendar" />
        <MetricCard label="Jam tersedia / minggu" value={String(Math.floor(weeklyMinutes / 60))} change="Total jam buka" icon="file" />
        <MetricCard label="Slot kunjungan / minggu" value={String(slotCount)} change="Otomatis dari durasi slot" icon="message" />
        <MetricCard label="Mode dominan" value={MODE_LABEL[activeDays[0]?.mode ?? 'both'] ?? 'Lokasi & online'} change="Bisa diubah per hari" icon="home" />
      </div>

      {message && <p className={'rounded-xl px-4 py-3 text-sm font-medium ' + (message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]')}>{message.text}</p>}

      <div className={ui.card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Jam siap menerima kunjungan</h3>
            <p className="mt-1 text-sm text-[#718078]">Hari aktif: {openDays}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyTemplate([1, 2, 3, 4, 5])} className={ui.ghost}>Salin jam ke Senin–Jumat</button>
            <button type="button" onClick={() => applyTemplate([0, 1, 2, 3, 4, 5, 6])} className={ui.ghost}>Terapkan ke semua hari</button>
            <button type="button" onClick={() => { setDays((current) => current.map((day) => ({ ...day, is_active: true }))); setMessage({ tone: 'ok', text: 'Semua hari diaktifkan. Simpan untuk menerapkan.' }) }} className={ui.ghost}>Aktifkan semua</button>
            <button type="button" onClick={() => { setDays((current) => current.map((day) => ({ ...day, is_active: false }))); setMessage({ tone: 'ok', text: 'Semua hari dinonaktifkan. Simpan untuk menerapkan.' }) }} className={ui.ghost}>Nonaktifkan semua</button>
          </div>
        </div>

        {loading && <div className="mt-4 h-40 animate-pulse rounded-xl bg-[#f7f3ec]" />}

        {!loading && (
          <div className="mt-4 space-y-3">
            {days.map((day) => (
              <div key={day.weekday} className={'rounded-xl border p-4 ' + (day.is_active ? 'border-[#e5dccd] bg-white' : 'border-[#f0e9df] bg-[#faf7f2]')}>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex w-32 items-center gap-2 font-semibold text-[#20332c]">
                    <input type="checkbox" checked={day.is_active} onChange={(event) => patch(day.weekday, { is_active: event.target.checked })} className="size-4 accent-[#0b3d2e]" />
                    {WEEKDAYS[day.weekday]}
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#718078]">Mulai<input type="time" value={day.start_time} disabled={!day.is_active} onChange={(event) => patch(day.weekday, { start_time: event.target.value })} className={ui.input + ' h-9 w-28 py-0'} /></label>
                  <label className="flex items-center gap-2 text-xs text-[#718078]">Selesai<input type="time" value={day.end_time} disabled={!day.is_active} onChange={(event) => patch(day.weekday, { end_time: event.target.value })} className={ui.input + ' h-9 w-28 py-0'} /></label>
                  <label className="flex items-center gap-2 text-xs text-[#718078]">Durasi slot<select value={day.slot_minutes} disabled={!day.is_active} onChange={(event) => patch(day.weekday, { slot_minutes: Number(event.target.value) })} className={ui.input + ' h-9 w-24 py-0'}>{SLOTS.map((slot) => <option key={slot} value={slot}>{slot} mnt</option>)}</select></label>
                  <label className="flex items-center gap-2 text-xs text-[#718078]">Mode<select value={day.mode} disabled={!day.is_active} onChange={(event) => patch(day.weekday, { mode: event.target.value })} className={ui.input + ' h-9 w-36 py-0'}><option value="onsite">Di lokasi</option><option value="online">Online</option><option value="both">Lokasi &amp; online</option></select></label>
                </div>
                {day.is_active && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input value={day.location} onChange={(event) => patch(day.weekday, { location: event.target.value })} placeholder="Lokasi meeting (mis. kantor pemasaran, properti, Zoom)" className={ui.input} />
                    <input value={day.notes} onChange={(event) => patch(day.weekday, { notes: event.target.value })} placeholder="Catatan (mis. hanya dengan janji 1 hari sebelumnya)" className={ui.input} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy || loading || !activeDays.length} onClick={save} className={ui.btn}>{busy ? 'Menyimpan…' : 'Simpan ketersediaan'}</button>
          <button type="button" onClick={() => setDays(defaultDays(stored))} className={ui.ghost}>Kembalikan ke data tersimpan</button>
          <p className="text-xs text-[#718078]">Opsi lain: durasi slot 30/45/60/90/120 menit, mode lokasi/online/keduanya, catatan per hari, dan template cepat Senin–Jumat.</p>
        </div>
      </div>

      <div className={ui.card}>
        <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Ringkasan slot yang dilihat calon pembeli</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {activeDays.length === 0 && <p className={ui.soft + ' text-sm text-[#718078]'}>Belum ada hari aktif. Aktifkan minimal satu hari lalu simpan.</p>}
          {activeDays.map((day) => {
            const span = Math.max(0, minutesOf(day.end_time) - minutesOf(day.start_time))
            const count = Math.floor(span / (day.slot_minutes || 60))
            return (
              <div key={day.weekday} className="rounded-xl bg-[#f7f3ec] p-4">
                <p className="font-semibold text-[#0b3d2e]">{WEEKDAYS[day.weekday]}</p>
                <p className="mt-1 text-sm text-[#33433d]">{day.start_time}–{day.end_time} · {MODE_LABEL[day.mode] ?? 'Lokasi & online'}</p>
                <p className="mt-1 text-xs text-[#718078]">{count} slot × {day.slot_minutes} menit{day.location ? ' · ' + day.location : ''}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
