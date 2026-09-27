import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { referralAdmin, resolveParticipantByCode } from '@/lib/referral'

export const runtime = 'nodejs'

/**
 * Tautan referral agen: https://homyproperty.id/r/<KODE>
 * - Catat klik (untuk statistik mitra).
 * - Simpan kode di cookie `homy_ref` (30 hari) supaya atribusi tetap terbaca
 *   saat calon mitra mengirim verifikasi lewat /api/verify.
 * - Arahkan ke halaman pendaftaran mitra.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const url = new URL(request.url)
  const admin = referralAdmin()
  const participant = admin ? await resolveParticipantByCode(admin, code).catch(() => null) : null

  if (admin && participant) {
    try {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? ''
      await admin.from('referral_clicks').insert({
        code: participant.code,
        referrer_id: participant.user_id,
        ip_hash: ip ? createHash('sha256').update(ip).digest('hex').slice(0, 32) : null,
        user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300) || null,
      })
    } catch { /* statistik klik bersifat opsional */ }
  }

  const basePath = url.searchParams.get('to') || '/verify'
  const target = new URL(basePath.startsWith('/') ? basePath : '/verify', url.origin)
  if (participant) target.searchParams.set('ref', participant.code)

  const response = NextResponse.redirect(target, 307)
  if (participant) {
    response.cookies.set('homy_ref', participant.code, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
    })
  }
  return response
}
