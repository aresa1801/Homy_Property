import { NextResponse } from 'next/server'
import { aiChat, aiConfigured, aiModel, AiError, type AiMessage } from '@/lib/ai'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { homyChatSystem, normalizeHomyChatRole, HOMY_CHAT_GREETING } from '@/lib/homy-chat'

/**
 * HOMY CHAT — asisten bantuan platform (dashboard Pengguna & Agen).
 * Tidak membaca data listing/akun; hanya menjelaskan alur & menu platform.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

type ChatBody = {
  message?: string
  history?: { role?: string; content?: string }[]
  role?: string | null
}

export async function GET() {
  return NextResponse.json({ configured: aiConfigured(), model: aiModel(), greeting: HOMY_CHAT_GREETING })
}

export async function POST(request: Request) {
  if (!aiConfigured()) {
    return NextResponse.json({ error: 'Fitur HOMY CHAT belum diaktifkan (kunci AI belum diatur).' }, { status: 503 })
  }
  const limit = rateLimit(clientKey(request, 'homy-chat'), 30, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let body: ChatBody = {}
  try { body = (await request.json()) as ChatBody } catch { /* body kosong */ }

  const role = normalizeHomyChatRole(body.role)
  const question = (body.message ?? body.history?.at(-1)?.content ?? '').toString().trim().slice(0, 1000)
  if (!question) return NextResponse.json({ error: 'Pertanyaan belum diisi.' }, { status: 400 })

  const history: AiMessage[] = (body.history ?? [])
    .slice(-8)
    .filter((item) => item?.content)
    .map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content).slice(0, 1200) }))
  if (history.length && history.at(-1)?.content.trim() === question) history.pop()

  try {
    const { text, usage } = await aiChat(
      [
        { role: 'system', content: homyChatSystem(role) },
        ...history,
        { role: 'user', content: question },
      ],
      { temperature: 0.3, maxTokens: 700 },
    )
    return NextResponse.json({ answer: text, configured: true, usage })
  } catch (error) {
    const aiError = error instanceof AiError ? error : null
    return NextResponse.json(
      { error: aiError?.message ?? 'Homy sedang tidak bisa dihubungi. Coba lagi sebentar lagi.', detail: aiError?.detail },
      { status: aiError?.status ?? 502 },
    )
  }
}
