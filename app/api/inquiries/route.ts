import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { data, error } = await supabase.from('inquiries').select('id,property_id,agent_id,status,message,created_at,updated_at').or(`user_id.eq.${user.id},agent_id.eq.${user.id}`).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Unable to load inquiries' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const body = await request.json()
  const { data, error } = await supabase.from('inquiries').insert({ ...body, user_id: user.id }).select('id,property_id,status,message,created_at').single()
  if (error) return NextResponse.json({ error: 'Unable to send inquiry' }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
