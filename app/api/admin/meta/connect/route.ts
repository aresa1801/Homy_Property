import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { authorizeUrl, configured, type Channel } from '@/lib/meta'

export const runtime = 'nodejs'

const ADMIN_ROLES = ['admin', 'super_admin']
const WORKFORCE_PATH = '/dashboard/admin/workforce'

function isChannel(v: string | null): v is Channel {
  return v === 'instagram' || v === 'threads' || v === 'facebook'
}

/** Mulai alur OAuth: set state di cookie lalu redirect ke Meta/Threads. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const channel = url.searchParams.get('channel')
  if (!isChannel(channel)) return NextResponse.json({ error: 'channel tidak dikenal (pakai instagram|threads|facebook).' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(WORKFORCE_PATH)}`, url))
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = Array.isArray(roles) ? roles.map((r: { role: string }) => r.role) : []
  if (!list.some((role) => ADMIN_ROLES.includes(role))) {
    return NextResponse.json({ error: 'Fitur ini khusus admin & super admin.' }, { status: 403 })
  }

  if (!configured(channel)) {
    return NextResponse.redirect(new URL(`${WORKFORCE_PATH}?meta=error&msg=${encodeURIComponent('Kredensial Meta belum diset di server.')}`, url))
  }

  const state = crypto.randomBytes(24).toString('hex')
  const target = authorizeUrl(channel, state)
  if (!target) return NextResponse.json({ error: 'Gagal membangun URL OAuth.' }, { status: 400 })

  const res = NextResponse.redirect(target)
  res.cookies.set('meta_oauth', JSON.stringify({ state, channel, uid: user.id }), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600,
  })
  return res
}
