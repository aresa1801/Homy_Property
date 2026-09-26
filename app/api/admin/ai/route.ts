import { NextResponse } from 'next/server'
import { aiConfigured, aiModel, AiError, type AiMessage } from '@/lib/ai'
import { generateAnalysis, runAdminAgent, saveAnalysis, type AnalysisTarget } from '@/lib/ai-admin'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/visits'
import { clientKey, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const ADMIN_ROLES = ['admin', 'super_admin']

/** Hanya admin/super_admin yang boleh memakai Homy AI Admin. */
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

/** GET — status AI + riwayat analisa terakhir (untuk dasbor). */
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error

  const admin = serviceClient()
  let analyses: unknown[] = []
  if (admin) {
    const { data } = await admin
      .from('ai_analyses')
      .select('id,target_type,target_id,audience_role,title,summary,model,created_at')
      .order('created_at', { ascending: false })
      .limit(30)
    analyses = data ?? []
  }
  return NextResponse.json({ configured: aiConfigured(), model: aiModel(), analyses })
}

type ChatBody = { mode?: 'chat' | 'analyze'; message?: string; history?: { role?: string; content?: string }[]; target?: AnalysisTarget; audience?: string; notify?: boolean; save?: boolean }

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const admin = guard.user

  if (!aiConfigured()) return NextResponse.json({ error: 'Fitur AI belum diaktifkan (kunci AI belum diatur).' }, { status: 503 })

  const limit = rateLimit(clientKey(request, 'admin-ai'), 30, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let body: ChatBody = {}
  try { body = (await request.json()) as ChatBody } catch { /* kosong */ }

  const mode = body.mode === 'analyze' ? 'analyze' : 'chat'

  try {
    if (mode === 'analyze') {
      const target: AnalysisTarget = body.target && body.target.type ? { type: body.target.type, id: body.target.id } : { type: 'platform' }
      const analysis = await generateAnalysis(target, admin.id, body.audience)
      let saved: { id: string | null; notified: boolean } | null = null
      if (body.save !== false) {
        saved = await saveAnalysis({ target, audience: body.audience, analysis, actorId: admin.id, model: aiModel(), notify: Boolean(body.notify) })
      }
      return NextResponse.json({ mode, configured: true, model: aiModel(), target, analysis, saved })
    }

    const question = (body.message ?? body.history?.at(-1)?.content ?? '').toString().trim().slice(0, 1500)
    if (!question) return NextResponse.json({ error: 'Pertanyaan belum diisi.' }, { status: 400 })

    const history: AiMessage[] = (body.history ?? [])
      .slice(-6)
      .filter((item) => item?.content)
      .map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content).slice(0, 1500) }))
    if (history.length && history.at(-1)?.content.trim() === question) history.pop()

    const result = await runAdminAgent(history, question, admin.id)
    return NextResponse.json({
      mode,
      configured: true,
      model: aiModel(),
      answer: result.answer,
      tools: result.steps.map((step) => ({ tool: step.tool, args: step.args })),
      usage: result.usage,
    })
  } catch (error) {
    const aiError = error instanceof AiError ? error : null
    console.error('[homy-ai-admin]', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: aiError?.message ?? 'AI Admin sedang tidak bisa dihubungi. Coba lagi sebentar lagi.', detail: aiError?.detail },
      { status: aiError?.status ?? 502 },
    )
  }
}
