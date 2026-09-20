import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { buildAgreementPdf } from '@/lib/agreement-pdf'
import {
  PARTNER_ROLES,
  downloadIdentityImage,
  loadAgreementSource,
  resolveAgreementTarget,
  roleSlug,
  serviceClient,
  slug,
} from '@/lib/agreement-doc'
import type { VerificationRole } from '@/lib/verification'

/**
 * Unduh DRAF Perjanjian Kerja Sama (belum ditandatangani).
 *
 * Draf memuat seluruh data diri dari formulir perjanjian, salinan KTP (JPEG),
 * nomor serial draf (mis. `DRF/AGN/20260920/7F3A2C`), timestamp pembuatan, dan
 * tanda air "DRAFT" pada setiap halaman — seperti pratinjau dokumen di DocuSign.
 *
 *  - Mitra: `GET /api/agreement/draft?role=agent`
 *  - Admin: `GET /api/agreement/draft?role=agent&user_id=<uuid>`
 */
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const url = new URL(request.url)
  const role = String(url.searchParams.get('role') ?? '') as VerificationRole
  if (!PARTNER_ROLES.includes(role)) return NextResponse.json({ error: 'Peran mitra tidak valid' }, { status: 400 })

  const target = await resolveAgreementTarget(
    supabase as unknown as { from: (table: string) => any },
    user,
    String(url.searchParams.get('user_id') ?? '').trim(),
  )
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status })

  const source = await loadAgreementSource(admin, target.targetUserId, role)
  if (!source) return NextResponse.json({ error: 'Lengkapi dulu data perjanjian Anda' }, { status: 404 })

  const generatedAt = new Date().toISOString()
  const identityImage = await downloadIdentityImage(admin, source.record)
  const pdf = buildAgreementPdf({ ...source, mode: 'draft', generatedAt, identityImage })

  const fileName = `DRAFT-Perjanjian-Kerja-Sama-Homy-${slug(roleSlug(role))}-${slug(String(source.partner.fullName ?? 'Mitra'))}.pdf`

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export const runtime = 'nodejs'
