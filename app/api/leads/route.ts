import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientKey } from '@/lib/rate-limit'
import { PARTNER_KIND_ORDER } from '@/lib/partnership'

const KINDS = [...PARTNER_KIND_ORDER, 'contact']
/** Jenis yang wajib melampirkan nama badan/kantor. */
const REQUIRES_COMPANY = ['agency', 'institution', 'notary']

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const clean = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
/** Ambil bilangan bulat positif dalam rentang aman (0 = diabaikan/null). */
const toInt = (value: unknown, min = 0, max = 1_000_000) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  const rounded = Math.floor(num)
  if (rounded < min || rounded > max) return null
  return rounded
}
/** Daftar nilai dari array / string dipisah koma, dibatasi jumlahnya. */
const toList = (value: unknown, maxItems = 10, maxItem = 60) => {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const out = items.map((item) => String(item).trim().slice(0, maxItem)).filter(Boolean)
  return Array.from(new Set(out)).slice(0, maxItems)
}

/** Form publik: pendaftaran mitra/partnership (agen, pemilik, agensi, institusi, notaris) + pesan kontak. */
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
  const company = clean(body.company, 200)

  if (!fullName) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 })
  if (kind !== 'contact' && !phone) return NextResponse.json({ error: 'Nomor telepon wajib diisi' }, { status: 400 })
  if (kind === 'contact' && message.length < 10) return NextResponse.json({ error: 'Pesan minimal 10 karakter' }, { status: 400 })
  if (REQUIRES_COMPANY.includes(kind) && !company) return NextResponse.json({ error: 'Nama lembaga/kantor wajib diisi' }, { status: 400 })
  if (kind !== 'contact' && body.agree_terms !== true) return NextResponse.json({ error: 'Persetujuan Syarat & Ketentuan wajib dicentang' }, { status: 400 })

  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const currentYear = new Date().getFullYear()
  const { data, error } = await admin
    .from('partner_leads')
    .insert({
      kind,
      full_name: fullName,
      email,
      phone: phone || null,
      company: company || null,
      position: clean(body.position, 120) || null,
      city: clean(body.city, 120) || null,
      province: clean(body.province, 120) || null,
      website: clean(body.website, 200) || null,
      branches: toInt(body.branches, 1, 100_000),
      license_no: clean(body.license_no, 120) || null,
      entity_type: clean(body.entity_type, 80) || null,
      npwp: clean(body.npwp, 40) || null,
      founded_year: toInt(body.founded_year, 1900, currentYear + 1),
      team_size: toInt(body.team_size, 1, 1_000_000),
      listings_ready: toInt(body.listings_ready, 1, 1_000_000),
      coverage_area: clean(body.coverage_area, 200) || null,
      services: toList(body.services).join(', ') || null,
      focus_areas: toList(body.focus_areas).join(', ') || null,
      preferred_contact: clean(body.preferred_contact, 40) || null,
      doc_url: clean(body.doc_url, 300) || null,
      agree_terms: body.agree_terms === true,
      message: message || null,
      status: 'new',
      source: 'web',
      metadata: {
        user_agent: request.headers.get('user-agent')?.slice(0, 200) ?? null,
        contact_time: clean(body.contact_time, 60) || null,
        volume: clean(body.volume, 60) || null,
      },
    })
    .select('id,kind,status,created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Gagal menyimpan pengajuan' }, { status: 500 })
  return NextResponse.json({ data, ok: true }, { status: 201 })
}
