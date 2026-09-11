import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const empty = { metrics: {}, properties: [], inquiries: [], visits: [], rentals: [], payments: [], reports: [], audit: [] }

export async function GET(_request: Request, { params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ...empty, authenticated: false }, { status: 200 })

  const base = { authenticated: true, role }
  if (role === 'agent') {
    const [properties, inquiries] = await Promise.all([
      supabase.from('properties').select('id,title,city,status,listing_type,price,created_at').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('inquiries').select('id,property_id,status,message,created_at').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(20),
    ])
    return NextResponse.json({ ...base, metrics: { activeListings: properties.data?.filter((p) => p.status === 'published').length ?? 0, newLeads: inquiries.data?.filter((i) => i.status === 'open').length ?? 0 }, properties: properties.data ?? [], inquiries: inquiries.data ?? [] })
  }
  if (role === 'admin') {
    const [pending, reports, users] = await Promise.all([
      supabase.from('properties').select('id,title,city,status,owner_id,created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(30),
      supabase.from('moderation_reports').select('id,property_id,reason,status,created_at').in('status', ['open', 'investigating']).order('created_at', { ascending: false }).limit(30),
      supabase.from('profiles').select('id,role,created_at').limit(1000),
    ])
    return NextResponse.json({ ...base, metrics: { pendingApprovals: pending.data?.length ?? 0, openReports: reports.data?.length ?? 0, activeUsers: users.data?.length ?? 0 }, properties: pending.data ?? [], reports: reports.data ?? [] })
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
