/**
 * Homy — notifikasi in-app (ikon lonceng di headbar).
 * Semua penulisan notifikasi lewat service-role (server-side), pembacaan lewat RLS user sendiri.
 * Tidak pernah melempar error: kalau gagal, cukup dicatat di log supaya alur utama aman.
 */
import { serviceClient } from '@/lib/visits'

export type NotificationKind =
  | 'inquiry.new' | 'inquiry.reply' | 'visit.new' | 'visit.confirmed' | 'visit.cancelled' | 'visit.completed'
  | 'listing.approved' | 'listing.rejected' | 'listing.match' | 'alert.saved' | 'system'

export type NotificationInput = {
  userId: string
  kind: NotificationKind
  title: string
  body?: string | null
  href?: string | null
  data?: Record<string, unknown>
}

/** Simpan satu/lebih notifikasi. Return jumlah baris yang berhasil ditulis. */
export async function pushNotifications(rows: NotificationInput[]): Promise<number> {
  const clean = rows.filter((row) => row && row.userId && row.title).map((row) => ({
    user_id: row.userId,
    kind: row.kind,
    title: String(row.title).slice(0, 180),
    body: row.body ? String(row.body).slice(0, 600) : null,
    href: row.href ? String(row.href).slice(0, 400) : null,
    data: row.data ?? {},
  }))
  if (!clean.length) return 0
  try {
    const admin = serviceClient()
    if (!admin) return 0
    const { error, count } = await admin.from('notifications').insert(clean, { count: 'exact' })
    if (error) {
      console.error('[homy-notify] insert gagal:', error.message)
      return 0
    }
    return count ?? clean.length
  } catch (error) {
    console.error('[homy-notify] error:', error instanceof Error ? error.message : error)
    return 0
  }
}

export async function notifyUser(row: NotificationInput): Promise<number> {
  return pushNotifications([row])
}

/** Normalisasi + fingerprint filter pencarian supaya satu kombinasi hanya tersimpan sekali. */
export function alertFingerprint(filters: { listingType?: string | null; city?: string | null; district?: string | null; minPrice?: number | null; maxPrice?: number | null; minBedrooms?: number | null; keywords?: string | null }): string {
  const part = [
    (filters.listingType || '').toLowerCase().trim(),
    (filters.city || '').toLowerCase().trim(),
    (filters.district || '').toLowerCase().trim(),
    filters.minPrice != null ? String(Math.round(filters.minPrice)) : '',
    filters.maxPrice != null ? String(Math.round(filters.maxPrice)) : '',
    filters.minBedrooms != null ? String(filters.minBedrooms) : '',
    (filters.keywords || '').toLowerCase().trim().slice(0, 60),
  ].join('|')
  return part.replace(/^\|+|\|+$/g, '')
}

export function alertLabel(filters: { listingType?: string | null; city?: string | null; district?: string | null; minPrice?: number | null; maxPrice?: number | null; minBedrooms?: number | null; keywords?: string | null }): string {
  const bits: string[] = []
  bits.push(filters.listingType === 'rent' ? 'Sewa' : filters.listingType === 'sale' ? 'Jual' : 'Jual & Sewa')
  const area = [filters.district, filters.city].filter(Boolean).join(', ')
  if (area) bits.push(area)
  if (filters.maxPrice != null) bits.push('maks Rp ' + Number(filters.maxPrice).toLocaleString('id-ID'))
  if (filters.minBedrooms != null) bits.push(filters.minBedrooms + '+ KT')
  if (filters.keywords) bits.push('"' + String(filters.keywords).slice(0, 40) + '"')
  return bits.join(' · ')
}

type AlertRow = {
  user_id: string
  listing_type: string | null
  city: string | null
  district: string | null
  min_price: number | string | null
  max_price: number | string | null
  min_bedrooms: number | null
  keywords: string | null
}

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Cocokkan satu listing yang baru tayang dengan pencarian tersimpan pengguna → kirim notifikasi. */
export async function notifyListingMatch(listing: {
  id: string
  title?: string | null
  listingType?: string | null
  city?: string | null
  district?: string | null
  price?: number | string | null
  bedrooms?: number | null
  summary?: string | null
  ownerId?: string | null
}): Promise<number> {
  try {
    const admin = serviceClient()
    if (!admin) return 0
    const { data } = await admin.from('listing_alerts').select('user_id,listing_type,city,district,min_price,max_price,min_bedrooms,keywords').eq('active', true).limit(500)
    const alerts = (data ?? []) as AlertRow[]
    if (!alerts.length) return 0

    const price = num(listing.price)
    const haystack = [listing.title, listing.city, listing.district, listing.summary].filter(Boolean).join(' ').toLowerCase()
    const matches = alerts.filter((alert) => {
      if (alert.user_id === listing.ownerId) return false
      if (alert.listing_type && listing.listingType && alert.listing_type !== listing.listingType) return false
      if (alert.city && (listing.city || '').toLowerCase() !== alert.city.toLowerCase()) return false
      if (alert.district && (listing.district || '').toLowerCase() !== alert.district.toLowerCase()) return false
      const min = num(alert.min_price); const max = num(alert.max_price)
      if (price != null && min != null && price < min) return false
      if (price != null && max != null && price > max) return false
      if (alert.min_bedrooms != null && (listing.bedrooms ?? 0) < alert.min_bedrooms) return false
      if (alert.keywords) {
        const tokens = alert.keywords.toLowerCase().split(/[,\s]+/).filter((token) => token.length >= 3)
        if (tokens.length && !tokens.some((token) => haystack.includes(token))) return false
      }
      return true
    })
    const seen = new Set<string>()
    const rows: NotificationInput[] = []
    for (const alert of matches) {
      if (seen.has(alert.user_id)) continue
      seen.add(alert.user_id)
      rows.push({
        userId: alert.user_id,
        kind: 'listing.match',
        title: 'Properti baru sesuai pencarian Anda',
        body: String(listing.title ?? 'Listing baru') + (listing.city ? ' · ' + listing.city : ''),
        href: '/property/' + listing.id,
        data: { property_id: listing.id },
      })
    }
    return pushNotifications(rows)
  } catch (error) {
    console.error('[homy-notify] match gagal:', error instanceof Error ? error.message : error)
    return 0
  }
}
