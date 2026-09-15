import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendListingStatusEmail, type ListingStatus } from '@/lib/email'
import { notifyListingMatch, notifyUser } from '@/lib/notifications'

const ADMIN_ROLES = ['admin', 'super_admin']

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = Array.isArray(roles) ? roles.map((r: { role: string }) => r.role) : []
  if (!list.some((r) => ADMIN_ROLES.includes(r))) {
    return { error: NextResponse.json({ error: 'Admin role required' }, { status: 403 }) }
  }
  return { user }
}

// GET — moderation queue (pending first, then recently moderated).
export async function GET() {
  const gate = await requireAdmin()
  if (gate.error) return gate.error
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  const { data, error } = await admin
    .from('properties')
    .select('id,title,city,province,district,listing_type,property_type,status,price,price_period,owner_id,created_at,moderation_note,moderated_at,ai_summary,property_media(storage_path,media_type,sort_order)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: 'Unable to load moderation queue' }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST — approve (publish) or reject a listing.
export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (gate.error) return gate.error
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  let body: { id?: string; action?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const id = String(body.id ?? '')
  const action = String(body.action ?? '')
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
  if (!id || !['approve', 'reject', 'pending'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: before } = await admin
    .from('properties')
    .select('id,title,status,owner_id')
    .eq('id', id)
    .maybeSingle()
  if (!before) return NextResponse.json({ error: 'Listing tidak ditemukan' }, { status: 404 })

  const now = new Date().toISOString()
  const status = action === 'approve' ? 'published' : action === 'reject' ? 'rejected' : 'pending'
  const patch: Record<string, unknown> = {
    status,
    moderation_note: note || null,
    moderated_at: now,
    moderated_by: gate.user!.id,
  }
  if (status === 'published') patch.verified_at = now

  const { data, error } = await admin
    .from('properties')
    .update(patch)
    .eq('id', id)
    .select('id,title,status,moderation_note,moderated_at,owner_id')
    .single()
  if (error) return NextResponse.json({ error: 'Unable to update listing' }, { status: 400 })

  await admin.from('audit_logs').insert({
    actor_id: gate.user!.id,
    action: `listing.${status}`,
    entity_type: 'property',
    entity_id: id,
    metadata: { note: note || null, previous_status: before.status ?? null },
  })

  // Notifikasi email ke pemilik listing (approve/reject only).
  let email: { ok: boolean; skipped?: boolean; error?: string } | null = null
  if (status === 'published' || status === 'rejected') {
    const ownerId = String(before.owner_id ?? data?.owner_id ?? '')
    if (ownerId) {
      const { data: ownerData } = await admin.auth.admin.getUserById(ownerId)
      const owner = ownerData?.user
      const to = (owner?.email ?? '').trim()
      if (to) {
        const ownerName = String((owner?.user_metadata as Record<string, unknown> | undefined)?.full_name ?? '')
        email = await sendListingStatusEmail({ to, title: String(data?.title ?? before.title ?? ''), status: status as ListingStatus, note, ownerName, listingId: id })
      }
    }
  }

  // Notifikasi in-app ke pemilik listing (ikon lonceng) + pencocokan pencarian tersimpan.
  if (status === 'published' || status === 'rejected') {
    const ownerId = String(before.owner_id ?? data?.owner_id ?? '')
    const title = String(data?.title ?? before.title ?? 'Listing Anda')
    if (ownerId) {
      await notifyUser({
        userId: ownerId,
        kind: status === 'published' ? 'listing.approved' : 'listing.rejected',
        title: status === 'published' ? 'Listing Anda sudah tayang' : 'Listing Anda perlu diperbaiki',
        body: status === 'published'
          ? '"' + title + '" sudah tayang dan bisa dilihat calon pembeli.'
          : '"' + title + '" belum disetujui.' + (note ? ' Catatan moderator: ' + note : ''),
        href: status === 'published' ? '/dashboard/property-owner/properties' : '/dashboard/property-owner/list',
        data: { property_id: id, status },
      })
    }
    if (status === 'published') {
      const { data: full } = await admin
        .from('properties')
        .select('id,title,listing_type,city,district,price,bedrooms,ai_summary,owner_id')
        .eq('id', id)
        .maybeSingle()
      if (full) {
        await notifyListingMatch({
          id: String(full.id),
          title: full.title as string | null,
          listingType: full.listing_type as string | null,
          city: full.city as string | null,
          district: full.district as string | null,
          price: full.price as number | string | null,
          bedrooms: (full.bedrooms as number | null) ?? null,
          summary: full.ai_summary as string | null,
          ownerId: String(full.owner_id ?? ownerId),
        })
      }
    }
  }

  return NextResponse.json({ data, email: email ?? { ok: false, skipped: true, reason: 'no recipient' } })
}
