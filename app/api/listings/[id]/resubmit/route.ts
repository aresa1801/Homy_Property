import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendListingStatusEmail } from '@/lib/email'

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** POST /api/listings/[id]/resubmit — pemilik mengajukan ulang listing yang ditolak. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  // RLS: pemilik bisa membaca listingnya sendiri walau belum published.
  const { data: listing } = await supabase
    .from('properties')
    .select('id,title,status,owner_id')
    .eq('id', id)
    .maybeSingle()

  if (!listing) return NextResponse.json({ error: 'Listing tidak ditemukan' }, { status: 404 })
  if (listing.owner_id !== user.id) return NextResponse.json({ error: 'Hanya pemilik listing yang bisa mengajukan ulang' }, { status: 403 })
  if (listing.status !== 'rejected' && listing.status !== 'draft') {
    return NextResponse.json({ error: 'Hanya listing yang ditolak yang bisa diajukan ulang' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('properties')
    .update({ status: 'pending', moderation_note: null, moderated_at: null, moderated_by: null })
    .eq('id', id)
    .select('id,title,status')
    .single()

  if (error) return NextResponse.json({ error: 'Gagal mengajukan ulang listing' }, { status: 400 })

  const admin = serviceClient()
  if (admin) {
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'listing.resubmitted',
      entity_type: 'property',
      entity_id: id,
      metadata: { previous_status: listing.status },
    })
    const email = (user.email ?? '').trim()
    if (email) {
      const ownerName = String((user.user_metadata as Record<string, unknown> | undefined)?.full_name ?? '')
      const mail = await sendListingStatusEmail({ to: email, title: String(data?.title ?? listing.title ?? ''), status: 'pending', reason: 'resubmitted', ownerName, listingId: id })
      if (!mail.ok && !mail.skipped) console.warn('[homy] resubmit email gagal', mail)
    }
  }

  return NextResponse.json({ data })
}
