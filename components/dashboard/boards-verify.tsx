'use client'

import { useMemo, useState } from 'react'
import {
  BadgeCheck, Clock, Download, FileSignature, FileText, Home, IdCard, RefreshCw, ShieldCheck, Upload, X,
} from 'lucide-react'
import { MetricCard } from '@/components/dashboard-shell'
import { adminAction, shortDateTime, ui, type DashboardPayload, type DashboardVerification } from '@/lib/dashboard-client'
import type { BoardProps } from '@/components/dashboard/boards-listing'
import { AGREEMENT_VERSION, COMMISSION_RATE } from '@/lib/partner-agreement'
import { REQUIREMENT_LABELS, WEEKDAY_LABELS, completionPercent, missingRequirements, type VerificationRecord } from '@/lib/verification'

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draf', className: 'bg-[#f2f0ea] text-[#718078]' },
  pending: { label: 'Menunggu review', className: 'bg-[#fff7e3] text-[#9b762a]' },
  approved: { label: 'Terverifikasi', className: 'bg-[#edf2ed] text-[#4e866d]' },
  rejected: { label: 'Perlu perbaikan', className: 'bg-[#fbeeec] text-[#b45c50]' },
}

const ROLE_LABEL: Record<string, string> = { agent: 'Agen Properti', property_owner: 'Pemilik Properti' }
const DOC_FIELDS: Array<{ key: keyof DashboardVerification; label: string }> = [
  { key: 'identity_doc_path', label: 'KTP / SIM' },
  { key: 'selfie_doc_path', label: 'Selfie + identitas' },
  { key: 'npwp_doc_path', label: 'NPWP' },
  { key: 'supporting_doc_path', label: 'Dokumen pendukung' },
]

function StatusBadge({ status }: { status?: string | null }) {
  const meta = STATUS_META[String(status ?? 'draft')] ?? STATUS_META.draft
  return <span className={`${ui.badge} ${meta.className}`}>{meta.label}</span>
}

function readAvailability(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
}

/** Halaman "Verifikasi Mitra" (Agen / Pemilik Properti): status pengajuan + langkah lanjutan. */
export function VerificationBoard({ data, loading, type }: BoardProps & { type: 'agent' | 'property-owner' }) {
  const requestedRole = type === 'agent' ? 'agent' : 'property_owner'
  const record = useMemo(
    () => (data.verifications ?? []).find((row) => String(row.requested_role ?? '') === requestedRole) ?? null,
    [data.verifications, requestedRole],
  )
  const agreement = useMemo(
    () => (data.agreements ?? []).find((row) => String(row.role ?? '') === requestedRole) ?? null,
    [data.agreements, requestedRole],
  )

  if (loading) {
    return <div className={ui.card}><p className="flex items-center gap-2 text-sm text-[#718078]"><RefreshCw className="size-4 animate-spin" /> Memuat data verifikasi…</p></div>
  }

  const status = String(record?.status ?? 'draft')
  const asVerification = record as unknown as VerificationRecord | null
  const percent = asVerification ? completionPercent(asVerification) : 0
  const missing = asVerification ? missingRequirements(asVerification) : []
  const availability = readAvailability(record?.availability).filter((row) => Boolean(row.is_active))
  const signedAt = record?.agreement_signed_at ?? agreement?.signed_at ?? null
  const verifyHref = `/verify?role=${requestedRole}`

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Status verifikasi" value={STATUS_META[status]?.label ?? 'Draf'} change={record?.submitted_at ? `Dikirim ${shortDateTime(record.submitted_at)}` : 'Belum dikirim'} icon="shield" />
        <MetricCard label="Kelengkapan data" value={`${percent}%`} change={missing.length ? `${missing.length} data belum lengkap` : 'Semua data lengkap'} icon="chart" />
        <MetricCard label="Perjanjian kerja sama" value={signedAt ? 'Ditandatangani' : 'Belum'} change={signedAt ? `Versi ${record?.agreement_version ?? AGREEMENT_VERSION}` : `Komisi ${COMMISSION_RATE}%`} icon="sparkles" />
        <MetricCard label="Hari ketersediaan" value={String(availability.length)} change={availability.length ? 'Siap menerima jadwal' : 'Belum diatur'} icon="calendar" />
      </div>

      <div className={ui.card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`grid size-11 place-items-center rounded-xl ${status === 'approved' ? 'bg-[#edf2ed] text-[#4e866d]' : 'bg-[#f7f3ec] text-[#0b3d2e]'}`}>
              {status === 'approved' ? <BadgeCheck className="size-5" /> : <ShieldCheck className="size-5" />}
            </span>
            <div>
              <p className="font-serif text-xl text-[#0b3d2e]">Verifikasi {ROLE_LABEL[requestedRole]}</p>
              <p className="text-sm text-[#718078]">{record?.full_name ? `Nama mitra: ${record.full_name}` : 'Belum ada pengajuan verifikasi'}</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#efe8dc]">
          <div className="h-full rounded-full bg-[#0b3d2e] transition-all" style={{ width: `${percent}%` }} />
        </div>

        {missing.length > 0 && (
          <p className="mt-3 text-xs text-[#718078]">Kurang: {missing.map((key) => REQUIREMENT_LABELS[key]).join(', ')}</p>
        )}

        {status === 'rejected' && record?.reviewer_note && (
          <p className="mt-4 rounded-xl bg-[#fbeeec] p-3 text-sm text-[#b45c50]">Catatan admin: {record.reviewer_note}</p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {status === 'approved' ? (
            <>
              <a href="/list" className={ui.btn + ' !px-4 !py-2.5 !text-sm'}><Home className="size-4" /> Pasang listing properti</a>
              <a href={`/dashboard/${type}/list`} className={ui.ghost + ' !px-4 !py-2.5 !text-sm'}>Lewati dulu</a>
            </>
          ) : (
            <a href={verifyHref} className={ui.btn + ' !px-4 !py-2.5 !text-sm'}>
              {status === 'pending' ? 'Perbarui data verifikasi' : 'Lanjutkan verifikasi'}
            </a>
          )}
          {signedAt && (
            <a href={`/api/agreement/pdf?role=${requestedRole}`} className={ui.ghost + ' !px-4 !py-2.5 !text-sm'}>
              <Download className="size-4" /> Unduh perjanjian (PDF)
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={ui.card}>
          <h3 className="flex items-center gap-2 font-serif text-xl text-[#0b3d2e]"><IdCard className="size-5 text-[#0b3d2e]" /> Data terkirim</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ['Nama lengkap', record?.full_name],
              ['Identitas', record?.identity_number ? `${String(record.identity_type ?? 'ktp').toUpperCase()} · ${record.identity_number}` : null],
              ['Telepon / WhatsApp', [record?.phone, record?.whatsapp].filter(Boolean).join(' / ') || null],
              ['Email', record?.email],
              ['Alamat domisili', [record?.address, record?.village, record?.district, record?.city, record?.province].filter(Boolean).join(', ') || null],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between gap-3 border-b border-[#f0ebe2] pb-2 last:border-0">
                <dt className="text-[#718078]">{label}</dt>
                <dd className="max-w-[60%] text-right font-medium text-[#20332c]">{value ? String(value) : '—'}</dd>
              </div>
            ))}
          </dl>
          {record?.notes && <p className="mt-3 rounded-xl bg-[#f7f3ec] p-3 text-xs text-[#718078]">Catatan Anda: {record.notes}</p>}
        </div>

        <div className={ui.card}>
          <h3 className="flex items-center gap-2 font-serif text-xl text-[#0b3d2e]"><Clock className="size-5 text-[#0b3d2e]" /> Ketersediaan waktu</h3>
          {availability.length === 0 ? (
            <p className="mt-3 text-sm text-[#718078]">Belum ada jadwal ketersediaan. Atur di halaman verifikasi agar calon pembeli bisa mengajukan survey.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {availability.map((row) => (
                <li key={String(row.weekday)} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f3ec] px-3 py-2">
                  <span className="font-semibold text-[#0b3d2e]">{WEEKDAY_LABELS[Number(row.weekday)] ?? `Hari ${row.weekday}`}</span>
                  <span className="text-[#65706c]">{String(row.start_time ?? '')}–{String(row.end_time ?? '')} · {String(row.slot_minutes ?? 60)} menit</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** Halaman admin: tinjau & setujui verifikasi mitra. */
export function VerificationReviewBoard({ data, loading, reload }: BoardProps) {
  const [filter, setFilter] = useState('pending')
  const [openId, setOpenId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const rows = data.verifications ?? []
  const filters: Array<[string, string]> = [['pending', 'Menunggu'], ['approved', 'Disetujui'], ['rejected', 'Ditolak'], ['draft', 'Draf'], ['all', 'Semua']]
  const visible = useMemo(
    () => [...rows].filter((row) => filter === 'all' || String(row.status ?? 'draft') === filter)
      .sort((a, b) => String(b.submitted_at ?? b.updated_at ?? '').localeCompare(String(a.submitted_at ?? a.updated_at ?? ''))),
    [rows, filter],
  )

  async function act(record: DashboardVerification, kind: 'verification.approve' | 'verification.reject' | 'verification.reopen') {
    setBusy(record.id)
    setMessage(null)
    try {
      await adminAction({ kind, id: record.id, note: note.trim() })
      setMessage({ tone: 'ok', text: kind === 'verification.approve' ? 'Verifikasi disetujui. Peran mitra aktif & pengguna diberi notifikasi.' : kind === 'verification.reject' ? 'Verifikasi ditolak. Pengguna diberi catatan perbaikan.' : 'Pengajuan dikembalikan ke status menunggu.' })
      setNote('')
      setOpenId(null)
      reload()
    } catch (error) {
      setMessage({ tone: 'err', text: error instanceof Error ? error.message : 'Aksi gagal dijalankan' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Menunggu review" value={String(rows.filter((row) => row.status === 'pending').length)} change="Perlu keputusan admin" icon="shield" />
        <MetricCard label="Disetujui" value={String(rows.filter((row) => row.status === 'approved').length)} change="Mitra aktif" icon="shield" />
        <MetricCard label="Ditolak" value={String(rows.filter((row) => row.status === 'rejected').length)} change="Menunggu perbaikan mitra" icon="flag" />
        <MetricCard label="Draf" value={String(rows.filter((row) => !row.status || row.status === 'draft').length)} change="Belum dikirim mitra" icon="file" />
      </div>

      {message && <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>{message.text}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {filters.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${filter === value ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white' : 'border-[#e5dccd] bg-white text-[#33433d]'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className={ui.card}><p className="flex items-center gap-2 text-sm text-[#718078]"><RefreshCw className="size-4 animate-spin" /> Memuat pengajuan verifikasi…</p></div>}

      {!loading && visible.length === 0 && (
        <div className={ui.card}><p className="text-sm text-[#718078]">Tidak ada pengajuan verifikasi pada kategori ini.</p></div>
      )}

      <div className="space-y-3">
        {visible.map((record) => {
          const open = openId === record.id
          const availability = readAvailability(record.availability).filter((row) => Boolean(row.is_active))
          return (
            <div key={record.id} className={ui.card}>
              <button type="button" onClick={() => { setOpenId(open ? null : record.id); setNote('') }} className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
                <div>
                  <p className="font-serif text-lg text-[#0b3d2e]">{record.full_name || record.applicant?.name || 'Tanpa nama'}</p>
                  <p className="mt-0.5 text-xs text-[#718078]">
                    {ROLE_LABEL[String(record.requested_role ?? '')] ?? 'Mitra'} · {record.email || record.applicant?.email || '—'} · {record.phone || '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-[#a18a61]">
                    {record.status === 'draft' ? `Draf · diperbarui ${shortDateTime(record.updated_at)}` : `Dikirim ${shortDateTime(record.submitted_at ?? record.updated_at)}`}
                    {record.agreement_signed_at ? ' · perjanjian ✓' : ''}
                  </p>
                </div>
                <StatusBadge status={record.status} />
              </button>

              {open && (
                <div className="mt-4 space-y-4 border-t border-[#eee7dc] pt-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <Detail title="Data diri" rows={[
                      ['Nama', record.full_name], ['Panggilan', record.nickname],
                      ['Identitas', record.identity_number ? `${String(record.identity_type ?? 'ktp').toUpperCase()} · ${record.identity_number}` : null],
                      ['Lahir', [record.birth_place, record.birth_date].filter(Boolean).join(', ') || null],
                      ['Jenis kelamin', record.gender], ['Perkawinan', record.marital_status], ['Pekerjaan', record.occupation],
                      ['Telepon', record.phone], ['WhatsApp', record.whatsapp], ['Email', record.email],
                      ['Agensi', record.company_name], ['Izin keagenan', record.agency_license], ['NPWP', record.npwp],
                    ]} />
                    <Detail title="Domisili" rows={[
                      ['Alamat', record.address], ['RT/RW', record.rt_rw], ['Kelurahan', record.village], ['Kecamatan', record.district],
                      ['Kota/Kabupaten', record.city], ['Provinsi', record.province], ['Kode pos', record.postal_code],
                      ['Sama dengan KTP', record.domicile_same_as_ktp === false ? 'Tidak' : 'Ya'],
                      ['Alamat KTP', record.ktp_address],
                    ]} />
                  </div>

                  <div>
                    <p className={ui.eyebrow}>Dokumen identitas</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DOC_FIELDS.map((item) => {
                        const path = record[item.key]
                        return path ? (
                          <a key={String(item.key)} href={`/api/admin/verification-doc?id=${record.id}&field=${String(item.key)}`} target="_blank" rel="noreferrer" className={ui.ghost}>
                            <FileText className="size-3.5" /> {item.label}
                          </a>
                        ) : (
                          <span key={String(item.key)} className="rounded-lg border border-dashed border-[#e0d6c6] px-3 py-1.5 text-xs text-[#a9a29a]">{item.label}: belum ada</span>
                        )
                      })}
                      {record.agreement_signed_at && (
                        <a href={`/api/agreement/pdf?user_id=${record.user_id}&role=${String(record.requested_role ?? 'agent')}`} target="_blank" rel="noreferrer" className={ui.btn}>
                          <FileSignature className="size-3.5" /> Perjanjian PDF
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className={ui.eyebrow}>Ketersediaan waktu</p>
                    {availability.length === 0 ? (
                      <p className="mt-1 text-sm text-[#718078]">Belum diatur.</p>
                    ) : (
                      <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                        {availability.map((row) => (
                          <li key={String(row.weekday)} className="rounded-full bg-[#f7f3ec] px-3 py-1.5 text-[#33433d]">
                            <span className="font-semibold text-[#0b3d2e]">{WEEKDAY_LABELS[Number(row.weekday)] ?? row.weekday}</span> · {String(row.start_time ?? '')}–{String(row.end_time ?? '')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {record.reviewer_note && <p className="rounded-xl bg-[#f7f3ec] p-3 text-xs text-[#718078]">Catatan review sebelumnya: {record.reviewer_note}</p>}

                  <div className="space-y-2">
                    <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan untuk mitra (wajib bila menolak)" className={ui.input} />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy === record.id || record.status === 'approved'} onClick={() => act(record, 'verification.approve')} className={ui.btn}>
                        <BadgeCheck className="size-3.5" /> {busy === record.id ? 'Memproses…' : 'Setujui & aktifkan peran'}
                      </button>
                      <button type="button" disabled={busy === record.id || record.status === 'rejected'} onClick={() => act(record, 'verification.reject')} className={ui.ghost + ' !text-[#b45c50]'}>
                        <X className="size-3.5" /> Tolak
                      </button>
                      <button type="button" disabled={busy === record.id} onClick={() => act(record, 'verification.reopen')} className={ui.ghost}>
                        <Upload className="size-3.5" /> Minta perbaikan
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Detail({ title, rows }: { title: string; rows: Array<[string, unknown]> }) {
  const clean = rows.filter(([, value]) => value !== null && value !== undefined && String(value) !== '')
  return (
    <div className="rounded-xl bg-[#f7f3ec] p-3">
      <p className={ui.eyebrow}>{title}</p>
      <dl className="mt-2 space-y-1.5">
        {clean.length === 0 && <p className="text-xs text-[#a9a29a]">—</p>}
        {clean.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 text-xs">
            <dt className="text-[#718078]">{label}</dt>
            <dd className="max-w-[60%] text-right font-medium text-[#20332c]">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
