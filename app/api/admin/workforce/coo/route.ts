import { NextResponse } from 'next/server'
import { AiError } from '@/lib/ai'
import { cooChat, listChat, listWorkforce } from '@/lib/ai-workforce'
import { createClient } from '@/lib/supabase/server'
import { clientKey, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const ADMIN_ROLES = ['admin', 'super_admin']

/** Hanya admin/super_admin yang boleh mengobrol dengan COO. */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Masuk sebagai admin untuk memakai fitur ini.', needsAuth: true }, { status: 401 }) }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = Array.isArray(roles) ? roles.map((r: { role: string }) => r.role) : []
  if (!list.some((role) => ADMIN_ROLES.includes(role))) {
    return { error: NextResponse.json({ error: 'Fitur ini khusus admin & super admin.' }, { status: 403 }) }
  }
  return { user }
}

/** GET — riwayat percakapan dengan COO. */
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  try {
    const messages = await listChat(60)
    return NextResponse.json({ ok: true, messages })
  } catch (error) {
    console.error('[homy-workforce:coo:GET]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Gagal memuat percakapan.' }, { status: 500 })
  }
}

/** POST — kirim pesan ke COO; COO bisa membuat target & menugaskan kerja. */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const actor = guard.user

  const limit = rateLimit(clientKey(request, 'workforce-coo'), 20, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let message = ''
  try { const b = (await request.json()) as { message?: string }; message = String(b.message ?? '') } catch { /* kosong */ }
  if (!message.trim()) return NextResponse.json({ error: 'Pesan kosong' }, { status: 400 })

  try {
    const result = await cooChat(actor.id, message)
    const payload = await listWorkforce()
    return NextResponse.json({ ok: true, reply: result.reply, actions: result.actions, ...payload })
  } catch (error) {
    const aiError = error instanceof AiError ? error : null
    console.error('[homy-workforce:coo:POST]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: aiError?.message ?? 'COO sedang tidak bisa menjawab. Coba lagi sebentar lagi.' }, { status: aiError?.status ?? 502 })
  }
}
