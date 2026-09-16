/**
 * Homy — util peta & titik temu.
 *
 * Agen/pemilik bisa menempelkan link Google Maps (share link) dan sistem mengambil
 * koordinatnya. Dipakai untuk: peta listing, titik temu saat kunjungan, dan
 * pratinjau embed tanpa perlu Google Maps API key.
 */

export type MapPoint = { lat: number; lng: number }

const PATTERNS: RegExp[] = [
  /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/, // data blob di URL maps (paling presisi)
  /@(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/, // .../@-7.7956,110.3695,17z
  /[?&](?:q|query|ll|center|destination|daddr)=(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i,
  /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/, // "lat, lng" polos
]

const SHORT_LINK = /(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+)/i

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

/**
 * Link share Google Maps dari aplikasi HP sering berupa tautan pendek
 * (mis. https://maps.app.goo.gl/xxxx) yang TIDAK memuat koordinat.
 * Fungsi ini mengikuti redirect-nya di server lalu mengambil koordinat.
 * Tidak pernah melempar error — kembalikan null kalau gagal.
 */
export async function resolveMapPoint(input?: string | null): Promise<MapPoint | null> {
  const text = String(input ?? '').trim()
  if (!text) return null
  const direct = parseMapPoint(text)
  if (direct) return direct
  if (!SHORT_LINK.test(text)) return null
  const url = /^https?:\/\//i.test(text) ? text : `https://${text}`

  async function follow(target: string, method: 'HEAD' | 'GET'): Promise<MapPoint | null> {
    try {
      const response = await fetch(target, {
        method,
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HomyBot/1.0)' },
      })
      const found = parseMapPoint(response.url)
      if (found) return found
      if (method === 'GET') {
        const body = (await response.text()).slice(0, 400_000)
        const fromBody = parseMapPoint(body)
        if (fromBody) return fromBody
        const embedded = body.match(/https:\/\/www\.google\.[a-z.]+\/maps[^"'<>\\ ]{0,400}/i)
        if (embedded) {
          const deeper = parseMapPoint(decodeURIComponent(embedded[0].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&')))
          if (deeper) return deeper
        }
      }
    } catch { /* diabaikan */ }
    return null
  }

  const viaHead = await follow(url, 'HEAD')
  if (viaHead) return viaHead
  return follow(url, 'GET')
}
