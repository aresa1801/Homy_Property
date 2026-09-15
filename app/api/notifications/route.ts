import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export type NotificationItem = {
  id: string
  kind: string
  title: string
  body: string | null
  href: string | null
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

/** Daftar notifikasi pengguna + jumlah belum dibaca. */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: [], unread: 0, authenticated: false })

  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 50)
  const { data, error } = await supabase
    .from('notifications')
    .select('id,kind,title,body,href,data,read_at,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return NextResponse.json({ error: 'Unable to load notifications' }, { status: 500 })

  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null)
  return NextResponse.json({ data: (data ?? []) as NotificationItem[], unread: count ?? 0, authenticated: true })
}

/** Tandai dibaca: satu item, semua item, atau hapus semua yang sudah dibaca. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let body: { action?: string; id?: string } = {}
  try { body = (await request.json()) as { action?: string; id?: string } } catch { /* kosong */ }
  const action = String(body.action ?? '')
  const now = new Date().toISOString()

  if (action === 'read') {
    if (!body.id) return NextResponse.json({ error: 'ID notifikasi wajib' }, { status: 400 })
    const { error } = await supabase.from('notifications').update({ read_at: now }).eq('id', body.id).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Gagal memperbarui notifikasi' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'read_all') {
    const { error } = await supabase.from('notifications').update({ read_at: now }).eq('user_id', user.id).is('read_at', null)
    if (error) return NextResponse.json({ error: 'Gagal memperbarui notifikasi' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'clear_read') {
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id).not('read_at', 'is', null)
    if (error) return NextResponse.json({ error: 'Gagal menghapus notifikasi' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: `Aksi tidak dikenal: ${action}` }, { status: 400 })
}
