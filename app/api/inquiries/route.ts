import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { answerInquiry, aiAutoReplyEnabled } from '@/lib/inquiry-ai'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { serviceClient } from '@/lib/visits'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { data, error } = await supabase.from('inquiries').select('id,property_id,agent_id,status,message,created_at,updated_at').or(`user_id.eq.${user.id},agent_id.eq.${user.id}`).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Unable to load inquiries' }, { status: 500 })
  return NextResponse.json({ data })
}

/**
 * Kirim pertanyaan ke agen/pemilik. Homy AI langsung menjawab (grounded ke data listing +
 * jadwal ketersediaan), jawabannya dicatat di baris inquiry supaya agen/pemilik tahu
 * apa yang sudah disampaikan dan bisa menimpanya kapan saja.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const limit = rateLimit(clientKey(request, 'inquiries'), 8, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { /* body kosong */ }
  const message = String(body.message ?? '').trim()
  if (message.length < 3) return NextResponse.json({ error: 'Tulis pertanyaan Anda dulu.' }, { status: 400 })

  const { data, error } = await supabase
    .from('inquiries')
    .insert({ property_id: body.property_id ?? null, message, status: 'open', user_id: user.id })
    .select('id,property_id,status,message,created_at')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Unable to send inquiry' }, { status: 400 })

  let ai: { ok: boolean; answer?: string; sources?: unknown[]; at?: string } | null = null
  try {
    if (await aiAutoReplyEnabled()) {
      const profile = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      const result = await answerInquiry({
        propertyId: (data.property_id as string | null) ?? null,
        message,
        senderName: (profile.data?.full_name as string | undefined) ?? null,
      })
      if (result) {
        const at = new Date().toISOString()
        const admin = serviceClient()
        if (admin) {
          await admin
            .from('inquiries')
            .update({
              reply_message: 'Homy AI: ' + result.answer,
              replied_at: at,
              follow_up_note: 'Dijawab otomatis oleh Homy AI. Agen/pemilik dapat menimpa balasan ini.',
            })
            .eq('id', data.id)
          await admin.from('audit_logs').insert({
            actor_id: user.id,
            action: 'inquiry.ai_reply',
            entity_type: 'inquiry',
            entity_id: String(data.id),
            metadata: { property_id: data.property_id, source: 'homy-ai', model: 'deepseek-chat' },
          })
        }
        ai = { ok: true, answer: result.answer, sources: result.sources, at }
      }
    }
  } catch (err) {
    console.error('[homy-inquiries] balasan AI gagal:', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ data, ai }, { status: 201 })
}
