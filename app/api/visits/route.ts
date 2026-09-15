import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendVisitScheduledEmail } from '@/lib/email'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { getVisitContext, MODE_LABEL, serviceClient, weeklySummary } from '@/lib/visits'
import { notifyUser } from '@/lib/notifications'

export const runtime = 'nodejs'
export const maxDuration = 45

type VisitBody = {
  propertyId?: string
  scheduledAt?: string
  notes?: string
}

/** GET /api/visits?propertyId=... — slot kunjungan kosong 14 hari ke depan (WIB). */
export async function GET(request: Request) {
  const propertyId = new URL(request.url).searchParams.get('propertyId')?.trim() ?? ''
  if (!propertyId) return NextResponse.json({ error: 'propertyId wajib diisi.' }, { status: 400 })

  const limit = rateLimit(clientKey(request, 'visits-read'), 40, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  if (!serviceClient()) return NextResponse.json({ error: 'Server belum dikonfigurasi.' }, { status: 500 })

  const ctx = await getVisitContext(propertyId)
  if (!ctx) return NextResponse.json({ error: 'Properti tidak ditemukan.' }, { status: 404 })

  const days = new Map<string, { date: string; dayLabel: string; slots: typeof ctx.slots }>()
  ctx.slots.forEach((slot) => {
    const entry = days.get(slot.date) ?? { date: slot.date, dayLabel: slot.dayLabel, slots: [] }
    entry.slots.push(slot)
    days.set(slot.date, entry)
  })

  const modes = Array.from(new Set(ctx.slots.map((slot) => slot.mode)))
  return NextResponse.json({
    ok: true,
    propertyId: ctx.propertyId,
    propertyTitle: ctx.propertyTitle,
    agentName: ctx.agentName,
    agentPhone: ctx.agentPhone,
    configured: ctx.availability.length > 0,
    weekly: weeklySummary(ctx.availability) || null,
    modeLabel: modes.map((mode) => MODE_LABEL[mode] ?? mode).join(' / '),
    days: Array.from(days.values()),
    slots: ctx.slots,
    total: ctx.slots.length,
  })
}

/** POST /api/visits — pengguna terdaftar memilih slot; agen/pemilik dinotifikasi via email + jadwal tercatat di dashboard. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Masuk dulu untuk menjadwalkan kunjungan.', needsAuth: true }, { status: 401 })
  }

  const limit = rateLimit(clientKey(request, 'visits-book'), 8, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let body: VisitBody = {}
  try { body = (await request.json()) as VisitBody } catch { /* body kosong */ }

  const propertyId = String(body.propertyId ?? '').trim()
  const scheduledAt = String(body.scheduledAt ?? '').trim()
  const notes = String(body.notes ?? '').trim().slice(0, 600)
  if (!propertyId || !scheduledAt) return NextResponse.json({ error: 'Properti dan jadwal wajib dipilih.' }, { status: 400 })

  const wanted = new Date(scheduledAt)
  if (Number.isNaN(wanted.getTime())) return NextResponse.json({ error: 'Format jadwal tidak valid.' }, { status: 400 })

  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server belum dikonfigurasi.' }, { status: 500 })

  const ctx = await getVisitContext(propertyId)
  if (!ctx) return NextResponse.json({ error: 'Properti tidak ditemukan.' }, { status: 404 })

  const slot = ctx.slots.find((item) => item.iso === wanted.toISOString())
  if (!slot) {
    return NextResponse.json({ error: 'Slot itu sudah tidak tersedia. Silakan pilih jadwal lain.' }, { status: 409 })
  }

  const { data: inserted, error: insertError } = await admin
    .from('visits')
    .insert({
      property_id: ctx.propertyId,
      user_id: user.id,
      agent_id: ctx.ownerId,
      scheduled_at: slot.iso,
      status: 'requested',
      notes: notes ? `Dijadwalkan lewat Homy AI — ${notes}` : 'Dijadwalkan lewat Homy AI',
    })
    .select('id,scheduled_at,status,notes')
    .maybeSingle()

  if (insertError || !inserted?.id) {
    console.error('[homy-visits] insert gagal:', insertError?.message)
    return NextResponse.json({ error: 'Gagal menyimpan jadwal. Coba lagi sebentar lagi.' }, { status: 502 })
  }

  const { data: profile } = await admin.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle()
  const visitorName = (profile?.full_name as string | undefined) || user.email?.split('@')[0] || 'Pengguna Homy'

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'visit.scheduled',
    entity_type: 'visit',
    entity_id: String(inserted.id),
    metadata: {
      property_id: ctx.propertyId,
      property_title: ctx.propertyTitle,
      agent_id: ctx.ownerId,
      scheduled_at: slot.iso,
      slot_label: `${slot.dayLabel} ${slot.timeLabel}`,
      mode: slot.mode,
      source: 'homy-ai',
    },
  })

  let ownerEmail: string | null = null
  try {
    const owner = await admin.auth.admin.getUserById(ctx.ownerId)
    ownerEmail = owner.data?.user?.email ?? null
  } catch (error) {
    console.error('[homy-visits] resolve email pemilik gagal:', error instanceof Error ? error.message : error)
  }

  const mail = await sendVisitScheduledEmail({
    to: ownerEmail ?? '',
    ownerName: ctx.agentName ?? undefined,
    visitorName,
    visitorEmail: user.email ?? undefined,
    visitorPhone: (profile?.phone as string | undefined) ?? undefined,
    propertyTitle: ctx.propertyTitle,
    propertyId: ctx.propertyId,
    scheduledAt: slot.iso,
    dayLabel: slot.dayLabel,
    timeLabel: slot.timeLabel,
    mode: slot.mode,
    location: slot.location,
    notes: notes || null,
  })

  await notifyUser({
    userId: ctx.ownerId,
    kind: 'visit.new',
    title: 'Jadwal kunjungan baru',
    body: visitorName + ' memilih ' + slot.dayLabel + ' pukul ' + slot.timeLabel + ' untuk ' + ctx.propertyTitle + '.',
    href: '/dashboard/property-owner/calendar',
    data: { visit_id: String(inserted.id), property_id: ctx.propertyId, scheduled_at: slot.iso },
  })

  return NextResponse.json({
    ok: true,
    visit: { id: inserted.id, scheduled_at: inserted.scheduled_at, status: inserted.status },
    slot: { dayLabel: slot.dayLabel, timeLabel: slot.timeLabel, mode: slot.mode, iso: slot.iso },
    agent: { name: ctx.agentName, phone: ctx.agentPhone },
    email: { ok: mail.ok, skipped: mail.skipped ?? false, subject: mail.subject ?? null },
    message: mail.ok
      ? 'Jadwal terkirim! Agen/pemilik sudah diberi tahu lewat email dan jadwal tercatat di dashboard mereka.'
      : 'Jadwal tercatat di dashboard agen/pemilik. Notifikasi email akan menyusul.',
  })
}
