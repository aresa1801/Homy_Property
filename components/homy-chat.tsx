'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import { plainify } from '@/lib/plain-text'
import {
  HOMY_CHAT_GREETING,
  HOMY_CHAT_NAME,
  HOMY_CHAT_SUGGESTIONS,
  normalizeHomyChatRole,
  type HomyChatRole,
} from '@/lib/homy-chat'

type Msg = { role: 'assistant' | 'user'; text: string }

/**
 * HOMY CHAT — tombol chatbot bantuan platform Homy (dashboard Pengguna & Agen).
 * Mengambang di kanan bawah; memakai logo Homy pada tombolnya.
 */
export function HomyChat({ role }: { role: string }) {
  const chatRole: HomyChatRole = normalizeHomyChatRole(role)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const suggestions = HOMY_CHAT_SUGGESTIONS[chatRole]

  // Sapaan pembuka saat pertama dibuka.
  useEffect(() => {
    if (open && messages.length === 0) setMessages([{ role: 'assistant', text: HOMY_CHAT_GREETING }])
  }, [open, messages.length])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, sending, open])

  async function send(text: string) {
    const question = text.trim()
    if (!question || sending) return
    setError(null)
    const next = [...messages, { role: 'user' as const, text: question }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const history = next.slice(-8, -1).map((m) => ({ role: m.role, content: m.text }))
      const response = await fetch('/api/ai/homy-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, history, role: chatRole }),
      })
      const payload = (await response.json().catch(() => ({}))) as { answer?: string; error?: string }
      if (!response.ok || !payload.answer) {
        setError(payload.error || 'Homy sedang tidak bisa dihubungi. Coba lagi sebentar lagi.')
        setMessages((prev) => [...prev, { role: 'assistant', text: 'Maaf, saya sedang tidak bisa menjawab sekarang. Coba lagi sebentar lagi ya.' }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', text: plainify(payload.answer as string) }])
      }
    } catch {
      setError('Koneksi terganggu. Periksa jaringan lalu coba lagi.')
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Maaf, koneksi terganggu. Coba lagi sebentar lagi ya.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label={`${HOMY_CHAT_NAME} — asisten Homy Property`}
          className="fixed inset-x-3 bottom-24 z-[60] flex max-h-[76vh] flex-col overflow-hidden rounded-2xl border border-[#e5dccd] bg-white shadow-[0_24px_60px_rgba(11,61,46,.28)] sm:inset-x-auto sm:right-6 sm:w-[384px]"
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-[#0b3d2e] px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/95 ring-1 ring-[#c9a961]/40">
              <img src="/logo-homy.png" alt="Homy Property" className="h-6 w-auto max-w-[26px] object-cover object-left" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold tracking-[.12em] text-[#f6e2a8]">{HOMY_CHAT_NAME}</p>
              <p className="truncate text-xs text-white/70">Asisten platform Homy Property</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white">
              <X className="size-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[#faf7f1] px-4 py-4">
            {messages.map((message, index) => (
              <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    message.role === 'user'
                      ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[#0b3d2e] px-3.5 py-2.5 text-sm leading-relaxed text-white'
                      : 'max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-[#e5dccd] bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[#33433d]'
                  }
                >
                  {message.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-[#e5dccd] bg-white px-3.5 py-3">
                  <span className="size-1.5 animate-bounce rounded-full bg-[#c9a961] [animation-delay:-.2s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-[#c9a961] [animation-delay:-.1s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-[#c9a961]" />
                </div>
              </div>
            )}

            {/* Saran pertanyaan (hanya sebelum ada pertanyaan user) */}
            {messages.length <= 1 && !sending && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => send(item)}
                    className="rounded-full border border-[#e5dccd] bg-white px-3 py-1.5 text-left text-xs font-medium text-[#0b3d2e] transition hover:border-[#c9a961] hover:bg-[#f7f3ec]"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(event) => { event.preventDefault(); send(input) }}
            className="border-t border-[#e5dccd] bg-white px-3 py-3"
          >
            {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
            <div className="flex items-end gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Tulis pertanyaan Anda…"
                aria-label="Tulis pertanyaan"
                className="min-w-0 flex-1 rounded-xl border border-[#e5dccd] bg-[#faf7f1] px-3 py-2.5 text-sm text-[#0b3d2e] outline-none transition focus:border-[#c9a961] focus:bg-white"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Kirim"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#0b3d2e] text-white transition hover:bg-[#14553f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-[#a19a8d]">HOMY CHAT membantu alur di platform Homy Property.</p>
          </form>
        </div>
      )}

      {/* Tombol mengambang */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? `Tutup ${HOMY_CHAT_NAME}` : `Buka ${HOMY_CHAT_NAME}`}
        className="fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 rounded-full bg-[#0b3d2e] py-2.5 pl-2.5 pr-4 text-[#f6e2a8] shadow-[0_14px_34px_rgba(11,61,46,.4)] ring-1 ring-[#c9a961]/50 transition hover:scale-[1.03] hover:bg-[#14553f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a961]"
      >
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white/95">
          <img src="/logo-homy.png" alt="" className="h-6 w-auto max-w-[26px] object-cover object-left" />
        </span>
        <span className="text-sm font-bold tracking-[.14em]">HOMY CHAT</span>
      </button>
    </>
  )
}
