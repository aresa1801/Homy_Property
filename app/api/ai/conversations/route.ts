import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    .select('id,property_id,user_id,user_email,mode,question,answer,sources,created_at,properties(title,city,district,listing_type)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (propertyId) query = query.eq('property_id', propertyId)

  const { data, error } = await query
  if (error) {
    console.error('[homy-ai] gagal memuat rekaman percakapan:', error.message)
    return NextResponse.json({ error: 'Gagal memuat rekaman percakapan.' }, { status: 502 })
  }

  const rows = (data ?? []).map((row) => {
    const property = Array.isArray((row as { properties?: unknown }).properties)
      ? ((row as { properties: { title?: string; city?: string; district?: string; listing_type?: string }[] }).properties[0] ?? null)
      : ((row as { properties?: { title?: string; city?: string; district?: string; listing_type?: string } }).properties ?? null)
    return {
      id: row.id,
      propertyId: row.property_id,
      propertyTitle: property?.title ?? null,
      propertyCity: property?.city ?? null,
      propertyDistrict: property?.district ?? null,
      listingType: property?.listing_type ?? null,
      userEmail: row.user_email ?? null,
      isMine: row.user_id === user.id,
      mode: row.mode,
      question: row.question,
      answer: row.answer,
      sources: row.sources ?? [],
      createdAt: row.created_at,
    }
  })

  return NextResponse.json({ ok: true, count: rows.length, conversations: rows })
}
