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

/** Perbaiki JSON yang terpotong/tak lengkap (umum dari model). */
function repairJsonCandidate<T>(input: string): T | null {
  let s = input.trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  const start = s.indexOf('{')
  if (start < 0) return null
  s = s.slice(start)
  try { return JSON.parse(s) as T } catch { /* lanjut */ }
  // (a) potong pada setiap '}' dari belakang (buang ekor yang bukan JSON)
  const ends: number[] = []
  let i = s.lastIndexOf('}')
  while (i > 0 && ends.length < 400) { ends.push(i); i = s.lastIndexOf('}', i - 1) }
  for (const e of ends) { try { return JSON.parse(s.slice(0, e + 1)) as T } catch { /* lanjut */ } }
  // (b) seimbangkan kurung/kutip yang belum ditutup karena output terpotong
  const balanced = balanceJson(s)
  if (balanced) { try { return JSON.parse(balanced) as T } catch { /* gagal */ } }
  return null
}

function balanceJson(input: string): string | null {
  const stack: string[] = []
  let inString = false
  let escaped = false
  let out = ''
  for (const ch of input) {
    out += ch
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') stack.pop()
  }
  if (!stack.length && !inString) return null
  let result = out
  if (inString) result += '"'
  // buang pasangan kunci yang belum punya nilai, lalu koma menggantung
  result = result.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*$/, '')
  result = result.replace(/,\s*$/, '')
  for (let k = stack.length - 1; k >= 0; k -= 1) result += stack[k] === '{' ? '}' : ']'
  return result
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
  const repaired = repairJsonCandidate<T>(text)
  if (repaired !== null) return repaired
  throw new AiError('Jawaban AI tidak dapat dibaca', 502, text.slice(0, 300))
}

export const AI_DISCLAIMER = 'Perkiraan AI berdasarkan data listing Homy; bukan penilaian resmi (appraisal).'

/* ------------------------------------------------------------------ */
/* Function-calling: dipakai oleh Homy AI Admin (agen yang sadar-database) */
/* ------------------------------------------------------------------ */

export type AiToolDef = {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export type AiToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
export type AiAssistantMessage = { role: 'assistant'; content?: string | null; tool_calls?: AiToolCall[] }

/**
 * Chat completion dengan dukungan tool/function-calling.
 * Mengembalikan pesan asisten mentah (berisi konten dan/atau daftar tool_calls).
 */
export async function aiToolChat(
  messages: AiMessage[],
  tools: AiToolDef[],
  options: AiOptions = {},
): Promise<{ message: AiAssistantMessage; usage?: DeepSeekResponse['usage'] }> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new AiError('AI belum dikonfigurasi: DEEPSEEK_API_KEY kosong', 503)

  const body: Record<string, unknown> = {
    model: AI_MODEL,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1200,
    stream: false,
  }
  if (tools.length) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

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
  type ToolPayload = { choices?: { message?: AiAssistantMessage }[]; error?: { message?: string }; usage?: DeepSeekResponse['usage'] }
  let payload: ToolPayload = {}
  try { payload = JSON.parse(raw) as ToolPayload } catch { payload = {} }
  if (!response.ok) {
    const detail = payload?.error?.message || raw.slice(0, 300)
    throw new AiError('Layanan AI menolak permintaan', 502, detail)
  }
  const message = payload.choices?.[0]?.message
  if (!message) throw new AiError('AI tidak mengembalikan jawaban', 502, raw.slice(0, 300))
  return { message, usage: payload.usage }
}
