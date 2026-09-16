/**
 * Konfirmasi Ketertarikan — API.
 *
 * GET   /api/interest                 → daftar konfirmasi milik user (pembeli/penyewa)
 * GET   /api/interest?scope=leads     → daftar konfirmasi atas listing milik agen/pemilik
 * POST  /api/interest                 → simpan (upsert) konfirmasi + analisis Homy AI
 * PATCH /api/interest                 → agen/pemilik/admin mengubah tahap negosiasi + catatan
 * DELETE/api/interest?id=             → pembeli membatalkan konfirmasinya
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/visits'
import { notifyUser } from '@/lib/notifications'
import { analyzeInterest, interestModel, scoreInterest, INTEREST_STAGES, type InterestAnalysis } from '@/lib/interest'

export const maxDuration = 60

const SELECT = 'id,property_id,user_id,agent_id,owner_id,intent,readiness,stage,budget,budget_flexible,timeline,financing,down_payment,has_other_options,comparison_notes,priorities,deal_breakers,contact_preference,score,ai_verdict,ai_confidence,ai_summary,ai_signals,ai_model,ai_analyzed_at,agent_notes,created_at,updated_at,property:properties(id,title,city,district,province,listing_type,property_type,price,price_period,status,property_media(storage_path,media_type,sort_order))'

const STAGE_TO_INQUIRY: Record<string, string> = {
  interest: 'open',
  viewing: 'viewing',
  negotiation: 'negotiation',
  offer: 'negotiation',
  deal: 'closed',
  lost: 'closed',
}

function clean(value: unknown, max = 600): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text.slice(0, max) : null
}

function money(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ authenticated: false, error: 'Masuk dulu untuk melihat konfirmasi ketertarikan.' }, { status: 401 })

  const url = new URL(request.url)
  const scope = url.searchParams.get('scope') ?? 'mine'
  let query = supabase.from('interest_confirmations').select(SELECT).order('updated_at', { ascending: false }).limit(60)
  if (scope === 'mine') query = query.eq('user_id', user.id)

  const { data, error } = await query
  if (error) {
    console.error('[interest] GET gagal:', error.message)
    return NextResponse.json({ authenticated: true, data: [], error: 'Gagal memuat konfirmasi ketertarikan.' }, { status: 502 })
  }

  // Untuk agen/pemilik/admin: lengkapi identitas calon pembeli (nama, email, telepon).
  const rows = (data ?? []) as Array<Record<string, unknown>>
  if (scope === 'leads' && rows.length) {
    const admin = serviceClient()
    if (admin) {
      const ids = Array.from(new Set(rows.map((row) => String(row.user_id ?? '')).filter(Boolean))).slice(0, 40)
      const [{ data: profiles }, users] = await Promise.all([
        admin.from('profiles').select('id,full_name,phone').in('id', ids),
        Promise.all(ids.map((id) => admin.auth.admin.getUserById(id).then((r) => r.data?.user ?? null).catch(() => null))),
      ])
      const nameMap: Record<string, { name?: string; email?: string; phone?: string }> = {}
      for (const profile of profiles ?? []) nameMap[profile.id] = { name: profile.full_name ?? undefined, phone: profile.phone ?? undefined }
      for (const user of users) if (user?.id) nameMap[user.id] = { ...(nameMap[user.id] ?? {}), email: user.email ?? undefined }
      for (const row of rows) row.buyer = nameMap[String(row.user_id ?? '')] ?? null
    }
  }

  return NextResponse.json({ authenticated: true, scope, data: rows })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Masuk dulu untuk mengirim konfirmasi ketertarikan.' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { /* body kosong */ }

  const propertyId = clean(body.propertyId, 60)
  if (!propertyId || !/^[0-9a-f-]{36}$/i.test(propertyId)) return NextResponse.json({ error: 'Properti tidak valid.' }, { status: 400 })

  const { data: property } = await supabase
    .from('properties')
    .select('id,title,city,district,price,listing_type,price_period,owner_id,status')
    .eq('id', propertyId)
    .maybeSingle()
  if (!property) return NextResponse.json({ error: 'Properti tidak ditemukan.' }, { status: 404 })

  const ownerId = (property as { owner_id?: string | null }).owner_id ?? null
  if (ownerId && ownerId === user.id) return NextResponse.json({ error: 'Ini listing milik Anda sendiri.' }, { status: 400 })

  const input = {
    propertyId,
    intent: clean(body.intent, 20) ?? 'undecided',
    readiness: clean(body.readiness, 20) ?? 'exploring',
    budget: money(body.budget),
    budgetFlexible: Boolean(body.budgetFlexible),
    timeline: clean(body.timeline, 30),
    financing: clean(body.financing, 20) ?? 'unknown',
    downPayment: money(body.downPayment),
    hasOtherOptions: Boolean(body.hasOtherOptions),
    comparisonNotes: clean(body.comparisonNotes, 800),
    priorities: clean(body.priorities, 800),
    dealBreakers: clean(body.dealBreakers, 800),
    contactPreference: clean(body.contactPreference, 30),
  }
  const stage = INTEREST_STAGES.includes(clean(body.stage, 20) as never) ? String(clean(body.stage, 20)) : 'interest'
  const score = scoreInterest(input, Number((property as { price?: unknown }).price ?? 0))

  const payload = {
    property_id: propertyId,
    user_id: user.id,
    agent_id: ownerId,
    owner_id: ownerId,
    intent: input.intent,
    readiness: input.readiness,
    stage,
    budget: input.budget,
    budget_flexible: input.budgetFlexible,
    timeline: input.timeline,
    financing: input.financing,
    down_payment: input.downPayment,
    has_other_options: input.hasOtherOptions,
    comparison_notes: input.comparisonNotes,
    priorities: input.priorities,
    deal_breakers: input.dealBreakers,
    contact_preference: input.contactPreference,
    score,
  }

  const { data: saved, error } = await supabase
    .from('interest_confirmations')
    .upsert(payload, { onConflict: 'property_id,user_id' })
    .select(SELECT)
    .single()
  if (error || !saved) {
    console.error('[interest] simpan gagal:', error?.message)
    return NextResponse.json({ error: 'Gagal menyimpan konfirmasi ketertarikan.' }, { status: 500 })
  }

  // Analisis AI (best-effort): kesimpulan akan membeli / membandingkan / cari opsi lain.
  let analysis: (InterestAnalysis & { score?: number | null }) | null = null
  let final = saved
  if (body.analyze !== false) {
    analysis = await runAnalysis(supabase, {
      propertyId,
      userId: user.id,
      input,
      property: property as Record<string, unknown>,
      buyerName: null,
    })
    if (analysis) {
      const { data: refreshed } = await supabase.from('interest_confirmations').select(SELECT).eq('id', saved.id).maybeSingle()
      if (refreshed) final = refreshed
    }
  }

  // Sinkronkan ke pipeline prospek agen (tabel inquiries) supaya CRM tetap satu sumber.
  await syncInquiry({ ownerId, userId: user.id, propertyId, score, propertyTitle: String((property as { title?: string | null }).title ?? 'Properti'), verdict: final.ai_verdict ?? analysis?.verdict ?? null, ownerScoped: supabase })

  if (ownerId) {
    void notifyUser({
      userId: ownerId,
      kind: 'interest.new',
      title: 'Konfirmasi ketertarikan baru',
      body: `Ada calon ${input.intent === 'rent' ? 'penyewa' : 'pembeli'} mengonfirmasi ketertarikannya pada “${String((property as { title?: string | null }).title ?? 'listing Anda')}”.`,
      href: '/dashboard/agent/leads',
      data: { propertyId, interestId: final.id, verdict: final.ai_verdict ?? null, score },
    })
  }

  return NextResponse.json({ data: { ...final, analysis: analysis ?? undefined }, score })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Masuk dulu.' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { /* body kosong */ }
  const id = clean(body.id, 60)
  if (!id) return NextResponse.json({ error: 'ID konfirmasi tidak valid.' }, { status: 400 })

  // Akses dibuktikan lewat RLS user (pembeli/agen/pemilik). Admin memakai service-role.
  const { data: rows } = await supabase.from('interest_confirmations').select(SELECT).eq('id', id).limit(1)
  const row = (rows ?? [])[0] as Record<string, unknown> | undefined
  const isOwnerActor = row ? String(row.owner_id ?? '') === user.id || String(row.agent_id ?? '') === user.id : false
  const isBuyerActor = row ? String(row.user_id ?? '') === user.id : false

  let isAdmin = false
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  if ((roles ?? []).some((r: { role?: string }) => r.role === 'admin' || r.role === 'super_admin')) isAdmin = true

  if (!row || (!isOwnerActor && !isBuyerActor && !isAdmin)) return NextResponse.json({ error: 'Anda tidak berhak mengubah konfirmasi ini.' }, { status: 403 })

  const patch: Record<string, unknown> = {}
  const stage = clean(body.stage, 20)
  if (stage && (isOwnerActor || isAdmin)) {
    if (!INTEREST_STAGES.includes(stage as never)) return NextResponse.json({ error: 'Tahap tidak dikenal.' }, { status: 400 })
    patch.stage = stage
  }
  if (body.agentNotes !== undefined && (isOwnerActor || isAdmin)) patch.agent_notes = clean(body.agentNotes, 800)
  if (isOwnerActor || isAdmin) patch.last_agent_update_at = new Date().toISOString()
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Tidak ada perubahan.' }, { status: 400 })

  const admin = serviceClient()
  const writer = admin ?? supabase
  const { data: updated, error } = await writer.from('interest_confirmations').update(patch).eq('id', id).select(SELECT).single()
  if (error) {
    console.error('[interest] PATCH gagal:', error.message)
    return NextResponse.json({ error: 'Gagal memperbarui konfirmasi.' }, { status: 500 })
  }

  if (isOwnerActor && patch.stage && row) {
    const buyerId = String(row.user_id ?? '')
    void syncInquiry({
      ownerId: String(row.owner_id ?? ownerIdOf(row)) ?? null,
      userId: buyerId,
      propertyId: String(row.property_id ?? ''),
      score: Number(row.score ?? 0),
      propertyTitle: String(((row.property ?? null) as { title?: string } | null)?.title ?? 'Properti'),
      verdict: String(row.ai_verdict ?? '') || null,
      ownerScoped: admin ?? supabase,
      forceStage: String(patch.stage),
    })
    if (buyerId) {
      void notifyUser({
        userId: buyerId,
        kind: 'interest.updated',
        title: 'Progres konfirmasi ketertarikan Anda',
        body: `Status ketertarikan Anda pada “${String(((row.property ?? null) as { title?: string } | null)?.title ?? 'properti')}” diperbarui agen/pemilik.`,
        href: '/dashboard/user/interest',
        data: { interestId: id, stage: patch.stage },
      })
    }
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Masuk dulu.' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID konfirmasi tidak valid.' }, { status: 400 })
  const { error } = await supabase.from('interest_confirmations').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Gagal membatalkan konfirmasi.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function ownerIdOf(row: Record<string, unknown>) {
  return String(row.owner_id ?? '') || null
}

type RunArgs = {
  propertyId: string
  userId: string
  input: Parameters<typeof scoreInterest>[0]
  property: Record<string, unknown> | null
  buyerName?: string | null
}

/** Kumpulkan konteks + minta Homy AI menyimpulkan niat calon pembeli. */
async function runAnalysis(supabase: Awaited<ReturnType<typeof createClient>>, args: RunArgs) {
  const admin = serviceClient()
  const reader = admin ?? supabase
  const [conversations, visits, favorites] = await Promise.all([
    reader.from('ai_conversations').select('question,answer').eq('property_id', args.propertyId).eq('user_id', args.userId).order('created_at', { ascending: true }).limit(20),
    reader.from('visits').select('status,scheduled_at').eq('property_id', args.propertyId).eq('user_id', args.userId).limit(10),
    reader.from('favorites').select('property_id').eq('user_id', args.userId).limit(20),
  ])
  const favIds = ((favorites.data ?? []) as Array<{ property_id?: string }>).map((row) => String(row.property_id ?? '')).filter(Boolean)
  const { data: favProperties } = favIds.length
    ? await reader.from('properties').select('title,price').in('id', favIds)
    : { data: [] as unknown[] }

  try {
    const analysis = await analyzeInterest({
      input: args.input,
      property: args.property as never,
      buyerName: args.buyerName ?? null,
      conversations: (conversations.data ?? []) as Array<{ question?: string; answer?: string }>,
      visits: (visits.data ?? []) as Array<{ status?: string; scheduled_at?: string }>,
      favorites: (favProperties ?? []) as Array<{ title?: string; price?: number }>,
    })
    const model = interestModel()
    const patch: Record<string, unknown> = {
      ai_verdict: analysis.verdict,
      ai_confidence: analysis.confidence,
      ai_summary: analysis.summary,
      ai_signals: analysis.signals,
      ai_model: model,
      ai_analyzed_at: new Date().toISOString(),
    }
    if (analysis.suggestedStage && INTEREST_STAGES.includes(analysis.suggestedStage as never) && analysis.suggestedStage === 'viewing') patch.stage = 'viewing'
    await reader.from('interest_confirmations').update(patch).eq('property_id', args.propertyId).eq('user_id', args.userId)
    return { ...analysis, score: scoreInterest(args.input, Number(args.property?.price ?? 0)) }
  } catch (error) {
    console.error('[interest] analisis AI gagal:', error instanceof Error ? error.message : error)
    return null
  }
}

/** Catat/perbarui prospek di tabel inquiries agar pipeline agen tetap konsisten. */
async function syncInquiry(args: {
  ownerId: string | null
  userId: string
  propertyId: string
  score: number
  propertyTitle: string
  verdict: string | null
  ownerScoped: unknown
  forceStage?: string
}) {
  try {
    const admin = serviceClient()
    if (!admin) return
    const inquiryStatus = STAGE_TO_INQUIRY[String(args.forceStage ?? 'interest')] ?? 'open'
    const { data: existing } = await admin
      .from('inquiries')
      .select('id')
      .eq('property_id', args.propertyId)
      .eq('user_id', args.userId)
      .limit(1)
    const existingRow = (existing ?? [])[0] as { id?: string } | undefined
    if (existingRow?.id) {
      await admin.from('inquiries').update({ status: inquiryStatus, updated_at: new Date().toISOString() }).eq('id', existingRow.id)
      return
    }
    await admin.from('inquiries').insert({
      property_id: args.propertyId,
      user_id: args.userId,
      agent_id: args.ownerId,
      status: inquiryStatus,
      source: 'interest',
      message: `Konfirmasi ketertarikan dikirim (skor ${args.score}/100)${args.verdict ? ` · kesimpulan Homy AI: ${args.verdict}` : ''}.`,
    })
  } catch (error) {
    console.error('[interest] sinkron prospek gagal:', error instanceof Error ? error.message : error)
  }
}
