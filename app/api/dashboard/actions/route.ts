import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notifyUser, type NotificationKind } from '@/lib/notifications'

type Payload = {
  kind?: string
  id?: string
  status?: string
  reply?: string
  notes?: string
  scheduledAt?: string
  propertyId?: string
  propertyTitle?: string
  buyerName?: string
  buyerContact?: string
  salePrice?: number | string
  soldAt?: string
  role?: string
}

const INQUIRY_STAGES = ['open', 'contacted', 'viewing', 'negotiation', 'closed']
const VISIT_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled']

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Aksi dashboard Agent/Owner: balas inquiry, kelola kunjungan, lapor transaksi. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let body: Payload
  try {
    body = (await request.json()) as Payload
  } catch {
    return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 })
  }

  const kind = String(body.kind ?? '')

  if (kind === 'inquiry.update') {
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'ID inquiry wajib' }, { status: 400 })
    const patch: Record<string, unknown> = {}
    if (body.status && INQUIRY_STAGES.includes(body.status)) patch.status = body.status
    if (typeof body.reply === 'string' && body.reply.trim()) {
      patch.reply_message = body.reply.trim()
      patch.replied_at = new Date().toISOString()
      if (!patch.status) patch.status = 'contacted'
    }
    if (typeof body.notes === 'string') patch.follow_up_note = body.notes.trim() || null
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })
    const { data: inquiryBefore } = await supabase.from('inquiries').select('id,user_id,property_id').eq('id', id).maybeSingle()
    const { data, error } = await supabase.from('inquiries').update(patch).eq('id', id).select('id,status,reply_message,replied_at,follow_up_note').single()
    if (error) return NextResponse.json({ error: 'Gagal memperbarui prospek' }, { status: 403 })
    try {
      const askedBy = String(inquiryBefore?.user_id ?? '')
      if (askedBy && askedBy !== user.id) {
        const { data: property } = await supabase.from('properties').select('title').eq('id', String(inquiryBefore?.property_id ?? '')).maybeSingle()
        const repliedText = typeof patch.reply_message === 'string' ? String(patch.reply_message) : ''
        await notifyUser({
          userId: askedBy,
          kind: 'inquiry.reply',
          title: 'Balasan untuk pertanyaan Anda',
          body: (repliedText || 'Agen/pemilik memperbarui status pertanyaan Anda.') + (property?.title ? ' — ' + String(property.title) : ''),
          href: inquiryBefore?.property_id ? '/property/' + String(inquiryBefore.property_id) : '/dashboard/user',
          data: { inquiry_id: id, property_id: inquiryBefore?.property_id ?? null },
        })
      }
    } catch (err) {
      console.error('[homy-actions] notifikasi balasan gagal:', err instanceof Error ? err.message : err)
    }
    return NextResponse.json({ data })
  }

  if (kind === 'visit.update') {
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'ID kunjungan wajib' }, { status: 400 })
    const patch: Record<string, unknown> = {}
    if (body.status && VISIT_STATUSES.includes(body.status)) patch.status = body.status
    if (typeof body.notes === 'string') patch.notes = body.notes.trim() || null
    if (typeof body.scheduledAt === 'string' && body.scheduledAt) patch.scheduled_at = body.scheduledAt
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })
    const { data: visitBefore } = await supabase.from('visits').select('id,user_id,agent_id,property_id,scheduled_at,status').eq('id', id).maybeSingle()
    const { data, error } = await supabase.from('visits').update(patch).eq('id', id).select('id,status,notes,scheduled_at').single()
    if (error) return NextResponse.json({ error: 'Gagal memperbarui jadwal' }, { status: 403 })
    try {
      const nextStatus = String(patch.status ?? '')
      const KIND: Record<string, NotificationKind> = { requested: 'visit.new', confirmed: 'visit.confirmed', cancelled: 'visit.cancelled', completed: 'visit.completed' }
      const KIND_LABEL: Record<string, string> = { requested: 'diminta ulang', confirmed: 'dikonfirmasi', cancelled: 'dibatalkan', completed: 'selesai' }
      const notifyUserId = visitBefore ? (visitBefore.user_id === user.id ? String(visitBefore.agent_id ?? '') : String(visitBefore.user_id ?? '')) : ''
      if (nextStatus && KIND[nextStatus] && notifyUserId) {
        const { data: property } = await supabase.from('properties').select('title').eq('id', String(visitBefore?.property_id ?? '')).maybeSingle()
        const when = new Date(String(data?.scheduled_at ?? visitBefore?.scheduled_at ?? '')).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
        const isVisitorNotified = visitBefore?.user_id !== user.id
        await notifyUser({
          userId: notifyUserId,
          kind: KIND[nextStatus],
          title: 'Jadwal kunjungan ' + KIND_LABEL[nextStatus],
          body: (property?.title ? String(property.title) + ' — ' : '') + when + ' WIB',
          href: isVisitorNotified ? '/dashboard/user' : '/dashboard/property-owner/calendar',
          data: { visit_id: id, property_id: visitBefore?.property_id ?? null, status: nextStatus },
        })
      }
    } catch (err) {
      console.error('[homy-actions] notifikasi jadwal gagal:', err instanceof Error ? err.message : err)
    }
    return NextResponse.json({ data })
  }

  if (kind === 'availability.save') {
    const days = Array.isArray((body as { days?: unknown }).days) ? ((body as { days?: unknown }).days as Array<Record<string, unknown>>) : []
    if (!days.length) return NextResponse.json({ error: 'Tidak ada jadwal yang dikirim' }, { status: 400 })
    const MODES = ['onsite', 'online', 'both']
    const SLOTS = [30, 45, 60, 90, 120]
    const nowIso = new Date().toISOString()
    const rows = days.map((day) => {
      const weekday = Number(day.weekday)
      const slot = Number(day.slot_minutes ?? 60)
      const mode = String(day.mode ?? 'both')
      const toTime = (value: unknown, fallback: string) => {
        const text = String(value ?? '')
        return /^[0-2][0-9]:[0-5][0-9]/.test(text) ? text.slice(0, 5) : fallback
      }
      return {
        user_id: user.id,
        weekday: Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : 0,
        is_active: day.is_active !== false,
        start_time: toTime(day.start_time, '09:00'),
        end_time: toTime(day.end_time, '17:00'),
        slot_minutes: SLOTS.includes(slot) ? slot : 60,
        mode: MODES.includes(mode) ? mode : 'both',
        location: typeof day.location === 'string' && day.location.trim() ? day.location.trim().slice(0, 200) : null,
        notes: typeof day.notes === 'string' && day.notes.trim() ? day.notes.trim().slice(0, 500) : null,
        updated_at: nowIso,
      }
    })
    const unique = new Map<number, Record<string, unknown>>()
    for (const row of rows) unique.set(Number(row.weekday), row)
    const { data, error } = await supabase
      .from('partner_availability')
      .upsert(Array.from(unique.values()), { onConflict: 'user_id,weekday' })
      .select('weekday,is_active,start_time,end_time,slot_minutes,mode,location,notes')
    if (error) return NextResponse.json({ error: 'Gagal menyimpan ketersediaan: ' + error.message }, { status: 403 })
    const admin = serviceClient()
    if (admin) await admin.from('audit_logs').insert({ actor_id: user.id, action: 'availability.updated', entity_type: 'partner_availability', entity_id: user.id, metadata: { days: unique.size } })
    return NextResponse.json({ data: data ?? [] })
  }

  if (kind === 'transaction.report') {
    const salePrice = Number(body.salePrice ?? 0)
    if (!salePrice || salePrice <= 0) return NextResponse.json({ error: 'Harga jual wajib diisi' }, { status: 400 })
    const rate = 0.5
    const amount = Math.round((salePrice * rate) / 100)
    const mitraRole = body.role === 'property_owner' ? 'property_owner' : 'agent'
    const { data, error } = await supabase
      .from('transaction_reports')
      .insert({
        user_id: user.id,
        role: mitraRole,
        property_id: body.propertyId || null,
        property_title: (body.propertyTitle ?? '').trim() || null,
        buyer_name: (body.buyerName ?? '').trim() || null,
        buyer_contact: (body.buyerContact ?? '').trim() || null,
        sale_price: salePrice,
        commission_rate: rate,
        commission_amount: amount,
        sold_at: body.soldAt || null,
        notes: (body.notes ?? '').trim() || null,
      })
      .select('id,property_title,buyer_name,sale_price,commission_rate,commission_amount,sold_at,status,created_at')
      .single()
    if (error) return NextResponse.json({ error: 'Gagal menyimpan laporan transaksi' }, { status: 403 })
    const admin = serviceClient()
    if (admin) await admin.from('audit_logs').insert({ actor_id: user.id, action: 'transaction.reported', entity_type: 'transaction_report', entity_id: data.id, metadata: { sale_price: salePrice, commission: amount } })
    return NextResponse.json({ data })
  }

  return NextResponse.json({ error: `Aksi tidak dikenal: ${kind}` }, { status: 400 })
}
