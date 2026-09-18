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
import crypto from 'crypto'
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

/**
 * Diagnosa: apakah kunci privat VAPID di server benar-benar cocok dengan kunci publik
 * yang dipakai browser untuk berlangganan? Kalau tidak cocok, push service akan menolak
 * (401) walau konfigurasi "terlihat" lengkap.
 */
export function vapidKeyPairMatches(): boolean {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  try {
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.setPrivateKey(Buffer.from(VAPID_PRIVATE_KEY, 'base64url'))
    return ecdh.getPublicKey().toString('base64url') === VAPID_PUBLIC_KEY
  } catch {
    return false
  }
}

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string }

export type PushMessage = {
  title: string
  body?: string | null
  href?: string | null
  kind?: string | null
}

type SendResult = { ok: boolean; error?: string }

/** Kirim satu pesan ke satu langganan. */
async function sendOne(row: PushSubscriptionRow, payload: PushMessage): Promise<SendResult> {
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
    return { ok: true }
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    // 404/410 = langganan sudah tidak ada di browser → bersihkan dari DB.
    if (status === 404 || status === 410) {
      try {
        const admin = serviceClient()
        if (admin) await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
      } catch { /* diamkan */ }
      return { ok: true, error: 'langganan mati (' + status + ') dihapus' }
    }
    const message = (error instanceof Error ? error.message : String(error)) || 'unknown'
    console.error('[homy-push] gagal kirim:', status ?? '', message)
    return { ok: false, error: (status ? status + ' ' : '') + message }
  }
}

/** Detail hasil pengiriman push ke satu user (dipakai endpoint tes & diagnosa). */
export type PushDeliveryReport = {
  sent: number
  totalSubscriptions: number
  failures: string[]
}

/** Kirim push ke semua perangkat milik user tertentu, sekaligus mengembalikan detail kegagalan. */
export async function sendPushToUserVerbose(userId: string, payload: PushMessage): Promise<PushDeliveryReport> {
  const report: PushDeliveryReport = { sent: 0, totalSubscriptions: 0, failures: [] }
  if (!userId || !configure()) {
    if (userId) report.failures.push('VAPID belum dikonfigurasi di server')
    return report
  }
  try {
    const admin = serviceClient()
    if (!admin) {
      report.failures.push('service client tidak tersedia')
      return report
    }
    const { data, error } = await admin
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('user_id', userId)
      .limit(20)
    if (error) {
      report.failures.push('baca langganan gagal: ' + error.message)
      return report
    }
    const rows = (data ?? []) as PushSubscriptionRow[]
    report.totalSubscriptions = rows.length
    if (!rows.length) return report
    for (let i = 0; i < rows.length; i += 5) {
      const chunk = rows.slice(i, i + 5)
      const results = await Promise.all(chunk.map((row) => sendOne(row, payload)))
      results.forEach((result, index) => {
        if (result.ok) report.sent += 1
        else report.failures.push(chunk[index].endpoint.slice(0, 60) + ' → ' + (result.error ?? 'gagal'))
      })
    }
    if (report.sent) {
      await admin
        .from('push_subscriptions')
        .update({ last_seen_at: new Date().toISOString() })
        .in('endpoint', rows.map((row) => row.endpoint))
    }
    return report
  } catch (error) {
    report.failures.push(error instanceof Error ? error.message : String(error))
    return report
  }
}

/** Kirim push ke semua perangkat milik user tertentu. Return jumlah terkirim. */
export async function sendPushToUser(userId: string, payload: PushMessage): Promise<number> {
  const report = await sendPushToUserVerbose(userId, payload)
  return report.sent
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
