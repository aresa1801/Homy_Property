import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientKey } from '@/lib/rate-limit'

const KINDS = ['agent', 'owner', 'agency', 'institution', 'contact']

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const clean = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/** Form publik: pendaftaran mitra/partnership institusi + pesan kontak. */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, 'leads'), 8, 60_000)
  if (!limit.ok) return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' }, { status: 429 })

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 }) }

  const kind = clean(body.kind, 24) || 'contact'
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Jenis pengajuan tidak dikenal' }, { status: 400 })

  const fullName = clean(body.full_name ?? body.fullName, 160)
  const email = clean(body.email, 200).toLowerCase()
  const phone = clean(body.phone, 40)
  const message = clean(body.message, 2000)

  if (!fullName) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 })
  if (kind !== 'contact' && !phone) return NextResponse.json({ error: 'Nomor telepon wajib diisi' }, { status: 400 })
  if (kind === 'contact' && message.length < 10) return NextResponse.json({ error: 'Pesan minimal 10 karakter' }, { status: 400 })

  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const branches = Number(body.branches)
  const { data, error } = await admin
    .from('partner_leads')
    .insert({
      kind,
      full_name: fullName,
      email,
      phone: phone || null,
      company: clean(body.company, 200) || null,
      position: clean(body.position, 120) || null,
      city: clean(body.city, 120) || null,
      province: clean(body.province, 120) || null,
      website: clean(body.website, 200) || null,
      branches: Number.isFinite(branches) && branches > 0 ? Math.floor(branches) : null,
      license_no: clean(body.license_no, 120) || null,
      message: message || null,
      status: 'new',
      source: 'web',
      metadata: { user_agent: request.headers.get('user-agent')?.slice(0, 200) ?? null },
    })
    .select('id,kind,status,created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Gagal menyimpan pengajuan' }, { status: 500 })
  return NextResponse.json({ data, ok: true }, { status: 201 })
}
