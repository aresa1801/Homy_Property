'use client'

import { useState } from 'react'
import { Bot, Loader2, MapPin, Send, Sparkles, User } from 'lucide-react'
import { plainify } from '@/lib/plain-text'

type Source = { id: string; title?: string | null; city?: string | null; district?: string | null; listing_type?: string | null; price?: number | string | null }
type Msg = { role: 'user' | 'assistant'; content: string; sources?: Source[] }

const rupiah = (value?: number | string | null) => {
  const amount = typeof value === 'string' ? Number(value) : value
  if (!amount || Number.isNaN(amount)) return null
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}

export function AiChat({
  propertyId,
  filters,
  suggestions = [],
  intro,
  placeholder = 'Tanya apa saja tentang properti…',
  compact = false,
}: {
  propertyId?: string
  filters?: Record<string, unknown>
  suggestions?: string[]
  intro?: string
  placeholder?: string
  compact?: boolean
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask(question: string) {
    const text = question.trim()
    if (!text || busy) return
    const history = messages.map((item) => ({ role: item.role, content: item.content }))
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, propertyId, filters }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'AI gagal menjawab. Coba lagi.')
      setMessages((prev) => [...prev, { role: 'assistant', content: String(payload.answer ?? ''), sources: payload.sources ?? [] }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghubungi AI')
      setMessages((prev) => prev.slice(0, -1))
      setInput(text)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-ai-chat className="flex h-full flex-col">
      <div className={`flex items-center gap-3 ${compact ? '' : 'mb-4'}`}>
        <span className="grid size-9 place-items-center rounded-full bg-[#0b3d2e] text-[#c9a961]"><Bot className="size-5" /></span>
        <div>
          <p className="text-sm font-semibold text-[#0b3d2e]">Homy AI</p>
          <p className="text-xs text-[#718078]">{intro ?? 'Dijawab dari data listing & harga di Homy Property'}</p>
        </div>
      </div>

      <div className={`flex-1 space-y-3 overflow-y-auto rounded-2xl bg-[#f7f3ec] p-4 ${compact ? 'max-h-[22rem]' : 'min-h-[18rem]'}`}>
        {!messages.length && (
          <div className="space-y-3">
            <p className="text-sm text-[#718078]">Halo! Saya Homy AI. Saya bisa membaca listing yang ada di Homy dan membantu Anda memilih properti, membandingkan harga, atau menjelaskan isi sebuah listing.</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((item) => (
                <button key={item} type="button" onClick={() => ask(item)} className="rounded-full border border-[#d8ccbb] bg-white px-3 py-1.5 text-xs font-medium text-[#33433d] hover:border-[#0b3d2e] hover:text-[#0b3d2e]">
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${message.role === 'user' ? 'bg-[#0b3d2e] text-white' : 'bg-white text-[#20332c] shadow-[0_6px_18px_rgba(20,42,32,.05)]'}`}>
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] opacity-70">
                {message.role === 'user' ? <><User className="size-3" /> Anda</> : <><Sparkles className="size-3" /> Homy AI</>}
              </div>
              {plainify(message.content)}
              {!!message.sources?.length && (
                <div className="mt-3 space-y-1 border-t border-[#e5dccd] pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#a18a61]">Listing terkait</p>
                  {message.sources.slice(0, 4).map((source) => (
                    <a key={source.id} href={`/property/${source.id}`} className="flex items-center gap-2 text-xs text-[#0b3d2e] hover:underline">
                      <MapPin className="size-3" />
                      <span className="truncate">{source.title ?? 'Lihat properti'}</span>
                      {rupiah(source.price) && <span className="text-[#718078]">· {rupiah(source.price)}</span>}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-xs text-[#718078]"><Loader2 className="size-4 animate-spin" /> Homy AI sedang membaca data listing…</div>
        )}
      </div>

      {error && <p className="mt-2 rounded-lg bg-[#fbeeec] px-3 py-2 text-xs text-[#b45c50]">{error}</p>}

      <form
        onSubmit={(event) => { event.preventDefault(); void ask(input) }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[#d8ccbb] bg-white px-3 py-2.5 text-sm text-[#20332c] outline-none focus:border-[#0b3d2e]"
        />
        <button type="submit" disabled={busy || !input.trim()} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0b3d2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14553f] disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Tanya
        </button>
      </form>
    </div>
  )
}
