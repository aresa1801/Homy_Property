import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listConnections, configured, redirectUri, removeConnection, type Channel } from '@/lib/meta'

export const runtime = 'nodejs'

const ADMIN_ROLES = ['admin', 'super_admin']

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Masuk sebagai admin.', needsAuth: true }, { status: 401 }) }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = Array.isArray(roles) ? roles.map((r: { role: string }) => r.role) : []
  if (!list.some((role) => ADMIN_ROLES.includes(role))) {
    return { error: NextResponse.json({ error: 'Fitur ini khusus admin & super admin.' }, { status: 403 }) }
  }
  return { user }
}

/** GET — status koneksi Instagram/Threads/Facebook (tanpa token). */
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const connections = await listConnections()
  return NextResponse.json({
    ok: true,
    configured: { instagram: configured('instagram'), threads: configured('threads'), facebook: configured('facebook') },
    redirectUri: redirectUri(),
    connections,
  })
}

/** POST — putuskan koneksi. */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  let body: { action?: string; channel?: string } = {}
  try { body = await request.json() } catch { /* kosong */ }
  if (body.action !== 'disconnect') return NextResponse.json({ error: 'action tidak dikenal' }, { status: 400 })
  const channel = body.channel as Channel
  if (channel !== 'instagram' && channel !== 'threads' && channel !== 'facebook') return NextResponse.json({ error: 'channel tidak valid' }, { status: 400 })
  const ok = await removeConnection(channel)
  if (!ok) return NextResponse.json({ error: 'Gagal memutuskan koneksi.' }, { status: 400 })
  return NextResponse.json({ ok: true, connections: await listConnections() })
}
