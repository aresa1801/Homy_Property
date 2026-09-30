'use client'

import { useState } from 'react'
import { BadgeCheck, Copy, Gift, ImageDown, Link2, RefreshCw, Send, ShieldAlert, Sparkles, WalletCards } from 'lucide-react'
import { MetricCard } from '@/components/dashboard-shell'
import { ReferralPosterDialog } from '@/components/referral-poster'
import { rupiah, shortDate, shortDateTime, ui, type DashboardPayload, type DashboardReferral, type DashboardReferralLedger } from '@/lib/dashboard-client'

type BoardProps = { data: DashboardPayload; loading: boolean; reload: () => void }

const LEDGER_STATUS: Record<string, { label: string; className: string }> = {
  hold: { label: 'Ditahan (masa tahan)', className: 'bg-[#fff7e3] text-[#9b762a]' },
  approved: { label: 'Siap dibayar', className: 'bg-[#eef3fa] text-[#3f6b9c]' },
  paid: { label: 'Sudah dibayar', className: 'bg-[#edf2ed] text-[#4e866d]' },
  void: { label: 'Dibatalkan', className: 'bg-[#fbeeec] text-[#b45c50]' },
}

const REFERRAL_STATUS: Record<string, { label: string; className: string }> = {
  joined: { label: 'Bergabung', className: 'bg-[#eef3fa] text-[#3f6b9c]' },
  active: { label: 'Transaksi terverifikasi', className: 'bg-[#edf2ed] text-[#4e866d]' },
  rejected: { label: 'Terindikasi fraud', className: 'bg-[#fbeeec] text-[#b45c50]' },
  void: { label: 'Dibatalkan', className: 'bg-[#f2f0ea] text-[#718078]' },
}

function Badge({ meta }: { meta: { label: string; className: string } }) {
  return <span className={`${ui.badge} ${meta.className}`}>{meta.label}</span>
}

async function referralAction(payload: Record<string, unknown>) {
  const response = await fetch('/api/admin/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(body?.error ?? 'Aksi gagal dijalankan'))
  return body
}

async function agentAction(payload: Record<string, unknown>) {
  const response = await fetch('/api/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(body?.error ?? 'Aksi gagal dijalankan'))
  return body
}

function TermsCard({ terms }: { terms: { title: string; version: string; points: string[] } }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={ui.card}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Gift className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">{terms.title}</h3></div>
        <button type="button" onClick={() => setOpen((value) => !value)} className={ui.ghost}>{open ? 'Tutup' : 'Lihat ketentuan'}</button>
      </div>
      <p className="mt-2 text-sm text-[#718078]">Versi {terms.version} — satu level (agent → agent), dibayar setelah transaksi diverifikasi Homy.</p>
      {open && (
        <ol className="mt-4 space-y-2 text-sm text-[#4a5a53]">
          {terms.points.map((point, index) => (
            <li key={index} className="flex gap-2"><span className="font-semibold text-[#0b3d2e]">{index + 1}.</span><span>{point}</span></li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Halaman agen: "Referral & Bonus" — kode, link, statistik klik, agen yang bergabung, buku komisi. */
export function ReferralBoard({ data, loading, reload }: BoardProps) {
  const referral = data.referral as DashboardReferral | null | undefined
  const terms = referral?.settings
    ? {
        title: 'Ketentuan Program Bonus Referral (Agent → Agent)',
        version: '2026-09-27',
        points: [
          `Peserta: hanya Agen terverifikasi Homy (agent to agent).`,
          `Bonus ${((Number(referral.settings.rate ?? 0.001)) * 100).toFixed(2).replace('.', ',')}% dari nilai transaksi, maksimal ${rupiah(referral.settings.cap_amount ?? 2000000)} per transaksi.`,
          `Dibayar setelah laporan transaksi agen yang Anda referensikan DIVERIFIKASI Homy, dengan masa tahan ${referral.settings.hold_days ?? 30} hari.`,
          'Satu level: bonus hanya untuk agen yang mengajak langsung (tidak berjenjang).',
          'Anti-fraud: dilarang self-referral, identitas/HP/rekening sama, atau akun palsu.',
        ],
      }
    : { title: 'Ketentuan Program Bonus Referral (Agent → Agent)', version: '2026-09-27', points: ['Muat ulang halaman untuk memuat ketentuan.'] }

  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [posterOpen, setPosterOpen] = useState(false)

  const link = referral?.link ?? null
  const metrics = referral?.metrics ?? {}
  const agentName = (data.agreements ?? [])[0]?.full_name ?? null

  async function activate() {
    setBusy(true); setMessage(null)
    try {
      await agentAction({ action: 'activate', agree: true })
      setMessage({ tone: 'ok', text: 'Kode referral Anda aktif. Bagikan link di bawah ke sesama agen.' })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Gagal mengaktifkan kode referral' })
    } finally { setBusy(false) }
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { setMessage({ tone: 'err', text: 'Gagal menyalin. Salin manual: ' + link }) }
  }

  if (loading && !referral) return <div className={ui.card}><p className="text-sm text-[#718078]">Memuat data referral…</p></div>

  const ledger = (referral?.ledger ?? []) as DashboardReferralLedger[]

  return (
    <div className="space-y-4 sm:space-y-6">
      {message && <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>}

      {!referral?.participant ? (
        <>
          <div className={ui.card}>
            <div className="flex items-center gap-2"><Sparkles className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Aktifkan kode referral Anda</h3></div>
            <p className="mt-2 text-sm text-[#718078]">Ajak sesama agen bergabung ke Homy. Setiap transaksi agen yang Anda referensikan dan sudah diverifikasi Homy memberi bonus <b>0,1% dari nilai transaksi</b> (maks {rupiah(referral?.settings?.cap_amount ?? 2000000)}).</p>
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-[#f7f3ec] p-4 text-sm text-[#33433d]">
              <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} className="mt-1 size-4" />
              <span>Saya menyetujui <b>{terms.title}</b> versi {terms.version} — termasuk larangan self-referral dan penggunaan identitas/rekening yang sama.</span>
            </label>
            <button type="button" disabled={!agree || busy} onClick={activate} className={`${ui.btn} mt-4`}>{busy ? 'Mengaktifkan…' : 'Aktifkan kode referral'}</button>
          </div>
          <TermsCard terms={terms} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <MetricCard label="Klik link" value={String(metrics.clicks ?? 0)} change={`${metrics.clicks30d ?? 0} klik dalam 30 hari`} icon="chart" />
            <MetricCard label="Agen bergabung" value={String(metrics.joined ?? 0)} change={`${metrics.flagged ?? 0} terindikasi fraud`} icon="users" />
            <MetricCard label="Bonus ditahan" value={rupiah(metrics.commissionHold ?? 0)} change="Menunggu masa tahan 30 hari" icon="wallet" />
            <MetricCard label="Siap dibayar" value={rupiah(metrics.commissionApproved ?? 0)} change={`Sudah dibayar: ${rupiah(metrics.commissionPaid ?? 0)}`} icon="sparkles" />
          </div>

          <div className={ui.card}>
            <div className="flex items-center gap-2"><Link2 className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Link referral Anda</h3></div>
            <p className="mt-2 text-sm text-[#718078]">Kode: <b className="text-[#0b3d2e]">{referral.participant?.code}</b> • aktif sejak {shortDate(referral.participant?.terms_accepted_at ?? null)}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input readOnly value={link ?? ''} className={ui.input} />
              <div className="flex gap-3">
                <button type="button" onClick={copy} className={`${ui.btn} flex-1 justify-center py-2.5`}><Copy className="size-4" />{copied ? 'Tersalin!' : 'Salin link'}</button>
                <button type="button" onClick={() => setPosterOpen(true)} className={`${ui.ghost} flex-1 justify-center py-2.5`}><ImageDown className="size-4" />Buat poster</button>
              </div>
            </div>
            <p className="mt-3 text-xs text-[#a18a61]">Bagikan link ini ke agen lain. Atribusi tersimpan 30 hari sejak link diklik — bonus dihitung hanya jika agen tersebut mendaftar sebagai Agen dan transaksinya diverifikasi Homy. Butuh bahan promosi? Klik <b>Buat poster</b> untuk poster siap-bagikan dengan QR referral Anda.</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className={ui.card}>
              <h3 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Agen yang bergabung</h3>
              <div className="mt-4 space-y-3">
                {(referral.referrals ?? []).length === 0 && <p className="text-sm text-[#718078]">Belum ada agen yang bergabung dari link Anda.</p>}
                {(referral.referrals ?? []).map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f3ec] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#20332c]">{row.referee_name || 'Agen'}</p>
                      <p className="text-xs text-[#718078]">Bergabung {shortDate(row.joined_at ?? null)}</p>
                    </div>
                    <Badge meta={REFERRAL_STATUS[String(row.status ?? 'joined')] ?? REFERRAL_STATUS.joined} />
                  </div>
                ))}
              </div>
            </div>

            <div className={ui.card}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Riwayat bonus</h3>
                <button type="button" onClick={reload} className={ui.ghost}><RefreshCw className="size-4" />Muat ulang</button>
              </div>
              <div className="mt-4 space-y-3">
                {ledger.length === 0 && <p className="text-sm text-[#718078]">Belum ada bonus. Bonus muncul setelah transaksi agen yang Anda referensikan diverifikasi Homy.</p>}
                {ledger.map((row) => (
                  <div key={row.id} className="rounded-xl bg-[#f7f3ec] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#20332c]">{rupiah(row.amount)}</p>
                      <Badge meta={LEDGER_STATUS[String(row.status)] ?? LEDGER_STATUS.hold} />
                    </div>
                    <p className="mt-1 text-xs text-[#718078]">Mitra: {row.referee_name || '—'} • Transaksi {rupiah(row.basis_amount)} • {row.property_title ?? 'Listing'}</p>
                    <p className="mt-1 text-xs text-[#a18a61]">{row.status === 'hold' ? `Siap dibayar setelah ${shortDate(row.hold_until ?? null)}` : row.paid_at ? `Dibayar ${shortDateTime(row.paid_at)}` : 'Menunggu pembayaran oleh admin'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={ui.card}>
            <div className="flex items-center gap-2"><WalletCards className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Pembayaran bonus</h3></div>
            <p className="mt-2 text-sm text-[#718078]">Bonus ditransfer manual oleh admin ke rekening pada data verifikasi Anda. Rekap:</p>
            <div className="mt-4 space-y-3">
              {(referral.payouts ?? []).length === 0 && <p className="text-sm text-[#718078]">Belum ada pembayaran.</p>}
              {(referral.payouts ?? []).map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f3ec] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#20332c]">{rupiah(row.total_amount)} <span className="text-xs font-normal text-[#718078]">({row.entries ?? 0} transaksi)</span></p>
                    <p className="text-xs text-[#718078]">Periode {row.period ?? '—'} • {row.reference ? `Ref ${row.reference}` : 'Tanpa referensi'}</p>
                  </div>
                  <Badge meta={row.status === 'paid' ? LEDGER_STATUS.paid : LEDGER_STATUS.hold} />
                </div>
              ))}
            </div>
          </div>

          <TermsCard terms={terms} />
        </>
      )}

      {link && (
        <ReferralPosterDialog
          open={posterOpen}
          onClose={() => setPosterOpen(false)}
          link={link}
          code={referral?.participant?.code ?? null}
          agentName={agentName}
        />
      )}
    </div>
  )
}

/** Halaman admin/super admin: pemantauan program, tinjauan fraud, pembayaran batch, dan pengaturan. */
export function ReferralAdminBoard({ data, loading, reload }: BoardProps) {
  const referral = data.referral as DashboardReferral | null | undefined
  const metrics = referral?.metrics ?? {}
  const ledger = (referral?.ledger ?? []) as DashboardReferralLedger[]
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [form, setForm] = useState({
    rate: String(((referral?.settings?.rate ?? 0.001) * 100).toFixed(2)),
    cap: String(referral?.settings?.cap_amount ?? 2000000),
    hold: String(referral?.settings?.hold_days ?? 30),
    enabled: referral?.settings?.enabled !== false,
  })

  const payable = Array.from(
    ledger.filter((row) => row.status === 'approved').reduce((map, row) => {
      const key = String(row.referrer_id ?? '')
      const current = map.get(key) ?? { referrerId: key, name: String(row.referrer_name ?? ''), total: 0, entries: 0 }
      current.total += Number(row.amount ?? 0)
      current.entries += 1
      map.set(key, current)
      return map
    }, new Map<string, { referrerId: string; name: string; total: number; entries: number }>()).values(),
  )

  async function run(payload: Record<string, unknown>, successText: string) {
    setBusy(true); setMessage(null)
    try {
      const result = await referralAction(payload)
      setMessage({ tone: 'ok', text: successText + (result?.released !== undefined ? ` (${result.released} baris)` : '') })
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Aksi gagal' })
    } finally { setBusy(false) }
  }

  if (loading && !referral) return <div className={ui.card}><p className="text-sm text-[#718078]">Memuat data program referral…</p></div>

  return (
    <div className="space-y-4 sm:space-y-6">
      {message && <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Agen peserta" value={String(metrics.participants ?? 0)} change="Punya kode referral aktif" icon="users" />
        <MetricCard label="Referral bergabung" value={String(metrics.joined ?? 0)} change={`${metrics.flagged ?? 0} terindikasi fraud`} icon="chart" />
        <MetricCard label="Bonus ditahan" value={rupiah(metrics.commissionHold ?? 0)} change="Belum jatuh tempo" icon="wallet" />
        <MetricCard label="Sudah dibayar" value={rupiah(metrics.commissionPaid ?? 0)} change={`Siap dibayar: ${rupiah(metrics.commissionApproved ?? 0)}`} icon="sparkles" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className={ui.card}>
          <div className="flex items-center gap-2"><ShieldAlert className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Tinjauan atribusi</h3></div>
          <div className="mt-4 space-y-3">
            {(referral?.referrals ?? []).length === 0 && <p className="text-sm text-[#718078]">Belum ada referral masuk.</p>}
            {(referral?.referrals ?? []).slice(0, 40).map((row) => (
              <div key={row.id} className="rounded-xl bg-[#f7f3ec] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#20332c]">{row.referrer_name} → {row.referee_name || '—'}</p>
                  <Badge meta={REFERRAL_STATUS[String(row.status ?? 'joined')] ?? REFERRAL_STATUS.joined} />
                </div>
                <p className="mt-1 text-xs text-[#718078]">Kode {row.code} • {shortDate(row.joined_at ?? null)}</p>
                {row.fraud_note && <p className="mt-1 text-xs text-[#b45c50]">⚠️ {row.fraud_note}</p>}
                {row.status === 'rejected' && (
                  <button type="button" disabled={busy} onClick={() => run({ action: 'review', id: row.id, status: 'active', note: 'Diverifikasi admin: dinyatakan sah.' }, 'Atribusi referral diterima')} className={`${ui.ghost} mt-2`}><BadgeCheck className="size-4" />Terima (sahkan)</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className={ui.card}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Send className="size-5 text-[#0b3d2e]" /><h3 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Pembayaran bonus</h3></div>
              <button type="button" disabled={busy} onClick={() => run({ action: 'release' }, 'Masa tahan diperiksa')} className={ui.ghost}><RefreshCw className="size-4" />Cek jatuh tempo</button>
            </div>
            <div className="mt-4 space-y-3">
              {payable.length === 0 && <p className="text-sm text-[#718078]">Tidak ada bonus yang siap dibayar saat ini.</p>}
              {payable.map((row) => (
                <div key={row.referrerId} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f3ec] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#20332c]">{row.name || 'Agen'} — {rupiah(row.total)}</p>
                    <p className="text-xs text-[#718078]">{row.entries} transaksi siap dibayar</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => {
                    const reference = window.prompt('Referensi transfer (opsional):', '') ?? ''
                    run({ action: 'payout', referrerId: row.referrerId, reference }, 'Bonus dibayarkan')
                  }} className={ui.btn}>Bayar</button>
                </div>
              ))}
            </div>
          </div>

          <div className={ui.card}>
            <h3 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Pengaturan program</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-[#718078]">Tarif (% nilai transaksi)<input value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} className={ui.input} /></label>
              <label className="text-xs font-semibold text-[#718078]">Cap per transaksi (Rp)<input value={form.cap} onChange={(event) => setForm({ ...form, cap: event.target.value.replace(/[^0-9]/g, '') })} className={ui.input} /></label>
              <label className="text-xs font-semibold text-[#718078]">Masa tahan (hari)<input value={form.hold} onChange={(event) => setForm({ ...form, hold: event.target.value.replace(/[^0-9]/g, '') })} className={ui.input} /></label>
              <label className="flex items-center gap-2 pt-5 text-sm text-[#33433d]"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="size-4" />Program aktif</label>
            </div>
            <p className="mt-3 text-xs text-[#a18a61]">Catatan: tarif berlaku untuk bonus berikutnya. Bukti pembayaran lama tetap tersimpan di buku komisi.</p>
            <button type="button" disabled={busy} onClick={() => run({
              action: 'settings',
              rate: Number(form.rate) / 100,
              cap_amount: Number(form.cap || 0),
              hold_days: Number(form.hold || 0),
              enabled: form.enabled,
            }, 'Pengaturan program disimpan')} className={`${ui.btn} mt-4`}>Simpan pengaturan</button>
          </div>
        </div>
      </div>

      <div className={ui.card}>
        <h3 className="font-serif text-xl text-[#0b3d2e] sm:text-2xl">Buku komisi referral</h3>
        <div className="mt-4 space-y-3">
          {ledger.length === 0 && <p className="text-sm text-[#718078]">Belum ada komisi tercatat.</p>}
          {ledger.slice(0, 60).map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f3ec] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#20332c]">{rupiah(row.amount)} <span className="text-xs font-normal text-[#718078]">({row.referee_name || '—'} → {row.referrer_name || '—'})</span></p>
                <p className="text-xs text-[#718078]">Transaksi {rupiah(row.basis_amount)}{row.capped ? ' (kena cap)' : ''} • {shortDate(row.created_at ?? null)}</p>
              </div>
              <Badge meta={LEDGER_STATUS[String(row.status)] ?? LEDGER_STATUS.hold} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
