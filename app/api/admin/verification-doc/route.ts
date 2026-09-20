import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { VERIFICATION_BUCKET } from '@/lib/verification'

export const runtime = 'nodejs'

const DOC_FIELDS = ['identity_doc_path', 'selfie_doc_path', 'npwp_doc_path', 'supporting_doc_path'] as const

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false } })
}

/** Admin membuka dokumen verifikasi mitra (bucket privat) — URL bertanda tangan 15 menit. */
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ error: 'Harus masuk terlebih dahulu' }, { status: 401 })

  const admin = adminClient()
  if (!admin) return NextResponse.json({ error: 'Konfigurasi server belum lengkap' }, { status: 500 })

  const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', user.id)
  const roles = (roleRows ?? []).map((row) => String(row.role))
  if (!roles.includes('admin') && !roles.includes('super_admin')) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const params = new URL(request.url).searchParams
  const id = String(params.get('id') ?? '')
  const field = String(params.get('field') ?? 'identity_doc_path')
  if (!id || !DOC_FIELDS.includes(field as (typeof DOC_FIELDS)[number])) {
    return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
  }

  const { data: record } = await admin
    .from('partner_verifications')
    .select('id,user_id,identity_doc_path,selfie_doc_path,npwp_doc_path,supporting_doc_path')
    .eq('id', id)
    .maybeSingle()
  if (!record) return NextResponse.json({ error: 'Data verifikasi tidak ditemukan' }, { status: 404 })

  const path = String((record as Record<string, unknown>)[field] ?? '')
  if (!path || !path.startsWith(String(record.user_id) + '/')) {
    return NextResponse.json({ error: 'Berkas tidak tersedia' }, { status: 404 })
  }

  const { data: signed, error } = await admin.storage.from(VERIFICATION_BUCKET).createSignedUrl(path, 900)
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'Gagal membuka berkas' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl, { status: 302 })
}
