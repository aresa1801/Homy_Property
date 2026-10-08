import { NextResponse } from 'next/server'
import { runCycle } from '@/lib/ai-workforce'
import { aiConfigured } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Pemicu otomatis AI Workforce (dipanggil Vercel Cron tiap hari 08.00 WIB).
 * Dilindungi CRON_SECRET: Vercel mengirim header `Authorization: Bearer <CRON_SECRET>`.
 * Query `?token=<CRON_SECRET>` juga diterima untuk uji manual. Tanpa secret → 503.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  if (header === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  return url.searchParams.get('token') === secret
}

async function handle(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET belum diatur pada lingkungan ini.' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 })
  }
  if (!aiConfigured()) {
    return NextResponse.json({ error: 'Fitur AI belum diaktifkan.' }, { status: 503 })
  }
  try {
    const url = new URL(request.url)
    const raw = url.searchParams.get('scope') ?? 'core'
    const scope = (['core', 'content', 'extended', 'design', 'publish', 'learn', 'all'] as const).find((s) => s === raw) ?? 'core'
    const rawSlot = url.searchParams.get('slot')
    const slot = rawSlot === 'pagi' || rawSlot === 'sore' ? rawSlot : undefined
    const result = await runCycle(null, 'cron', scope, slot)
    return NextResponse.json({ ok: true, scope, slot: slot ?? null, cycle: result })
  } catch (error) {
    console.error('[homy-workforce:cron]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Siklus gagal' }, { status: 502 })
  }
}

export async function GET(request: Request) { return handle(request) }
export async function POST(request: Request) { return handle(request) }
