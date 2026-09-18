import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/visits'
import { sendPushToUserVerbose, pushConfigured, vapidKeyPairMatches } from '@/lib/push'

export const runtime = 'nodejs'

/**
 * Kirim notifikasi percobaan ke semua perangkat milik pengguna yang sedang login.
 * Dipakai tombol "Kirim tes notifikasi" supaya pengguna bisa memastikan HP-nya benar-benar menerima.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  if (!pushConfigured() || !vapidKeyPairMatches()) {
    return NextResponse.json({ error: 'Push belum dikonfigurasi di server.' }, { status: 503 })
  }

  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Push tidak tersedia saat ini.' }, { status: 503 })

  const { count } = await admin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  if (!count) {
    return NextResponse.json({ error: 'Belum ada perangkat yang mengaktifkan notifikasi.', devices: 0 }, { status: 400 })
  }

  const report = await sendPushToUserVerbose(user.id, {
    title: 'Notifikasi Homy aktif 🎉',
    body: 'Tes berhasil. Pemberitahuan pertanyaan pembeli & jadwal kunjungan akan muncul seperti ini.',
    href: '/dashboard',
    kind: 'system',
  })

  return NextResponse.json({ ok: report.sent > 0, sent: report.sent, devices: count, failures: report.failures })
}
