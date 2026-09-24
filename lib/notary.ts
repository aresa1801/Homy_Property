/**
 * Homy — Direktori Notaris/PPAT (mitra legal terverifikasi) + pengajuan pendampingan.
 *
 * Sifat direktori: REKOMENDASI platform, bukan kewajiban. Pengguna/agen/pemilik bebas
 * memakai notaris pilihannya sendiri.
 */
import { INTEREST_READINESS, INTEREST_STAGES } from '@/lib/interest'

export const AREAS_MAX = 6

export type NotaryArea = { province: string; kabupaten: string; kecamatan: string }

export type NotaryStatus = 'active' | 'inactive' | 'pending'

export const NOTARY_STATUS_META: Record<string, { label: string; tone: string }> = {
  active: { label: 'Aktif (tayang)', tone: 'bg-[#edf2ed] text-[#4e866d]' },
  inactive: { label: 'Nonaktif', tone: 'bg-[#f2f0ea] text-[#718078]' },
  pending: { label: 'Menunggu verifikasi', tone: 'bg-[#fff7e3] text-[#9b762a]' },
}

export const NOTARY_REQUEST_STATUS_META: Record<string, { label: string; tone: string }> = {
  submitted: { label: 'Baru', tone: 'bg-[#fff7e3] text-[#9b762a]' },
  recommended: { label: 'Direkomendasikan', tone: 'bg-[#eef3fa] text-[#3f6b9c]' },
  contacted: { label: 'Diikuti tim Homy', tone: 'bg-[#f1ecfa] text-[#6a4fa3]' },
  assigned: { label: 'Notaris ditunjuk', tone: 'bg-[#edf2ed] text-[#4e866d]' },
  completed: { label: 'Selesai', tone: 'bg-[#edf2ed] text-[#4e866d]' },
  cancelled: { label: 'Dibatalkan', tone: 'bg-[#fbeeec] text-[#b45c50]' },
}

/** Kesiapan pembeli yang dianggap "siap transaksi" (memicu fitur ajukan notaris). */
export const READY_READINESS = ['ready', 'committed'] as const
export const READY_STAGES = ['offer', 'deal'] as const

/** True kalau data minat/kepastian pembeli menandakan siap bertransaksi. */
export function isTransactReady(input?: { readiness?: string | null; stage?: string | null } | null): boolean {
  if (!input) return false
  const readiness = String(input.readiness ?? '').toLowerCase()
  const stage = String(input.stage ?? '').toLowerCase()
  return (READY_READINESS as readonly string[]).includes(readiness) || (READY_STAGES as readonly string[]).includes(stage)
}

/** Ringkasan cepat untuk label UI. */
export function readinessHint(readiness?: string | null): string {
  const map: Record<string, string> = {
    exploring: 'Masih melihat-lihat',
    comparing: 'Sedang membandingkan pilihan',
    ready: 'Siap bertransaksi',
    committed: 'Sudah berkomitmen',
  }
  return map[String(readiness ?? '').toLowerCase()] ?? 'Belum menyatakan kesiapan'
}

export const INTEREST_READINESS_VALUES = INTEREST_READINESS
export const INTEREST_STAGE_VALUES = INTEREST_STAGES

/** Bersihkan & batasi daftar area kerja notaris dari input form. */
export function sanitizeAreas(value: unknown): NotaryArea[] {
  const rows = Array.isArray(value) ? value : []
  const out: NotaryArea[] = []
  for (const row of rows) {
    const item = (row ?? {}) as Record<string, unknown>
    const province = String(item.province ?? '').trim().slice(0, 80)
    const kabupaten = String(item.kabupaten ?? '').trim().slice(0, 80)
    const kecamatan = String(item.kecamatan ?? '').trim().slice(0, 80)
    if (!province && !kabupaten && !kecamatan) continue
    out.push({ province, kabupaten, kecamatan })
    if (out.length >= AREAS_MAX) break
  }
  return out
}

/** Label ringkas satu area. */
export function areaLabel(area: { province?: string | null; kabupaten?: string | null; kecamatan?: string | null }): string {
  return [area.kecamatan, area.kabupaten, area.province].filter(Boolean).join(', ')
}

/** Label notaris: "Kantor — Nama" atau salah satunya. */
export function notaryLabel(row: { office_name?: string | null; name?: string | null }): string {
  return String(row.office_name || row.name || 'Notaris/PPAT')
}
