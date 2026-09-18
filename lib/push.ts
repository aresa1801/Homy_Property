/**
 * Homy — Web Push (notifikasi ke HP lewat service worker).
 *
 * Alur: notifikasi in-app (lib/notifications.ts) → tabel `notifications` →
 *       sekaligus dikirim ke semua langganan push milik user (`push_subscriptions`).
 *
 * Kunci VAPID publik memang boleh publik (dipakai browser untuk subscribe);
 * kunci privat hanya di server (env VAPID_PRIVATE_KEY).
 * Semua fungsi tidak pernah melempar error: kegagalan push tidak boleh merusak alur utama.
 */
import webpush from 'web-push'
import { serviceClient } from '@/lib/visits'

/** Kunci publik VAPID. Aman dibagikan; fallback ditulis agar tidak bergantung env saat build. */
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BC9hD75YikNAg0Vdq8GY_sgRHu2PCfmmHpi0rXGYotnck9TRT-0lVozkDfjZ0kruQpDBCpzJr6kfZgL_66dp_x4'

const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:rahadhyan@gmail.com'

let ready = false

function configure(): boolean {
  if (ready) return true
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    ready = true
    return true
  } catch (error) {
    console.error('[homy-push] VAPID tidak valid:', error instanceof Error ? error.message : error)
    return false
  }
}

/** true kalau server punya kunci lengkap dan siap mengirim push. */
export function pushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string }

export type PushMessage = {
  title: string
  body?: string | null
  href?: string | null
  kind?: string | null
}

/** Kirim satu pesan ke satu langganan. Return true kalau terkirim (atau langganan sudah mati). */
async function sendOne(row: PushSubscriptionRow, payload: PushMessage): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify({
        title: payload.title,
        body: payload.body ?? '',
        href: payload.href ?? '/',
        kind: payload.kind ?? 'system',
        at: new Date().toISOString(),
      }),
      { TTL: 60 * 60 * 24, urgency: 'normal' },
    )
    return true
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    // 404/410 = langganan sudah tidak ada di browser → bersihkan dari DB.
    if (status === 404 || status === 410) {
      try {
        const admin = serviceClient()
        if (admin) await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
      } catch { /* diamkan */ }
      return true
    }
    console.error('[homy-push] gagal kirim:', status ?? '', error instanceof Error ? error.message : error)
    return false
  }
}

/** Kirim push ke semua perangkat milik user tertentu. Return jumlah terkirim. */
export async function sendPushToUser(userId: string, payload: PushMessage): Promise<number> {
  if (!userId || !configure()) return 0
  try {
    const admin = serviceClient()
    if (!admin) return 0
    const { data, error } = await admin
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('user_id', userId)
      .limit(20)
    if (error || !data?.length) return 0
    const rows = data as PushSubscriptionRow[]
    let sent = 0
    // Kirim berurutan dalam kelompok kecil supaya tidak membebani runtime serverless.
    for (let i = 0; i < rows.length; i += 5) {
      const chunk = rows.slice(i, i + 5)
      const results = await Promise.all(chunk.map((row) => sendOne(row, payload)))
      sent += results.filter(Boolean).length
    }
    if (sent) {
      const endpoints = rows.map((row) => row.endpoint)
      await admin.from('push_subscriptions').update({ last_seen_at: new Date().toISOString() }).in('endpoint', endpoints)
    }
    return sent
  } catch (error) {
    console.error('[homy-push] error:', error instanceof Error ? error.message : error)
    return 0
  }
}

/** Kirim push untuk sekumpulan notifikasi (biasanya 1 user per baris). */
export async function sendPushForNotifications(rows: PushMessage & { userId: string }[]): Promise<number> {
  if (!configure() || !rows.length) return 0
  let sent = 0
  for (const row of rows.slice(0, 25)) {
    sent += await sendPushToUser(row.userId, row)
  }
  return sent
}
