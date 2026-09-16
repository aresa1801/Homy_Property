import { NextResponse } from 'next/server'
import { mapEmbedUrl, parseMapPoint, resolveMapPoint } from '@/lib/homy-maps'

export const runtime = 'nodejs'

/**
 * GET /api/maps/resolve?url=<link google maps>
 *
 * Mengubah link share Google Maps (termasuk tautan pendek maps.app.goo.gl)
 * menjadi koordinat titik temu + URL embed. Dipakai halaman edit listing
 * supaya agen/pemilik langsung melihat pratinjau peta saat menempel link.
 */
export async function GET(request: Request) {
  const raw = (new URL(request.url).searchParams.get('url') ?? '').trim()
  if (!raw) return NextResponse.json({ error: 'Parameter url wajib diisi.' }, { status: 400 })
  if (raw.length > 1200) return NextResponse.json({ error: 'Link terlalu panjang.' }, { status: 400 })

  const point = parseMapPoint(raw) ?? (await resolveMapPoint(raw))
  if (!point) {
    return NextResponse.json({
      ok: false,
      error: 'Koordinat tidak ditemukan pada link itu. Pakai link titik/tempat dari Google Maps, atau isi latitude & longitude manual.',
    }, { status: 422 })
  }
  return NextResponse.json({ ok: true, point, embed: mapEmbedUrl(point.lat, point.lng) })
}
