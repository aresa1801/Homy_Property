import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_ROLES = ['admin', 'super_admin']

async function adminScopedClient(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId)
  const list = Array.isArray(roles) ? roles.map((r: { role: string }) => r.role) : []
  if (!list.some((r) => ADMIN_ROLES.includes(r))) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Profil rekan (pembeli/penyewa) — hanya untuk id yang memang ada di data milik user. */
async function counterpartProfiles(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean))).slice(0, 25)
  const map: Record<string, { name?: string; email?: string; phone?: string }> = {}
  if (!unique.length) return map
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return map
  const admin = createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const [profiles, users] = await Promise.all([
    admin.from('profiles').select('id,full_name,phone').in('id', unique),
    Promise.all(unique.map((id) => admin.auth.admin.getUserById(id).then((r) => r.data?.user ?? null).catch(() => null))),
  ])
  for (const profile of profiles.data ?? []) map[profile.id] = { name: profile.full_name ?? undefined, phone: profile.phone ?? undefined }
  for (const user of users) if (user?.id) map[user.id] = { ...(map[user.id] ?? {}), email: user.email ?? undefined }
  return map
}

const empty = { metrics: {}, properties: [], inquiries: [], visits: [], rentals: [], payments: [], reports: [], audit: [], transactions: [], partnerLeads: [], availability: [] }

export async function GET(_request: Request, { params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ...empty, authenticated: false }, { status: 200 })

  const base = { authenticated: true, role }

  if (role === 'agent' || role === 'property-owner') {
    const propertySelect = 'id,title,city,province,district,status,listing_type,property_type,price,price_period,created_at,moderation_note,verified_at,ai_summary,property_media(storage_path,media_type,sort_order)'
    const inquirySelect = 'id,property_id,user_id,status,message,reply_message,replied_at,follow_up_note,created_at'
    const { data: ownProperties } = await supabase.from('properties').select(propertySelect).eq('owner_id', user.id).order('created_at', { ascending: false }).limit(100)
    const rows = ownProperties ?? []
    const ownIds = rows.length ? rows.map((p) => p.id) : ['00000000-0000-0000-0000-000000000000']
    const [ownInquiries, agentInquiries, visits, transactions, agreements] = await Promise.all([
      supabase.from('inquiries').select(inquirySelect).in('property_id', ownIds).order('created_at', { ascending: false }).limit(100),
      supabase.from('inquiries').select(inquirySelect).eq('agent_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('visits').select('id,property_id,user_id,scheduled_at,status,notes,interest,buyer_feedback,completed_at,follow_up_sent_at').eq('agent_id', user.id).order('scheduled_at', { ascending: true }).limit(100),
      supabase.from('transaction_reports').select('id,property_id,property_title,buyer_name,buyer_contact,sale_price,commission_rate,commission_amount,sold_at,status,notes,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('partner_agreements').select('role,status,full_name,identity_number,phone,address,commission_rate,signed_at,agreement_version').eq('user_id', user.id),
    ])
    const titles: Record<string, string> = {}
    for (const row of rows) titles[row.id] = row.title

    const byId = new Map<string, Record<string, unknown>>()
    for (const item of [...(ownInquiries.data ?? []), ...(agentInquiries.data ?? [])]) byId.set(String(item.id), item)
    const inquiries = Array.from(byId.values()).map((item) => ({ ...item, property_title: titles[String(item.property_id)] ?? 'Properti' }))
    inquiries.sort((a, b) => String((b as { created_at?: string }).created_at).localeCompare(String((a as { created_at?: string }).created_at)))

    const people = await counterpartProfiles([
      ...inquiries.map((i) => String((i as { user_id?: string }).user_id ?? '')),
      ...(visits.data ?? []).map((v) => String(v.user_id ?? '')),
    ])

    const visitsEnriched = (visits.data ?? []).map((v) => ({ ...v, property_title: titles[String(v.property_id)] ?? 'Properti', visitor: people[String(v.user_id)] ?? null }))
    const inquiriesEnriched = inquiries.map((i) => ({ ...i, from: people[String((i as { user_id?: string }).user_id ?? '')] ?? null }))

    const openLeads = inquiriesEnriched.filter((i) => String((i as { status?: string }).status) === 'open').length
    const upcomingVisits = visitsEnriched.filter((v) => v.status !== 'cancelled' && v.status !== 'completed').length
    const commissionTotal = (transactions.data ?? []).reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0)

    const metrics = role === 'agent'
      ? { activeListings: rows.filter((p) => p.status === 'published').length, newLeads: openLeads, totalListings: rows.length, pendingListings: rows.filter((p) => p.status === 'pending').length, rejectedListings: rows.filter((p) => p.status === 'rejected').length, totalLeads: inquiriesEnriched.length, upcomingVisits, reports: transactions.data?.length ?? 0, commissionTotal }
      : { properties: rows.length, publishedProperties: rows.filter((p) => p.status === 'published').length, inquiries: inquiriesEnriched.length, pendingProperties: rows.filter((p) => p.status === 'pending').length, rejectedProperties: rows.filter((p) => p.status === 'rejected').length, openLeads, upcomingVisits, reports: transactions.data?.length ?? 0, commissionTotal }

    const { data: availabilityRows } = await supabase
      .from('partner_availability')
      .select('weekday,is_active,start_time,end_time,slot_minutes,mode,location,notes')
      .eq('user_id', user.id)
      .order('weekday', { ascending: true })

    return NextResponse.json({ ...base, metrics, properties: rows, inquiries: inquiriesEnriched, visits: visitsEnriched, transactions: transactions.data ?? [], agreements: agreements.data ?? [], availability: availabilityRows ?? [], payments: [] })
  }

  if (role === 'admin' || role === 'super-admin') {
    if (role === 'super-admin') {
      const { data: superRoles } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin')
      if (!Array.isArray(superRoles) || superRoles.length === 0) {
        return NextResponse.json({ ...base, forbidden: true, metrics: {} })
      }
    }
    const admin = await adminScopedClient(supabase, user.id)
    if (!admin) {
      return NextResponse.json({ ...base, forbidden: true, metrics: { pendingApprovals: 0, published: 0, rejected: 0, activeUsers: 0, openReports: 0 } })
    }
    const [rows, media, adminReports, profiles, roleRows, transactions, audit, flags, settings, partnerLeads] = await Promise.all([
      admin.from('properties').select('id,title,address,city,province,district,listing_type,property_type,price,price_period,status,owner_id,created_at,moderation_note,verified_at,ai_summary').order('created_at', { ascending: false }).limit(200),
      admin.from('property_media').select('property_id').limit(3000),
      admin.from('moderation_reports').select('id,property_id,reported_user_id,reason,status,resolution_note,created_at').order('created_at', { ascending: false }).limit(50),
      admin.from('profiles').select('id,full_name,phone,role,created_at').limit(500),
      admin.from('user_roles').select('user_id,role').limit(2000),
      admin.from('transaction_reports').select('id,user_id,role,property_id,property_title,buyer_name,buyer_contact,sale_price,commission_rate,commission_amount,sold_at,status,notes,review_note,verified_at,created_at').order('created_at', { ascending: false }).limit(200),
      admin.from('audit_logs').select('id,actor_id,action,entity_type,entity_id,metadata,created_at').order('created_at', { ascending: false }).limit(80),
      role === 'super-admin' ? admin.from('feature_flags').select('key,label,description,enabled,rollout,updated_at').order('key') : Promise.resolve({ data: [] as unknown[] }),
      role === 'super-admin' ? admin.from('platform_settings').select('key,label,value,updated_at').order('key') : Promise.resolve({ data: [] as unknown[] }),
      admin.from('partner_leads').select('id,kind,full_name,email,phone,company,position,city,province,website,branches,license_no,message,status,review_note,reviewed_at,created_at').order('created_at', { ascending: false }).limit(200),
    ])

    const list = rows.data ?? []
    const mediaCount = new Map<string, number>()
    for (const row of media.data ?? []) mediaCount.set(row.property_id, (mediaCount.get(row.property_id) ?? 0) + 1)

    // identitas pemilik + admin (nama + email) — hanya untuk id yang ada di data
    const ownerIds = Array.from(new Set(list.map((p) => p.owner_id).filter(Boolean))) as string[]
    const actorIds = Array.from(new Set((audit.data ?? []).map((a) => a.actor_id).filter(Boolean))) as string[]
    const txUserIds = Array.from(new Set((transactions.data ?? []).map((t) => t.user_id).filter(Boolean))) as string[]
    const profileIds = Array.from(new Set([...ownerIds, ...actorIds, ...txUserIds])).slice(0, 200)
    const profileMap: Record<string, { name?: string; email?: string; phone?: string }> = {}
    if (profileIds.length) {
      const [profileRows, userRows] = await Promise.all([
        admin.from('profiles').select('id,full_name,phone').in('id', profileIds),
        Promise.all(profileIds.map((id) => admin.auth.admin.getUserById(id).then((r) => r.data?.user ?? null).catch(() => null))),
      ])
      for (const profile of profileRows.data ?? []) profileMap[profile.id] = { name: profile.full_name ?? undefined, phone: profile.phone ?? undefined }
      for (const u of userRows) if (u?.id) profileMap[u.id] = { ...(profileMap[u.id] ?? {}), email: u.email ?? undefined }
    }

    const roleMap: Record<string, string[]> = {}
    for (const row of roleRows.data ?? []) roleMap[row.user_id] = [...(roleMap[row.user_id] ?? []), row.role]
    const listingCount = new Map<string, number>()
    for (const p of list) if (p.owner_id) listingCount.set(p.owner_id, (listingCount.get(p.owner_id) ?? 0) + 1)

    const users = (profiles.data ?? []).map((profile) => {
      const roles = roleMap[profile.id] ?? (profile.role ? [profile.role] : [])
      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profileMap[profile.id]?.email ?? null,
        phone: profile.phone,
        roles,
        created_at: profile.created_at,
        listings: listingCount.get(profile.id) ?? 0,
        verification: roles.some((r) => ['agent', 'property_owner'].includes(r)) ? (roleMap[profile.id]?.includes('admin') ? 'admin' : 'mitra') : 'pengguna',
      }
    })

    const transactionsEnriched = (transactions.data ?? []).map((row) => ({ ...row, user: profileMap[row.user_id] ?? null }))
    const reportsEnriched = (adminReports.data ?? []).map((row) => {
      const property = list.find((p) => p.id === row.property_id)
      return { ...row, property_title: property?.title ?? null, reported_user: row.reported_user_id ? profileMap[row.reported_user_id] ?? null : null }
    })
    const auditEnriched = (audit.data ?? []).map((row) => ({ ...row, actor: row.actor_id ? profileMap[row.actor_id] ?? null : null }))

    // deteksi duplikat sederhana: judul/alamat sama (dinormalisasi)
    const dupMap = new Map<string, { ids: string[]; titles: string[] }>()
    for (const p of list) {
      const key = String(p.title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (!key) continue
      const entry = dupMap.get(key) ?? { ids: [], titles: [] }
      entry.ids.push(p.id)
      entry.titles.push(String(p.title ?? ''))
      dupMap.set(key, entry)
    }
    const duplicates = [...dupMap.entries()].filter(([, v]) => v.ids.length > 1).map(([key, v]) => ({ key, count: v.ids.length, ids: v.ids, titles: v.titles }))

    const commissionTotal = transactionsEnriched.reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0)
    const commissionVerified = transactionsEnriched.filter((row) => row.status === 'verified').reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0)
    const commissionPending = transactionsEnriched.filter((row) => row.status === 'reported').reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0)
    const published = list.filter((p) => p.status === 'published')
    const roleCounts = Object.entries(roleMap).reduce<Record<string, number>>((acc, [, roles]) => {
      for (const r of roles) acc[r] = (acc[r] ?? 0) + 1
      return acc
    }, {})

    const metrics = {
      totalListings: list.length,
      pendingApprovals: list.filter((p) => p.status === 'pending').length,
      published: published.length,
      rejected: list.filter((p) => p.status === 'rejected').length,
      activeUsers: users.length,
      openReports: reportsEnriched.filter((r) => ['open', 'investigating'].includes(String(r.status))).length,
      totalReports: transactionsEnriched.length,
      commissionTotal,
      commissionVerified,
      commissionPending,
      pendingCommissionCount: transactionsEnriched.filter((row) => row.status === 'reported').length,
      partnersTotal: (partnerLeads.data ?? []).length,
      partnersPending: (partnerLeads.data ?? []).filter((row) => row.status === 'new' || row.status === 'reviewing').length,
      partnersInstitution: (partnerLeads.data ?? []).filter((row) => row.kind === 'agency' || row.kind === 'institution').length,
      contactMessages: (partnerLeads.data ?? []).filter((row) => row.kind === 'contact').length,
      aiEvents: auditEnriched.filter((a) => String(a.action ?? '').startsWith('ai.')).length,
      aiCoverage: published.length ? Math.round((published.filter((p) => p.ai_summary).length / published.length) * 100) : 0,
    }

    return NextResponse.json({
      ...base,
      metrics,
      properties: list.filter((p) => p.status === 'pending'),
      allProperties: list,
      users,
      transactions: transactionsEnriched,
      adminReports: reportsEnriched,
      audit: auditEnriched,
      duplicates,
      roleCounts: Object.entries(roleCounts).map(([r, count]) => ({ role: r, count })).sort((a, b) => b.count - a.count),
      flags: flags.data ?? [],
      settings: settings.data ?? [],
      partnerLeads: partnerLeads.data ?? [],
      ai: {
        configured: true,
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        listingsWithSummary: published.filter((p) => p.ai_summary).length,
        listingsWithoutMedia: published.filter((p) => (mediaCount.get(p.id) ?? 0) === 0).length,
        amenitiesCoverage: published.length,
      },
    })
  }

  const [favorites, inquiries, visits, rentals, payments] = await Promise.all([
    supabase.from('favorites').select('property_id,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('inquiries').select('id,property_id,status,message,reply_message,replied_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('visits').select('id,property_id,scheduled_at,status,notes,interest,buyer_feedback,completed_at,follow_up_sent_at').eq('user_id', user.id).order('scheduled_at', { ascending: true }).limit(20),
    supabase.from('rental_requests').select('id,property_id,start_date,end_date,status,duration_unit').eq('renter_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('payments').select('id,amount,currency,payment_type,status,due_at,paid_at').eq('payer_id', user.id).order('created_at', { ascending: false }).limit(20),
  ])
  const favRowsRaw = (favorites.data ?? []) as unknown as Array<{ property_id?: string | null }>
  const visitRowsRaw = (visits.data ?? []) as unknown as Array<{ property_id?: string | null; status?: string | null }>
  const inquiryRowsRaw = (inquiries.data ?? []) as unknown as Array<{ property_id?: string | null; status?: string | null }>
  const rentalRowsRaw = (rentals.data ?? []) as unknown as Array<{ property_id?: string | null }>
  const refIds = Array.from(new Set([
    ...favRowsRaw.map((row) => String(row.property_id ?? '')),
    ...visitRowsRaw.map((row) => String(row.property_id ?? '')),
    ...inquiryRowsRaw.map((row) => String(row.property_id ?? '')),
    ...rentalRowsRaw.map((row) => String(row.property_id ?? '')),
  ].filter(Boolean)))
  const { data: refProperties } = refIds.length
    ? await supabase.from('properties').select('id,title,city,province,district,status,listing_type,property_type,price,price_period,created_at').in('id', refIds)
    : { data: [] as Array<Record<string, unknown>> }
  const refMap: Record<string, Record<string, unknown>> = {}
  for (const row of (refProperties ?? []) as unknown as Array<Record<string, unknown>>) refMap[String(row.id)] = row
  // Titik temu hanya dibuka untuk kunjungan yang sudah dikonfirmasi/selesai.
  const unlockedIds = Array.from(new Set(
    visitRowsRaw
      .filter((row) => String(row.status ?? '') === 'confirmed' || String(row.status ?? '') === 'completed')
      .map((row) => String(row.property_id ?? '')),
  )).filter(Boolean)
  const { data: pointRows } = unlockedIds.length
    ? await supabase.from('properties').select('id,meeting_point,meeting_point_lat,meeting_point_lng,map_url').in('id', unlockedIds)
    : { data: [] as Array<Record<string, unknown>> }
  const pointMap: Record<string, Record<string, unknown>> = {}
  for (const row of (pointRows ?? []) as unknown as Array<Record<string, unknown>>) pointMap[String(row.id)] = row
  const attach = (row: Record<string, unknown>): Record<string, unknown> => ({ ...row, property: refMap[String(row.property_id ?? '')] ?? null })
  const favoriteRows = favRowsRaw.map((row) => attach(row as unknown as Record<string, unknown>))
  const visitRows = visitRowsRaw.map((row) => {
    const base = attach(row as unknown as Record<string, unknown>)
    const status = String(row.status ?? '')
    if (status !== 'confirmed' && status !== 'completed') return base
    const point = pointMap[String(row.property_id ?? '')]
    return {
      ...base,
      meeting_point: point?.meeting_point ?? null,
      meeting_point_lat: point?.meeting_point_lat ?? null,
      meeting_point_lng: point?.meeting_point_lng ?? null,
      map_url: point?.map_url ?? null,
    }
  })
  const inquiryRows = inquiryRowsRaw.map((row) => attach(row as unknown as Record<string, unknown>))
  const upcomingVisits = visitRows.filter((v) => v.status !== 'cancelled' && v.status !== 'completed').length
  const averageFavoritePrice = (() => {
    const values = favoriteRows.map((row) => Number(((row.property ?? null) as { price?: unknown } | null)?.price ?? 0)).filter((value) => Number.isFinite(value) && value > 0)
    if (!values.length) return 0
    return Math.round(values.reduce((total, value) => total + value, 0) / values.length)
  })()
  const pendingPayments = ((payments.data ?? []) as unknown as Array<{ status?: string | null }>).filter((p) => p.status === 'pending')
  return NextResponse.json({
    ...base,
    metrics: {
      favorites: favoriteRows.length,
      inquiries: inquiryRows.length,
      openInquiries: inquiryRows.filter((row) => String(row.status ?? 'open') !== 'closed').length,
      upcomingVisits,
      pendingPayments: pendingPayments.length,
      averageFavoritePrice,
    },
    favorites: favoriteRows,
    inquiries: inquiryRows,
    visits: visitRows,
    payments: payments.data ?? [],
    rentals: rentals.data ?? [],
  })
}
