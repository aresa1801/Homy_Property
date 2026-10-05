import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publishContentItem } from '@/lib/ai-workforce'
import { clientKey, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const ADMIN_ROLES = ['admin', 'super_admin']

/** Terbitkan draf konten yang SUDAH disetujui ke Instagram / Threads. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Masuk sebagai admin.', needsAuth: true }, { status: 401 })
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = Array.isArray(roles) ? roles.map((r: { role: string }) => r.role) : []
  if (!list.some((role) => ADMIN_ROLES.includes(role))) return NextResponse.json({ error: 'Khusus admin & super admin.' }, { status: 403 })

  const limit = rateLimit(clientKey(request, 'meta-publish'), 10, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let body: { itemId?: string } = {}
  try { body = await request.json() } catch { /* kosong */ }
  const itemId = String(body.itemId || '').trim()
  if (!itemId) return NextResponse.json({ error: 'itemId wajib.' }, { status: 400 })

  const result = await publishContentItem(user.id, itemId)
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Gagal menerbitkan.' }, { status: 400 })
  return NextResponse.json({ ok: true, channel: result.channel, externalId: result.externalId })
}
