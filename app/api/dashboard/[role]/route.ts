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

const empty = { metrics: {}, properties: [], inquiries: [], visits: [], rentals: [], payments: [], reports: [], audit: [] }

export async function GET(_request: Request, { params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ...empty, authenticated: false }, { status: 200 })

  const base = { authenticated: true, role }
  if (role === 'agent') {
    const [properties, inquiries] = await Promise.all([
      supabase.from('properties').select('id,title,city,status,listing_type,price,created_at,moderation_note,property_type,province').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('inquiries').select('id,property_id,status,message,created_at').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(20),
    ])
    return NextResponse.json({ ...base, metrics: { activeListings: properties.data?.filter((p) => p.status === 'published').length ?? 0, newLeads: inquiries.data?.filter((i) => i.status === 'open').length ?? 0 }, properties: properties.data ?? [], inquiries: inquiries.data ?? [] })
  }
  if (role === 'property-owner') {
    const [properties, inquiries] = await Promise.all([
      supabase.from('properties').select('id,title,city,status,listing_type,price,created_at,moderation_note,property_type,province').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('inquiries').select('id,property_id,status,message,created_at').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(50),
    ])
    return NextResponse.json({ ...base, metrics: { properties: properties.data?.length ?? 0, publishedProperties: properties.data?.filter((p) => p.status === 'published').length ?? 0, inquiries: inquiries.data?.length ?? 0 }, properties: properties.data ?? [], inquiries: inquiries.data ?? [], visits: [] })
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
    supabase.from('inquiries').select('id,property_id,status,message,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('visits').select('id,property_id,scheduled_at,status,notes').eq('user_id', user.id).order('scheduled_at', { ascending: true }).limit(20),
    supabase.from('rental_requests').select('id,property_id,start_date,end_date,status,duration_unit').eq('renter_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('payments').select('id,amount,currency,payment_type,status,due_at,paid_at').eq('payer_id', user.id).order('created_at', { ascending: false }).limit(20),
  ])
  return NextResponse.json({ ...base, metrics: { favorites: favorites.data?.length ?? 0, inquiries: inquiries.data?.length ?? 0, upcomingVisits: visits.data?.filter((v) => v.status !== 'cancelled').length ?? 0, pendingPayments: payments.data?.filter((p) => p.status === 'pending').length ?? 0 }, favorites: favorites.data ?? [], inquiries: inquiries.data ?? [], visits: visits.data ?? [], rentals: rentals.data ?? [], payments: payments.data ?? [] })
}
