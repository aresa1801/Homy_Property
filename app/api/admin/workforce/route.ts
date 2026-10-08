import { NextResponse } from 'next/server'
import { AiError } from '@/lib/ai'
import { decideWorkItem, listWorkforce, runCycle, setEmployeeStatus, ensureWorkforce, ensureSkills, getSkill, createTarget, updateTarget } from '@/lib/ai-workforce'
import { createClient } from '@/lib/supabase/server'
import { clientKey, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const ADMIN_ROLES = ['admin', 'super_admin']

/** Hanya admin/super_admin yang boleh memakai AI Workforce. */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Masuk sebagai admin untuk memakai fitur ini.', needsAuth: true }, { status: 401 }) }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = Array.isArray(roles) ? roles.map((r: { role: string }) => r.role) : []
  if (!list.some((role) => ADMIN_ROLES.includes(role))) {
    return { error: NextResponse.json({ error: 'Fitur ini khusus admin & super admin.' }, { status: 403 }) }
  }
  return { user }
}

/** GET — kantor AI: roster karyawan, antrean kerja, riwayat siklus, statistik. */
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  try {
    const slug = new URL(request.url).searchParams.get('skill')
    if (slug) {
      const skill = await getSkill(slug)
      if (!skill) return NextResponse.json({ error: 'Skill tidak ditemukan.' }, { status: 404 })
      return NextResponse.json({ skill })
    }
    const payload = await listWorkforce()
    return NextResponse.json(payload)
  } catch (error) {
    const aiError = error instanceof AiError ? error : null
    console.error('[homy-workforce:GET]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: aiError?.message ?? 'Gagal memuat data AI Workforce.' }, { status: aiError?.status ?? 500 })
  }
}

type Body =
  | { action: 'run'; scope?: 'core' | 'content' | 'extended' | 'design' | 'publish' | 'all' }
  | { action: 'seed' }
  | { action: 'skills-seed' }
  | { action: 'decide'; id: string; decision: 'approve' | 'reject'; note?: string }
  | { action: 'toggle'; slug: string; status: 'active' | 'paused' | 'planned' }
  | {
      action: 'target'; op: 'create' | 'update' | 'archive'
      id?: string; period?: string; title?: string; metric?: string; target_value?: number
      unit?: string; owner_slug?: string; current_value?: number; status?: string; notes?: string
    }

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const actor = guard.user

  const limit = rateLimit(clientKey(request, 'workforce'), 20, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let body: Body = { action: 'run' }
  try { body = (await request.json()) as Body } catch { /* kosong */ }

  try {
    if (body.action === 'seed') {
      const { seeded, employees } = await ensureWorkforce()
      return NextResponse.json({ ok: true, seeded, total: employees.length })
    }

    if (body.action === 'skills-seed') {
      const res = await ensureSkills(true)
      return NextResponse.json({ ok: true, ...res })
    }

    if (body.action === 'toggle') {
      if (!body.slug || !['active', 'paused', 'planned'].includes(body.status)) {
        return NextResponse.json({ error: 'slug & status wajib valid' }, { status: 400 })
      }
      const ok = await setEmployeeStatus(body.slug, body.status)
      return NextResponse.json({ ok })
    }

    if (body.action === 'decide') {
      if (!body.id || !['approve', 'reject'].includes(body.decision)) {
        return NextResponse.json({ error: 'id & decision wajib valid' }, { status: 400 })
      }
      const result = await decideWorkItem(actor.id, body.id, body.decision, body.note)
      if (!result.ok) return NextResponse.json({ error: result.error ?? 'Gagal memproses' }, { status: 400 })
      const payload = await listWorkforce()
      return NextResponse.json({ ok: true, status: result.status, ...payload })
    }

    if (body.action === 'target') {
      if (body.op === 'create') {
        if (!body.title) return NextResponse.json({ error: 'title wajib' }, { status: 400 })
        const t = await createTarget({
          period: body.period, title: body.title, metric: body.metric, target_value: body.target_value,
          unit: body.unit, owner_slug: body.owner_slug, notes: body.notes, source: 'boss', created_by: actor.id,
        })
        if (!t) return NextResponse.json({ error: 'Gagal membuat target' }, { status: 400 })
        return NextResponse.json({ ok: true, ...(await listWorkforce()) })
      }
      if (body.op === 'update' || body.op === 'archive') {
        if (!body.id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })
        const ok = await updateTarget(body.id, {
          current_value: body.current_value, target_value: body.target_value,
          status: body.op === 'archive' ? 'archived' : body.status, notes: body.notes, title: body.title,
        })
        if (!ok) return NextResponse.json({ error: 'Gagal memperbarui target' }, { status: 400 })
        return NextResponse.json({ ok: true, ...(await listWorkforce()) })
      }
      return NextResponse.json({ error: 'op tidak dikenal' }, { status: 400 })
    }

    // default: jalankan siklus
    const result = await runCycle(actor.id, 'manual', body.scope ?? 'core')
    const payload = await listWorkforce()
    return NextResponse.json({ ok: true, cycle: result, ...payload })
  } catch (error) {
    const aiError = error instanceof AiError ? error : null
    console.error('[homy-workforce:POST]', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: aiError?.message ?? 'AI Workforce sedang tidak bisa dijalankan. Coba lagi sebentar lagi.' },
      { status: aiError?.status ?? 502 },
    )
  }
}
