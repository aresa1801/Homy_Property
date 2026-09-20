/**
 * Homy — utilitas penandatanganan elektronik (server-side).
 *
 * Menghasilkan nomor serial tanda tangan yang deterministik dan sidik jari
 * dokumen (SHA-256) sebagai bukti keaslian, seperti pada model DocuSign.
 * Modul ini memakai `node:crypto` sehingga HANYA boleh diimpor dari route
 * server (runtime nodejs), bukan dari komponen klien.
 */

import { createHash } from 'node:crypto'

export const JAKARTA_OFFSET = '+07:00'

const ROLE_CODE: Record<string, string> = {
  agent: 'AGN',
  property_owner: 'OWN',
}

function jakartaParts(iso: string) {
  const date = new Date(iso)
  const safe = Number.isNaN(date.getTime()) ? new Date() : date
  const shifted = new Date(safe.getTime() + 7 * 60 * 60 * 1000)
  return {
    date: safe,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  }
}

const pad = (value: number, size = 2) => String(value).padStart(size, '0')

/** Tanggal-tanpa-jam versi WIB: 20260920 */
function stampCompact(iso: string) {
  const parts = jakartaParts(iso)
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}`
}

/**
 * Serial tanda tangan, mis. `SIG/AGN/20260920/7F3A2C`.
 * Deterministik: mitra yang sama + waktu tanda tangan yang sama menghasilkan serial sama.
 */
export function signatureSerial(role: string, userId: string, signedAt: string) {
  const code = ROLE_CODE[role] ?? 'MTR'
  const digest = createHash('sha256').update(`${role}|${userId}|${signedAt}`).digest('hex').slice(0, 6).toUpperCase()
  return `SIG/${code}/${stampCompact(signedAt)}/${digest}`
}

/** ID tanda tangan ringkas, mis. `ES-V2-9F2C41`. */
export function signatureId(role: string, userId: string, signedAt: string, version: string) {
  const digest = createHash('sha256').update(`${version}|${role}|${userId}|${signedAt}|sig`).digest('hex').slice(0, 6).toUpperCase()
  return `ES-${String(version).replace(/^v/i, '')}-${digest}`
}

/** Sidik jari dokumen SHA-256 (64 hex uppercase) dari data inti perjanjian. */
export function agreementFingerprint(input: {
  role: string
  userId: string
  version: string
  signedAt: string
  fullName: string
  identityNumber?: string | null
  serial?: string | null
}) {
  const payload = [
    'HOMY-PERJANJIAN-KERJA-SAMA',
    `role=${input.role}`,
    `user=${input.userId}`,
    `version=${input.version}`,
    `signed_at=${input.signedAt}`,
    `name=${String(input.fullName ?? '').trim()}`,
    `identity=${String(input.identityNumber ?? '-').trim()}`,
    `serial=${input.serial ?? signatureSerial(input.role, input.userId, input.signedAt)}`,
  ].join('|')
  return createHash('sha256').update(payload).digest('hex').toUpperCase()
}

/** Pisahkan sidik jari menjadi grup 8 karakter agar mudah dibaca di PDF. */
export function fingerprintGroups(value: string, groupSize = 8) {
  const clean = String(value ?? '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase()
  const groups: string[] = []
  for (let index = 0; index < clean.length; index += groupSize) groups.push(clean.slice(index, index + groupSize))
  return groups.join(' ')
}

/** Timestamp tanda tangan lengkap versi WIB: `20 September 2026, 09.35.12 WIB (GMT+7)`. */
export function formatSignatureTimestamp(iso: string, withSeconds = true) {
  const parts = jakartaParts(iso)
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  const date = `${parts.day} ${monthNames[parts.month - 1] ?? ''} ${parts.year}`.trim()
  const time = withSeconds
    ? `${pad(parts.hour)}.${pad(parts.minute)}.${pad(parts.second)}`
    : `${pad(parts.hour)}.${pad(parts.minute)}`
  return `${date}, ${time} WIB (GMT+7)`
}

/** Timestamp ringkas untuk kotak tanda tangan: `20/09/2026 09.35 WIB`. */
export function formatSignatureStampShort(iso: string) {
  const parts = jakartaParts(iso)
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year} ${pad(parts.hour)}.${pad(parts.minute)} WIB`
}

/** Rangkum user agent supaya cukup ditampilkan di sertifikat. */
export function summarizeUserAgent(value?: string | null) {
  const text = String(value ?? '').trim()
  if (!text) return '-'
  return text.length > 96 ? `${text.slice(0, 93)}...` : text
}
