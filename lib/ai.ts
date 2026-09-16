/**
 * Klien AI DeepSeek (server-side only).
 * Memakai env DEEPSEEK_API_KEY (sudah tersedia di project `homy`).
 * Semua pemanggilan lewat helper ini supaya penanganan error & timeout konsisten.
 */

import { plainify } from '@/lib/plain-text'

const AI_BASE = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
const AI_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

export class AiError extends Error {
  status: number
  detail?: string
  constructor(message: string, status = 502, detail?: string) {
    super(message)
    this.name = 'AiError'
    this.status = status
    this.detail = detail
  }
}

export function aiConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY)
}

export function aiModel() {
  return AI_MODEL
}

export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type AiOptions = {
  temperature?: number
  maxTokens?: number
  json?: boolean
  timeoutMs?: number
}

type DeepSeekResponse = {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string; type?: string }
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

/** Panggilan chat completion ke DeepSeek. Throw AiError kalau gagal (tidak pernah mengembalikan teks kosong). */
export async function aiChat(messages: AiMessage[], options: AiOptions = {}): Promise<{ text: string; usage?: DeepSeekResponse['usage'] }> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new AiError('AI belum dikonfigurasi: DEEPSEEK_API_KEY kosong', 503)

  const body: Record<string, unknown> = {
    model: AI_MODEL,
    messages,
    temperature: options.temperature ?? 0.25,
    max_tokens: options.maxTokens ?? 1000,
    stream: false,
  }
  if (options.json) body.response_format = { type: 'json_object' }

  let response: Response
  try {
    response = await fetch(`${AI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 55000),
    })
  } catch {
    throw new AiError('Tidak bisa menghubungi layanan AI (timeout/jaringan)', 504)
  }

  const raw = await response.text()
  let payload: DeepSeekResponse = {}
  try { payload = JSON.parse(raw) as DeepSeekResponse } catch { payload = {} }

  if (!response.ok) {
    const detail = payload?.error?.message || raw.slice(0, 300)
    const status = response.status === 401 || response.status === 403 ? 502 : 502
    throw new AiError('Layanan AI menolak permintaan', status, detail)
  }

  const rawText = payload.choices?.[0]?.message?.content?.trim()
  if (!rawText) throw new AiError('AI tidak mengembalikan jawaban', 502, raw.slice(0, 300))
  // Teks disajikan apa adanya oleh UI → buang sintaks markdown (mis. bintang) agar
  // jawaban terbaca natural seperti ditulis manusia. Mode JSON dibiarkan utuh.
  const text = options.json ? rawText : plainify(rawText)
  return { text, usage: payload.usage }
}

/** Ambil jawaban AI dalam bentuk objek JSON (mode json_object + parsing defensif). */
export async function aiJson<T>(messages: AiMessage[], options: AiOptions = {}): Promise<T> {
  const { text } = await aiChat(
    [
      ...messages,
      { role: 'system', content: 'Balas HANYA dengan satu objek JSON valid tanpa penjelasan tambahan di luar JSON.' },
    ],
    { ...options, json: true },
  )
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)) as T } catch { /* fallthrough */ }
    }
    throw new AiError('Jawaban AI tidak dapat dibaca', 502, cleaned.slice(0, 300))
  }
}

export const AI_DISCLAIMER = 'Perkiraan AI berdasarkan data listing Homy; bukan penilaian resmi (appraisal).'
