import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { alertFingerprint, alertLabel, notifyUser } from '@/lib/notifications'

export const runtime = 'nodejs'

function clean(value: unknown, max = 80): string | null {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, max) : null
}

function price(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Daftar pencarian tersimpan milik pengguna (dipakai panel lonceng + halaman jual/sewa). */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: [], authenticated: false })
  const { data, error } = await supabase.from('listing_alerts').select('id,label,listing_type,city,district,min_price,max_price,min_bedrooms,keywords,active,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
  if (error) return NextResponse.json({ error: 'Unable to load alerts' }, { status: 500 })
  return NextResponse.json({ data, authenticated: true })
}

/** Simpan kriteria pencarian ("beri tahu saya kalau ada properti seperti ini"). */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required', needsAuth: true }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { /* kosong */ }

  const listingTypeRaw = clean(body.listingType, 10)
  const listingType = listingTypeRaw === 'sale' || listingTypeRaw === 'rent' ? listingTypeRaw : null
  const city = clean(body.city, 80)
  const district = clean(body.district, 80)
  const minPrice = price(body.minPrice)
  const maxPrice = price(body.maxPrice)
  const bedroomsRaw = Number(body.minBedrooms)
  const minBedrooms = Number.isFinite(bedroomsRaw) && bedroomsRaw > 0 ? Math.round(bedroomsRaw) : null
  const keywords = clean(body.keywords, 60)

  if (!listingType && !city && !district && minPrice == null && maxPrice == null && minBedrooms == null && !keywords) {
    return NextResponse.json({ error: 'Isi minimal satu kriteria pencarian.' }, { status: 400 })
  }

  const fingerprint = alertFingerprint({ listingType, city, district, minPrice, maxPrice, minBedrooms, keywords })
  const label = alertLabel({ listingType, city, district, minPrice, maxPrice, minBedrooms, keywords })

  const { data, error } = await supabase
    .from('listing_alerts')
    .upsert({
      user_id: user.id,
      label,
      listing_type: listingType,
      city,
      district,
      min_price: minPrice,
      max_price: maxPrice,
      min_bedrooms: minBedrooms,
      keywords,
      fingerprint,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,fingerprint' })
    .select('id,label,active')
    .single()
  if (error) return NextResponse.json({ error: 'Gagal menyimpan pencarian' }, { status: 400 })

  await notifyUser({
    userId: user.id,
    kind: 'alert.saved',
    title: 'Pencarian disimpan',
    body: 'Kami akan memberi tahu Anda lewat lonceng begitu ada properti baru: ' + label,
    href: listingType === 'rent' ? '/rent' : '/buy',
    data: { alert_id: data?.id ?? null },
  })

  return NextResponse.json({ ok: true, data })
}

/** Hapus pencarian tersimpan. */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID wajib' }, { status: 400 })
  const { error } = await supabase.from('listing_alerts').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Gagal menghapus pencarian' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
