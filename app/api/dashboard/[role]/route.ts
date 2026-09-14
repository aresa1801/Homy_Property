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

const empty = { metrics: {}, properties: [], inquiries: [], visits: [], rentals: [], payments: [], reports: [], audit: [], transactions: [] }

export async function GET(_request: Request, { params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ...empty, authenticated: false }, { status: 200 })

  const base = { authenticated: true, role }

  if (role === 'agent' || role === 'property-owner') {
    const propertySelect = 'id,title,city,province,district,status,listing_type,property_type,price,price_period,created_at,moderation_note,verified_at,ai_summary'
    const inquirySelect = 'id,property_id,user_id,status,message,reply_message,replied_at,follow_up_note,created_at'
    const { data: ownProperties } = await supabase.from('properties').select(propertySelect).eq('owner_id', user.id).order('created_at', { ascending: false }).limit(100)
    const rows = ownProperties ?? []
    const ownIds = rows.length ? rows.map((p) => p.id) : ['00000000-0000-0000-0000-000000000000']
    const [ownInquiries, agentInquiries, visits, transactions, agreements] = await Promise.all([
      supabase.from('inquiries').select(inquirySelect).in('property_id', ownIds).order('created_at', { ascending: false }).limit(100),
      supabase.from('inquiries').select(inquirySelect).eq('agent_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('visits').select('id,property_id,user_id,scheduled_at,status,notes').eq('agent_id', user.id).order('scheduled_at', { ascending: true }).limit(100),
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

    return NextResponse.json({ ...base, metrics, properties: rows, inquiries: inquiriesEnriched, visits: visitsEnriched, transactions: transactions.data ?? [], agreements: agreements.data ?? [], payments: [] })
  }

  if (role === 'admin') {
    const admin = await adminScopedClient(supabase, user.id)
    if (!admin) return NextResponse.json({ ...base, metrics: { pendingApprovals: 0, published: 0, rejected: 0, openReports: 0, activeUsers: 0 }, properties: [], reports: [], forbidden: true })
    const [rows, reports, users] = await Promise.all([
      admin.from('properties').select('id,title,city,province,district,listing_type,property_type,price,price_period,status,owner_id,created_at,moderation_note').order('created_at', { ascending: false }).limit(100),
      admin.from('moderation_reports').select('id,property_id,reason,status,created_at').in('status', ['open', 'investigating']).order('created_at', { ascending: false }).limit(30),
      admin.from('profiles').select('id,role,created_at').limit(1000),
    ])
    const list = rows.data ?? []
    const pending = list.filter((p) => p.status === 'pending')
    return NextResponse.json({ ...base, metrics: { pendingApprovals: pending.length, published: list.filter((p) => p.status === 'published').length, rejected: list.filter((p) => p.status === 'rejected').length, openReports: reports.data?.length ?? 0, activeUsers: users.data?.length ?? 0 }, properties: pending, allProperties: list, reports: reports.data ?? [] })
  }

  if (role === 'super-admin') {
    const [users, properties, audit] = await Promise.all([
      supabase.from('profiles').select('id,role,created_at').limit(1000),
      supabase.from('properties').select('id,status,listing_type,created_at').limit(1000),
      supabase.from('audit_logs').select('id,action,entity_type,created_at,metadata').order('created_at', { ascending: false }).limit(20),
    ])
    return NextResponse.json({ ...base, metrics: { users: users.data?.length ?? 0, properties: properties.data?.length ?? 0, auditEvents: audit.data?.length ?? 0 }, audit: audit.data ?? [] })
  }

  const [favorites, inquiries, visits, rentals, payments] = await Promise.all([
    supabase.from('favorites').select('property_id,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('inquiries').select('id,property_id,status,message,reply_message,replied_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('visits').select('id,property_id,scheduled_at,status,notes').eq('user_id', user.id).order('scheduled_at', { ascending: true }).limit(20),
    supabase.from('rental_requests').select('id,property_id,start_date,end_date,status,duration_unit').eq('renter_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('payments').select('id,amount,currency,payment_type,status,due_at,paid_at').eq('payer_id', user.id).order('created_at', { ascending: false }).limit(20),
  ])
  return NextResponse.json({ ...base, metrics: { favorites: favorites.data?.length ?? 0, inquiries: inquiries.data?.length ?? 0, upcomingVisits: visits.data?.filter((v) => v.status !== 'cancelled').length ?? 0, pendingPayments: payments.data?.filter((p) => p.status === 'pending').length ?? 0 }, favorites: favorites.data ?? [], inquiries: inquiries.data ?? [], visits: visits.data ?? [], rentals: rentals.data ?? [], payments: payments.data ?? [] })
}
