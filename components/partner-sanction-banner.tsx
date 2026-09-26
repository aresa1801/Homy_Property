'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Ban, ShieldAlert } from 'lucide-react'

type PartnerState = {
  state?: string
  level?: number
  latest_reason?: string | null
  latest_kind?: string | null
  latest_category?: string | null
  since?: string | null
  until?: string | null
}

const CATEGORY_LABEL: Record<string, string> = {
  etika: 'pelanggaran etika',
  komisi: 'komisi yang tidak dibayar',
  rule: 'pelanggaran aturan kerja sama',
  penipuan: 'penipuan / kecurangan',
  lainnya: 'pelanggaran aturan',
}

/** Banner peringatan sanksi mitra — hanya tampil bila mitra sedang kena teguran/peringatan/suspend/blokir. */
export function PartnerSanctionBanner() {
  const [data, setData] = useState<PartnerState | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/partner/status', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (alive && json?.state) setData(json.state as PartnerState) })
      .catch(() => { /* diamkan */ })
    return () => { alive = false }
  }, [])

  const level = Number(data?.level ?? 0)
  if (!data || level < 1) return null

  const until = data.until ? new Date(data.until).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : null
  const reason = data.latest_reason ? `Alasan: ${data.latest_reason}` : ''

  const isBlocked = level >= 4
  const isSuspended = level === 3
  const tone = isBlocked
    ? 'border-[#b45c50] bg-[#3a1512] text-[#f7e3df]'
    : isSuspended
      ? 'border-[#d98b7d] bg-[#fbeeec] text-[#7d3227]'
      : level === 2
        ? 'border-[#e2b979] bg-[#fdeee6] text-[#8a4f13]'
        : 'border-[#e2cfa0] bg-[#fff7e3] text-[#8a6a1f]'

  const title = isBlocked
    ? 'Akun mitra Anda diblokir'
    : isSuspended
      ? 'Akun mitra Anda ditangguhkan sementara'
      : level === 2
        ? 'Peringatan keras untuk akun mitra Anda'
        : 'Teguran untuk akun mitra Anda'

  const body = isBlocked
    ? 'Listing Anda tidak tayang dan Anda belum bisa memasang listing baru. Hubungi tim Homy untuk peninjauan.'
    : isSuspended
      ? `Listing Anda disembunyikan sementara${until ? ` hingga ${until}` : ''} dan Anda belum bisa memasang listing baru.`
      : 'Mohon segera perbaiki pelanggaran ini. Pelanggaran berulang dapat berujung suspend atau blokir.'

  const Icon = isBlocked ? Ban : isSuspended ? ShieldAlert : AlertTriangle

  return (
    <div className={`mb-4 flex items-start gap-3 rounded-2xl border p-4 ${tone}`}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 opacity-90">{body}</p>
        {reason && <p className="mt-1 opacity-80">{reason}{data.latest_category ? ` (${CATEGORY_LABEL[String(data.latest_category)] ?? data.latest_category})` : ''}</p>}
      </div>
    </div>
  )
}
