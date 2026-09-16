/**
 * Homy — util peta & titik temu.
 *
 * Agen/pemilik bisa menempelkan link Google Maps (share link) dan sistem mengambil
 * koordinatnya. Dipakai untuk: peta listing, titik temu saat kunjungan, dan
 * pratinjau embed tanpa perlu Google Maps API key.
 */

export type MapPoint = { lat: number; lng: number }

const PATTERNS: RegExp[] = [
  /@(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/, // .../@-7.7956,110.3695,17z
  /[?&](?:q|query|ll|center|destination)=(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i,
  /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/, // data blob di URL maps
  /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/, // "lat, lng" polos
]

/** Ambil koordinat dari link Google Maps / teks "lat, lng". Null kalau tidak ketemu. */
export function parseMapPoint(input?: string | null): MapPoint | null {
  const text = String(input ?? '').trim()
  if (!text) return null
  for (const pattern of PATTERNS) {
    const match = text.match(pattern)
    if (!match) continue
    const lat = Number(match[1])
    const lng = Number(match[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
  }
  return null
}

export function validPoint(lat?: number | string | null, lng?: number | string | null): MapPoint | null {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null
  if (la === 0 && ln === 0) return null
  return { lat: la, lng: ln }
}

/** URL embed Google Maps (tanpa API key) untuk iframe pratinjau/peta listing. */
export function mapEmbedUrl(lat?: number | string | null, lng?: number | string | null, zoom = 16): string | null {
  const point = validPoint(lat, lng)
  if (!point) return null
  return `https://www.google.com/maps?q=${point.lat},${point.lng}&z=${zoom}&output=embed`
}

/** Link "buka di Google Maps" untuk pengguna. */
export function mapOpenUrl(lat?: number | string | null, lng?: number | string | null): string | null {
  const point = validPoint(lat, lng)
  if (!point) return null
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`
}

/** Apakah link yang ditempel terlihat seperti tautan Google Maps yang sah. */
export function looksLikeMapLink(value?: string | null): boolean {
  return /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\./i.test(String(value ?? ''))
}
