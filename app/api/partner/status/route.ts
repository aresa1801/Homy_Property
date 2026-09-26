import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** GET /api/partner/status — status sanksi mitra untuk pengguna yang sedang login. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ state: null }, { status: 401 })

  const { data: state } = await supabase.rpc('partner_sanction_state', { p_uid: user.id })
  const { data: rows } = await supabase
    .from('partner_sanctions')
    .select('id,level,kind,category,reason,status,starts_at,ends_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(20)

  return NextResponse.json(
    { state: state ?? { state: 'active', level: 0 }, sanctions: rows ?? [] },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
