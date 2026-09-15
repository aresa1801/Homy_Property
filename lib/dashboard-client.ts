'use client'

import { useCallback, useEffect, useState } from 'react'

export type DashboardProperty = {
  id: string
  title?: string
  city?: string
  province?: string
  district?: string
  status?: string
  listing_type?: string
  property_type?: string
  price?: number | string | null
  price_period?: string | null
  created_at?: string
  moderation_note?: string | null
  verified_at?: string | null
  ai_summary?: string | null
}

export type DashboardInquiry = {
  id: string
  property_id?: string
  property_title?: string
  status?: string
  message?: string
  reply_message?: string | null
  replied_at?: string | null
  follow_up_note?: string | null
  created_at?: string
  from?: { name?: string; email?: string; phone?: string } | null
}

export type DashboardVisit = {
  id: string
  property_id?: string
  property_title?: string
  scheduled_at?: string
  status?: string
  notes?: string | null
  visitor?: { name?: string; email?: string; phone?: string } | null
}

export type DashboardTransaction = {
  id: string
  property_id?: string | null
  property_title?: string | null
  buyer_name?: string | null
  buyer_contact?: string | null
  sale_price?: number | string
  commission_rate?: number | string
  commission_amount?: number | string
  sold_at?: string | null
  status?: string
  notes?: string | null
  created_at?: string
}

export type DashboardAgreement = {
  role?: string
  status?: string
  full_name?: string
  identity_number?: string
  phone?: string
  address?: string
  commission_rate?: number | string
  signed_at?: string
  agreement_version?: string
}

export type DashboardUser = {
  id: string
  full_name?: string | null
  email?: string | null
  phone?: string | null
  roles?: string[]
  created_at?: string
  listings?: number
  verification?: string
}

export type DashboardReport = {
  id: string
  property_id?: string | null
  property_title?: string | null
  reported_user_id?: string | null
  reported_user?: { name?: string; email?: string } | null
  reason?: string | null
  status?: string
  resolution_note?: string | null
  created_at?: string
}

export type DashboardAudit = {
  id: string
  actor_id?: string | null
  actor?: { name?: string; email?: string } | null
  action?: string
  entity_type?: string | null
  entity_id?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string
}

export type DashboardFlag = { key: string; label: string; description?: string | null; enabled: boolean; rollout: number; updated_at?: string }
export type DashboardSetting = { key: string; label?: string | null; value: unknown; updated_at?: string }
export type DashboardTransactionAdmin = DashboardTransaction & { user?: { name?: string; email?: string } | null; role?: string | null; review_note?: string | null; verified_at?: string | null }
export type DashboardDuplicate = { key: string; count: number; ids: string[]; titles: string[] }
export type DashboardRoleCount = { role: string; count: number }

export type DashboardPayload = {
  authenticated?: boolean
  role?: string
  metrics?: Record<string, number>
  properties?: DashboardProperty[]
  inquiries?: DashboardInquiry[]
  visits?: DashboardVisit[]
  transactions?: DashboardTransaction[]
  agreements?: DashboardAgreement[]
  users?: DashboardUser[]
  allProperties?: DashboardProperty[]
  adminReports?: DashboardReport[]
  audit?: DashboardAudit[]
  flags?: DashboardFlag[]
  settings?: DashboardSetting[]
  duplicates?: DashboardDuplicate[]
  roleCounts?: DashboardRoleCount[]
  ai?: { configured?: boolean; model?: string; listingsWithSummary?: number; listingsWithoutMedia?: number; amenitiesCoverage?: number }
}

/** Ambil data dashboard (properties/inquiries/visits/transactions) + reload manual. */
export function useDashboard(type: string) {
  const [data, setData] = useState<DashboardPayload>({})
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/dashboard/${type}`)
      .then((response) => response.json())
      .then((payload) => setData(payload ?? {}))
      .catch(() => setData({}))
      .finally(() => setLoading(false))
  }, [type])
  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}

export async function runAction(payload: Record<string, unknown>) {
  const response = await fetch('/api/dashboard/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(body?.error ?? 'Aksi gagal dijalankan'))
  return body
}

/** Aksi operasional admin/super admin (verifikasi komisi, laporan, peran, flag, konfigurasi). */
export async function adminAction(payload: Record<string, unknown>) {
  const response = await fetch('/api/admin/ops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(body?.error ?? 'Aksi gagal dijalankan'))
  return body
}

export async function resubmitListing(id: string) {
  const response = await fetch(`/api/listings/${id}/resubmit`, { method: 'POST' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(body?.error ?? 'Gagal mengajukan ulang listing'))
  return body
}

export function rupiah(value: number | string | null | undefined) {
  const amount = typeof value === 'string' ? Number(value) : value
  if (!amount || Number.isNaN(amount)) return '—'
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}

export function shortDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function shortDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  published: { label: 'Tayang', className: 'bg-[#edf2ed] text-[#4e866d]' },
  pending: { label: 'Menunggu moderasi', className: 'bg-[#fff7e3] text-[#9b762a]' },
  rejected: { label: 'Ditolak', className: 'bg-[#fbeeec] text-[#b45c50]' },
  draft: { label: 'Draf', className: 'bg-[#f2f0ea] text-[#718078]' },
  archived: { label: 'Diarsipkan', className: 'bg-[#f2f0ea] text-[#718078]' },
}

export const STAGE_LABEL: Record<string, { label: string; className: string }> = {
  open: { label: 'Baru', className: 'bg-[#eef3fa] text-[#3f6b9c]' },
  contacted: { label: 'Dihubungi', className: 'bg-[#fff7e3] text-[#9b762a]' },
  viewing: { label: 'Kunjungan', className: 'bg-[#f1ecfa] text-[#6a4fa3]' },
  negotiation: { label: 'Negosiasi', className: 'bg-[#fdeee6] text-[#b4661f]' },
  closed: { label: 'Selesai', className: 'bg-[#edf2ed] text-[#4e866d]' },
}

export const VISIT_LABEL: Record<string, { label: string; className: string }> = {
  requested: { label: 'Menunggu konfirmasi', className: 'bg-[#fff7e3] text-[#9b762a]' },
  confirmed: { label: 'Terkonfirmasi', className: 'bg-[#edf2ed] text-[#4e866d]' },
  completed: { label: 'Selesai', className: 'bg-[#f2f0ea] text-[#718078]' },
  cancelled: { label: 'Dibatalkan', className: 'bg-[#fbeeec] text-[#b45c50]' },
}

export const ui = {
  card: 'rounded-2xl border border-[#e5dccd] bg-white p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]',
  soft: 'rounded-xl bg-[#f7f3ec] p-4',
  eyebrow: 'text-xs font-semibold uppercase tracking-[.16em] text-[#a18a61]',
  btn: 'inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14553f] disabled:opacity-60',
  ghost: 'inline-flex items-center gap-2 rounded-lg border border-[#d8ccbb] px-3 py-1.5 text-xs font-semibold text-[#33433d] hover:bg-[#f7f3ec] disabled:opacity-60',
  input: 'w-full rounded-lg border border-[#d8ccbb] bg-white px-3 py-2 text-sm text-[#20332c] outline-none focus:border-[#0b3d2e]',
  badge: 'rounded-full px-2.5 py-1 text-xs font-semibold',
}
