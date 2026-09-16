import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'property-media'

async function ownedProperty(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, ok: false as const, status: 401, error: 'Masuk dulu untuk mengubah foto listing.' }
  const { data: property } = await supabase.from('properties').select('id,owner_id').eq('id', id).maybeSingle()
  if (!property) return { supabase, user, ok: false as const, status: 404, error: 'Listing tidak ditemukan.' }
  if (property.owner_id !== user.id) return { supabase, user, ok: false as const, status: 403, error: 'Listing ini bukan milik Anda.' }
  return { supabase, user, ok: true as const, status: 200, error: null }
}

/** POST /api/listings/[id]/photos — daftarkan foto yang sudah diunggah ke storage bucket. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await ownedProperty(id)
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

  let body: { photos?: { storagePath?: string; mediaType?: string; sortOrder?: number }[] } = {}
  try { body = (await request.json()) as typeof body } catch { /* kosong */ }
  const photos = (body.photos ?? []).filter((item) => item?.storagePath).slice(0, 20)
  if (!photos.length) return NextResponse.json({ error: 'Tidak ada foto untuk disimpan.' }, { status: 400 })

  const rows = photos.map((photo, index) => ({
    property_id: id,
    storage_path: String(photo.storagePath),
    media_type: photo.mediaType === 'video' ? 'video' : 'image',
    sort_order: Number.isFinite(Number(photo.sortOrder)) ? Number(photo.sortOrder) : index,
  }))

  const { data, error } = await owner.supabase
    .from('property_media')
    .insert(rows)
    .select('id,storage_path,media_type,sort_order')
  if (error) {
    console.error('[homy-listings] gagal simpan foto:', error.message)
    return NextResponse.json({ error: 'Gagal menyimpan foto listing.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, photos: data ?? [] })
}

/** DELETE /api/listings/[id]/photos?mediaId=<uuid> — hapus foto (baris + objek storage). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await ownedProperty(id)
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

  const mediaId = (new URL(request.url).searchParams.get('mediaId') ?? '').trim()
  if (!mediaId) return NextResponse.json({ error: 'mediaId wajib diisi.' }, { status: 400 })

  const { data: media } = await owner.supabase
    .from('property_media')
    .select('id,storage_path')
    .eq('id', mediaId)
    .eq('property_id', id)
    .maybeSingle()
  if (!media) return NextResponse.json({ error: 'Foto tidak ditemukan.' }, { status: 404 })

  const { error } = await owner.supabase.from('property_media').delete().eq('id', mediaId).eq('property_id', id)
  if (error) {
    console.error('[homy-listings] gagal hapus foto:', error.message)
    return NextResponse.json({ error: 'Gagal menghapus foto.' }, { status: 502 })
  }

  const path = String(media.storage_path ?? '')
  if (path && !/^https?:\/\//i.test(path)) {
    await owner.supabase.storage.from(BUCKET).remove([path]).then(() => undefined, () => undefined)
  }
  return NextResponse.json({ ok: true, removed: mediaId })
}
