import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { buildOwnerAgreementPdf } from '@/lib/owner-agreement-pdf'
import { isActiveAgent } from '@/lib/referral'
import type { OwnerAgreementData } from '@/lib/owner-agreement'

/**
 * Unduh PDF Surat Perjanjian Pemasaran, Penjualan & Penyewaan Properti
 * antara Pemilik Properti dan Agen Properti (dokumen mandiri, tanpa kop Homy).
 *
 *  POST /api/agent/owner-agreement
 *    body: { data: OwnerAgreementData, mode?: 'final' | 'template' }
 *
 * Hanya akun dengan peran Agen Properti (atau admin) yang dapat mengunduh.
 */

export const runtime = 'nodejs'
export const maxDuration = 60

const LIMIT = 300

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function text(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value)
  const trimmed = raw.trim()
  return trimmed ? trimmed.slice(0, LIMIT) : ''
}

function normalizeParty(input: unknown): OwnerAgreementData['owner'] {
  const row = (input ?? {}) as Record<string, unknown>
  return {
    name: text(row.name),
    identityType: text(row.identityType) || null,
    identityNumber: text(row.identityNumber) || null,
    address: text(row.address) || null,
    city: text(row.city) || null,
    province: text(row.province) || null,
    phone: text(row.phone) || null,
    email: text(row.email) || null,
    occupation: text(row.occupation) || null,
    companyName: text(row.companyName) || null,
    npwp: text(row.npwp) || null,
    representative: text(row.representative) || null,
  }
}

function normalizeData(input: Record<string, unknown>): OwnerAgreementData {
  const property = (input.property ?? {}) as Record<string, unknown>
  const terms = (input.terms ?? {}) as Record<string, unknown>
  const witnesses = Array.isArray(input.witnesses) ? input.witnesses.slice(0, 4) : []
  return {
    number: text(input.number) || null,
    place: text(input.place) || null,
    date: text(input.date) || null,
    owner: normalizeParty(input.owner),
    agent: normalizeParty(input.agent),
    property: {
      propertyType: text(property.propertyType) || null,
      title: text(property.title) || null,
      address: text(property.address) || null,
      city: text(property.city) || null,
      province: text(property.province) || null,
      postalCode: text(property.postalCode) || null,
      certificateType: text(property.certificateType) || null,
      certificateNumber: text(property.certificateNumber) || null,
      landArea: text(property.landArea) || null,
      buildingArea: text(property.buildingArea) || null,
      bedrooms: text(property.bedrooms) || null,
      bathrooms: text(property.bathrooms) || null,
      floors: text(property.floors) || null,
      yearBuilt: text(property.yearBuilt) || null,
      facilities: text(property.facilities) || null,
      imNumber: text(property.imNumber) || null,
      documents: Array.isArray(property.documents) ? property.documents.slice(0, 12).map((item) => text(item)).filter(Boolean) : [],
      keyHandover: Boolean(property.keyHandover),
      notes: text(property.notes) || null,
    },
    terms: {
      listingMode: text(terms.listingMode) || null,
      salePrice: text(terms.salePrice) || null,
      minPrice: text(terms.minPrice) || null,
      rentPrice: text(terms.rentPrice) || null,
      rentPeriod: text(terms.rentPeriod) || null,
      negotiable: Boolean(terms.negotiable),
      feePercent: text(terms.feePercent) || null,
      feePayer: text(terms.feePayer) || null,
      feeTiming: text(terms.feeTiming) || null,
      exclusivity: text(terms.exclusivity) || null,
      durationMonths: text(terms.durationMonths) || null,
      startDate: text(terms.startDate) || null,
      marketingScope: text(terms.marketingScope) || null,
      specialTerms: text(terms.specialTerms) || null,
    },
    witnesses: witnesses.map((row) => {
      const item = (row ?? {}) as Record<string, unknown>
      return { name: text(item.name) || null, address: text(item.address) || null, phone: text(item.phone) || null }
    }),
  }
}

function slug(value: string) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'dokumen'
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const agent = await isActiveAgent(admin as never, user.id)
  const adminRole = agent
    ? true
    : Boolean(
        (await admin.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'super_admin']).limit(1)).data?.length,
      )
  if (!agent && !adminRole) {
    return NextResponse.json({ error: 'Fitur ini khusus untuk akun Agen Properti (atau admin).' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }) }

  const mode = String(body.mode ?? 'final') === 'template' ? 'template' : 'final'
  const rawData = (body.data ?? body) as Record<string, unknown>
  const data = normalizeData(rawData ?? {})

  if (mode === 'final' && !data.owner.name && !data.property.address) {
    return NextResponse.json({ error: 'Data perjanjian masih kosong. Isi minimal data Pemilik, Properti, dan Agen.' }, { status: 400 })
  }

  const pdf = buildOwnerAgreementPdf({ data, mode, seed: user.id })

  const label = mode === 'template'
    ? 'Formulir'
    : [data.owner.name || 'Pemilik', data.property.city || data.property.title || 'Properti'].map(slug).join('-')
  const fileName = `Perjanjian-Pemilik-Agen-${label}.pdf`

  await admin
    .from('audit_logs')
    .insert({
      actor_id: user.id,
      action: mode === 'template' ? 'owner_agreement.template' : 'owner_agreement.generate',
      entity_type: 'owner_agreement',
      entity_id: null,
      metadata: {
        mode,
        owner: data.owner.name || null,
        property: [data.property.title, data.property.city].map((v) => String(v ?? '').trim()).filter(Boolean).join(' · ') || null,
        fee_percent: data.terms.feePercent || null,
      },
    })
    .then(() => {}, () => {})

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
