import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/visits'

export const runtime = 'nodejs'

/**
 * GET /api/ai/conversations — rekaman percakapan antara pengguna dan Homy AI.
 *
 * Filter otomatis lewat RLS:
 *  - pengguna melihat percakapannya sendiri
 *  - agen/pemilik melihat percakapan tentang listing miliknya
 *
 * Query: ?propertyId=<uuid> (opsional) &limit=<1..100>
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Masuk dulu untuk melihat rekaman percakapan.', needsAuth: true }, { status: 401 })

  const url = new URL(request.url)
  const propertyId = (url.searchParams.get('propertyId') ?? '').trim()
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 60, 1), 100)

  let query = supabase
    .from('ai_conversations')
    .select('id,property_id,user_id,user_email,mode,question,answer,sources,created_at,properties(title,city,district,listing_type,property_media(storage_path,media_type,sort_order))')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (propertyId) query = query.eq('property_id', propertyId)

  const { data, error } = await query
  if (error) {
    console.error('[homy-ai] gagal memuat rekaman percakapan:', error.message)
    return NextResponse.json({ error: 'Gagal memuat rekaman percakapan.' }, { status: 502 })
  }

  type PropertyEmbed = {
    title?: string
    city?: string
    district?: string
    listing_type?: string
    property_media?: { storage_path: string; media_type?: string | null; sort_order?: number | null }[] | null
  }

  const rows = (data ?? []).map((row) => {
    const embedded = (row as { properties?: unknown }).properties
    const property = (Array.isArray(embedded) ? (embedded[0] ?? null) : (embedded ?? null)) as PropertyEmbed | null
    return {
      id: row.id,
      propertyId: row.property_id,
      propertyTitle: property?.title ?? null,
      propertyCity: property?.city ?? null,
      propertyDistrict: property?.district ?? null,
      listingType: property?.listing_type ?? null,
      propertyMedia: property?.property_media ?? [],
      userEmail: row.user_email ?? null,
      isMine: row.user_id === user.id,
      mode: row.mode,
      question: row.question,
      answer: row.answer,
      sources: row.sources ?? [],
      createdAt: row.created_at,
    }
  })

  // Beberapa properti (mis. listing yang sedang draf/diarsipkan) tidak terbaca lewat
  // RLS pengguna, padahal percakapannya tetap milik pengguna ini. Ambil metadata
  // propertinya lewat service client HANYA untuk id yang benar-benar muncul di baris
  // yang sudah lolos otorisasi, supaya utas di halaman Pesan tetap punya judul jelas.
  const missingIds = Array.from(new Set(rows.filter((row) => row.propertyId && !row.propertyTitle).map((row) => row.propertyId as string)))
  if (missingIds.length) {
    try {
      const admin = serviceClient()
      if (admin) {
        const { data: properties } = await admin
          .from('properties')
          .select('id,title,city,district,listing_type,property_media(storage_path,media_type,sort_order)')
          .in('id', missingIds)
        const lookup = new Map<string, PropertyEmbed>()
        for (const item of (properties ?? []) as (PropertyEmbed & { id: string })[]) lookup.set(item.id, item)
        for (const row of rows) {
          if (!row.propertyId || row.propertyTitle) continue
          const property = lookup.get(row.propertyId)
          if (!property) continue
          row.propertyTitle = property.title ?? null
          row.propertyCity = property.city ?? null
          row.propertyDistrict = property.district ?? null
          row.listingType = property.listing_type ?? null
          row.propertyMedia = property.property_media ?? []
        }
      }
    } catch (lookupError) {
      console.error('[homy-ai] gagal melengkapi data properti rekaman:', lookupError instanceof Error ? lookupError.message : lookupError)
    }
  }

  return NextResponse.json({ ok: true, count: rows.length, conversations: rows })
}
