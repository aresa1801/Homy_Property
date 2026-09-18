import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/visits'
import { pushConfigured, VAPID_PUBLIC_KEY } from '@/lib/push'

export const runtime = 'nodejs'

type SubscriptionBody = {
  subscription?: {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }
  endpoint?: string
  userAgent?: string
}

/** Status langganan push untuk perangkat/user yang sedang login. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const configured = pushConfigured()
  if (!user) return NextResponse.json({ configured, publicKey: VAPID_PUBLIC_KEY, authenticated: false, devices: 0 })
  const admin = serviceClient()
  let devices = 0
  if (admin) {
    const { count } = await admin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    devices = count ?? 0
  }
  return NextResponse.json({ configured, publicKey: VAPID_PUBLIC_KEY, authenticated: true, devices })
}

/** Simpan/perbarui langganan push perangkat ini. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let body: SubscriptionBody = {}
  try { body = (await request.json()) as SubscriptionBody } catch { /* body kosong */ }

  const endpoint = String(body.subscription?.endpoint ?? body.endpoint ?? '').trim()
  const p256dh = String(body.subscription?.keys?.p256dh ?? '').trim()
  const auth = String(body.subscription?.keys?.auth ?? '').trim()
  if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: 'Langganan push tidak lengkap.' }, { status: 400 })

  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Push tidak tersedia saat ini.' }, { status: 503 })

  const row = {
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: String(body.userAgent ?? '').slice(0, 300) || null,
    last_seen_at: new Date().toISOString(),
  }
  const { error } = await admin.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  if (error) {
    console.error('[homy-push] simpan langganan gagal:', error.message)
    return NextResponse.json({ error: 'Gagal menyimpan langganan notifikasi.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/** Hapus langganan (saat pengguna menonaktifkan notifikasi di perangkat ini). */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let body: SubscriptionBody = {}
  try { body = (await request.json()) as SubscriptionBody } catch { /* body kosong */ }
  const endpoint = String(body.subscription?.endpoint ?? body.endpoint ?? '').trim()

  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Push tidak tersedia saat ini.' }, { status: 503 })

  if (endpoint) {
    await admin.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint)
  } else {
    await admin.from('push_subscriptions').delete().eq('user_id', user.id)
  }
  return NextResponse.json({ ok: true })
}
