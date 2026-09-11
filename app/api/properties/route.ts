import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('listing_type')
  const city = searchParams.get('city')
  const supabase = await createClient()
  let query = supabase.from('properties').select('id,title,description,listing_type,status,property_type,city,district,price,price_period,bedrooms,bathrooms,furnished,utilities_included,available_from,created_at').eq('status', 'published')
  if (type === 'sale' || type === 'rent') query = query.eq('listing_type', type)
  if (city) query = query.ilike('city', `%${city}%`)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
  if (error) return NextResponse.json({ error: 'Unable to load properties' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const body = await request.json()
  const { data, error } = await supabase.from('properties').insert({ ...body, owner_id: user.id }).select('id,title,status').single()
  if (error) return NextResponse.json({ error: 'Unable to create property' }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
