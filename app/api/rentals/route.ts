import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { data, error } = await supabase.from('rental_requests').select('id,property_id,start_date,end_date,duration_unit,status,deposit_amount,service_charge,maintenance_fee,created_at').eq('renter_id', user.id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Unable to load rental requests' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const body = await request.json()
  const { data, error } = await supabase.from('rental_requests').insert({ ...body, renter_id: user.id }).select('id,property_id,status,start_date,end_date').single()
  if (error) return NextResponse.json({ error: 'Unable to submit rental request' }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
