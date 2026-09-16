import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendVisitFollowUpEmail } from '@/lib/email'
import { notifyUser } from '@/lib/notifications'
import { serviceClient } from '@/lib/visits'

export const runtime = 'nodejs'
export const maxDuration = 45

type Body = {
  visitId?: string
  interest?: string
  feedback?: string
  nextSteps?: string
}

type Alternative = { id: string; title?: string | null; city?: string | null; district?: string | null; price?: number | string | null; listing_type?: string | null }

/**
 * POST /api/visits/follow-up — agen/pemilik menutup kunjungan + memilih minat pembeli.
 *
 * Efek:
 *  - status kunjungan menjadi "completed" + tercatat minat & catatan
 *  - pembeli dapat NOTIFIKASI in-app
 *  - pembeli dapat EMAIL tindak lanjut: tertarik → langkah selanjutnya,
 *    belum tertarik → rekomendasi properti lain yang mirip
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Masuk dulu untuk menindaklanjuti kunjungan.', needsAuth: true }, { status: 401 })

  let body: Body = {}
  try { body = (await request.json()) as Body } catch { /* kosong */ }

  const visitId = String(body.visitId ?? '').trim()
  const interested = body.interest !== 'not_interested'
  const feedback = String(body.feedback ?? '').trim().slice(0, 800)
  const nextSteps = String(body.nextSteps ?? '').trim().slice(0, 800)
  if (!visitId) return NextResponse.json({ error: 'visitId wajib diisi.' }, { status: 400 })

  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server belum dikonfigurasi.' }, { status: 500 })

  const { data: visit, error: visitError } = await admin
    .from('visits')
    .select('id,property_id,user_id,agent_id,scheduled_at,status')
    .eq('id', visitId)
    .maybeSingle()
  if (visitError || !visit) return NextResponse.json({ error: 'Kunjungan tidak ditemukan.' }, { status: 404 })

  const { data: property } = await admin
    .from('properties')
    .select('id,title,city,district,listing_type,price,owner_id')
    .eq('id', visit.property_id)
    .maybeSingle()

  // Hanya agen yang menangani kunjungan atau pemilik properti yang boleh menutup.
  const allowed = visit.agent_id === user.id || property?.owner_id === user.id
  if (!allowed) return NextResponse.json({ error: 'Anda tidak berhak menindaklanjuti kunjungan ini.' }, { status: 403 })

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .from('visits')
    .update({
      status: 'completed',
      interest: interested ? 'interested' : 'not_interested',
      buyer_feedback: feedback || null,
      completed_at: now,
      follow_up_sent_at: now,
    })
    .eq('id', visitId)
  if (updateError) {
    console.error('[homy-visits] gagal update follow-up:', updateError.message)
    return NextResponse.json({ error: 'Gagal menyimpan tindak lanjut.' }, { status: 502 })
  }

  const propertyTitle = (property?.title as string | undefined) || 'properti yang Anda kunjungi'
  const propertyId = (property?.id as string | undefined) ?? visit.property_id

  // Rekomendasi properti lain kalau pembeli belum tertarik.
  let alternatives: Alternative[] = []
  if (!interested) {
    let query = admin
      .from('properties')
      .select('id,title,city,district,price,listing_type')
      .eq('status', 'published')
      .neq('id', propertyId)
      .limit(4)
    if (property?.listing_type) query = query.eq('listing_type', property.listing_type)
    if (property?.city) query = query.eq('city', property.city)
    if (property?.price) query = query.gte('price', Math.round(Number(property.price) * 0.65)).lte('price', Math.round(Number(property.price) * 1.35))
    const { data: rows } = await query
    alternatives = (rows ?? []) as Alternative[]
    if (!alternatives.length) {
      // longgarkan filter: cukup kota, tanpa batas harga
      let loose = admin.from('properties').select('id,title,city,district,price,listing_type').eq('status', 'published').neq('id', propertyId).limit(4)
      if (property?.listing_type) loose = loose.eq('listing_type', property.listing_type)
      const { data: looseRows } = await loose
      alternatives = (looseRows ?? []) as Alternative[]
    }
  }

  // Profil + email pembeli.
  const { data: buyerProfile } = await admin.from('profiles').select('full_name,phone').eq('id', visit.user_id).maybeSingle()
  const buyerName = (buyerProfile?.full_name as string | undefined) || 'Pengguna Homy'
  let buyerEmail = ''
  try {
    const { data } = await admin.auth.admin.getUserById(visit.user_id)
    buyerEmail = data?.user?.email ?? ''
  } catch { /* email tidak tersedia */ }

  const { data: sellerProfile } = await admin.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle()
  const sellerName = (sellerProfile?.full_name as string | undefined) || null
  const sellerContact = (sellerProfile?.phone as string | undefined) || user.email || null

  const steps = interested
    ? [
        'Hubungi pemilik/agen untuk konfirmasi minat dan jadwalkan negosiasi harga.',
        'Siapkan dokumen: KTP, dan slip gaji/rekening 3 bulan terakhir bila memakai KPR.',
        'Minta pemilik menyiapkan sertifikat & IMB untuk diverifikasi bersama.',
        'Lanjut ke booking fee, PPJB, lalu akad/balik nama.',
      ]
    : []

  const noteBody = interested
    ? `Terima kasih sudah mengunjungi ${propertyTitle}. Karena Anda tertarik, langkah berikutnya: ${steps.slice(0, 2).join(' ')}`
    : `Terima kasih sudah mengunjungi ${propertyTitle}. Kalau belum cocok, kami siapkan ${alternatives.length} pilihan properti lain untuk Anda.`

  await notifyUser({
    userId: visit.user_id,
    kind: 'visit.completed',
    title: interested ? `Tindak lanjut kunjungan: ${propertyTitle}` : `Pilihan properti lain untuk Anda`,
    body: noteBody,
    href: interested ? `/property/${propertyId}` : '/buy',
    data: { visit_id: visitId, property_id: propertyId, interest: interested ? 'interested' : 'not_interested', alternatives: alternatives.map((item) => item.id) },
  })

  const email = await sendVisitFollowUpEmail({
    to: buyerEmail,
    buyerName,
    propertyTitle,
    propertyId,
    interested,
    sellerName,
    sellerContact,
    feedback: feedback || null,
    nextSteps: nextSteps || null,
    alternatives,
  })

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: interested ? 'visit.follow_up.interested' : 'visit.follow_up.not_interested',
    entity_type: 'visit',
    entity_id: visitId,
    metadata: { property_id: propertyId, buyer_id: visit.user_id, feedback: feedback || null, email_ok: email.ok, alternatives: alternatives.map((item) => item.id) },
  })

  return NextResponse.json({
    ok: true,
    interest: interested ? 'interested' : 'not_interested',
    notification: 'sent',
    email: { ok: email.ok, skipped: Boolean(email.skipped), reason: email.reason ?? null, subject: email.subject },
    alternatives: alternatives.map((item) => ({ id: item.id, title: item.title, city: item.city, district: item.district, price: item.price, listing_type: item.listing_type })),
  })
}
