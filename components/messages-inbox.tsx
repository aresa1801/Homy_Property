'use client'

/**
 * Kotak masuk "Pesan" — berbasis data NYATA, tanpa contoh/dummy.
 *
 * Sumber data: `GET /api/ai/conversations` (tabel `ai_conversations`).
 * Semua percakapan antara pengguna dan Homy AI dicatat otomatis oleh
 * `POST /api/ai/chat` beserta properti yang ditanyakan.
 *
 * Dua mode tampilan mengikuti peran akun:
 *  - Pengguna (pembeli/penyewa): menampilkan percakapan MILIKNYA dengan Homy AI,
 *    dikelompokkan per objek properti → satu properti = satu utas (thread).
 *  - Agen / Pemilik / Admin: bertindak sebagai REKAP percakapan antara calon
 *    pembeli/penyewa dengan Homy AI tentang listing yang mereka kelola.
 *
 * RLS di database yang menentukan baris mana yang boleh dibaca:
 *  - pengguna melihat percakapannya sendiri (user_id = auth.uid())
 *  - agen/pemilik melihat percakapan atas properti miliknya (properties.owner_id)
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, Bot, Image as ImageIcon, Loader2, MapPin, MessageSquare, RefreshCw, Search, Sparkles, User as UserIcon } from 'lucide-react'
import { firstMediaUrl } from '@/lib/property-format'
import { plainify } from '@/lib/plain-text'
import { useSessionProfile } from '@/lib/homy-session'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

type ConversationRow = {
  id: string
  propertyId: string | null
  propertyTitle: string | null
  propertyCity: string | null
  propertyDistrict: string | null
  listingType: string | null
  propertyMedia?: { storage_path: string; media_type?: string | null; sort_order?: number | null }[] | null
  userEmail: string | null
  isMine: boolean
  mode: string
  question: string
  answer: string
  createdAt: string
}

type Thread = {
  key: string
  propertyId: string | null
  title: string
  location: string
  listingType: string | null
  image: string | null
  lastAt: string
  rows: ConversationRow[]
}

type Session = { key: string; email: string | null; rows: ConversationRow[] }

const SESSION_GAP_MS = 45 * 60 * 1000

const timeValue = (value?: string | null) => {
  const time = value ? new Date(value).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

function clock(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function relativeDay(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000)
  if (diffDays <= 0) return clock(value)
  if (diffDays === 1) return 'Kemarin'
  if (diffDays < 7) return date.toLocaleDateString('id-ID', { weekday: 'short' })
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

function fullStamp(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Email disamarkan supaya agen/pemilik tetap tahu ini pembeli berbeda tanpa membuka data pribadi penuh. */
function maskEmail(value?: string | null) {
  const text = String(value ?? '').trim()
  if (!text) return 'Tamu (belum masuk)'
  if (!text.includes('@')) return text
  const [name, domain] = text.split('@')
  if (name.length <= 2) return `${name}***@${domain}`
  return `${name.slice(0, 2)}${'*'.repeat(Math.min(name.length - 2, 6))}@${domain}`
}

/** Kelompokkan baris tanya-jawab menjadi "sesi" percakapan (jeda > 45 menit dianggap sesi baru). */
function sessionsOf(rows: ConversationRow[]): Session[] {
  const sorted = [...rows].sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt))
  const sessions: Session[] = []
  for (const row of sorted) {
    const last = sessions[sessions.length - 1]
    const previous = last?.rows[last.rows.length - 1]
    const gap = previous ? timeValue(row.createdAt) - timeValue(previous.createdAt) : Number.POSITIVE_INFINITY
    if (last && (last.email ?? '') === (row.userEmail ?? '') && gap <= SESSION_GAP_MS) last.rows.push(row)
    else sessions.push({ key: row.id, email: row.userEmail ?? null, rows: [row] })
  }
  return sessions
}

const SUGGESTIONS = [
  'Cari rumah 3 kamar di Sleman budget 1,5 M',
  'Harga per meter persegi wajar di Bandung berapa?',
  'Sewa apartemen Jakarta per bulan berapa?',
]

export function MessagesInbox() {
  const { profile, loading: sessionLoading } = useSessionProfile()
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [query, setQuery] = useState('')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)

  const ownerSide = (profile?.roles ?? []).some((role) => role === 'agent' || role === 'property_owner' || role === 'admin' || role === 'super_admin')

  async function load() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/ai/conversations?limit=100', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (response.status === 401) {
        setNeedsAuth(true)
        setRows([])
        return
      }
      if (!response.ok) {
        setError(payload?.error ?? 'Gagal memuat pesan. Coba lagi sebentar.')
        setRows([])
        return
      }
      setNeedsAuth(false)
      setRows((payload.conversations ?? []) as ConversationRow[])
    } catch {
      setError('Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => [row.propertyTitle, row.propertyCity, row.propertyDistrict, row.question, row.answer, row.userEmail]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)))
  }, [rows, query])

  const threads = useMemo(() => {
    const map = new Map<string, Thread>()
    for (const row of filtered) {
      const key = row.propertyId ?? 'umum'
      const thread = map.get(key)
      if (thread) {
        thread.rows.push(row)
        if (timeValue(row.createdAt) > timeValue(thread.lastAt)) thread.lastAt = row.createdAt
        continue
      }
      map.set(key, {
        key,
        propertyId: row.propertyId,
        title: row.propertyTitle ?? 'Pertanyaan umum (tanpa properti)',
        location: [row.propertyDistrict, row.propertyCity].filter(Boolean).join(', ') || 'Tanpa lokasi',
        listingType: row.listingType,
        image: row.propertyId ? firstMediaUrl({ property_media: row.propertyMedia ?? [] }, SUPABASE_URL) : null,
        lastAt: row.createdAt,
        rows: [row],
      })
    }
    const list = Array.from(map.values())
    list.forEach((thread) => thread.rows.sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt)))
    list.sort((a, b) => timeValue(b.lastAt) - timeValue(a.lastAt))
    return list
  }, [filtered])

  const active = threads.find((thread) => thread.key === activeKey) ?? threads[0] ?? null
  const buyers = new Set(rows.map((row) => row.userEmail ?? 'tamu')).size

  const selectThread = (key: string) => {
    setActiveKey(key)
    setMobileThreadOpen(true)
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-7 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#c09b54]">{ownerSide ? 'Rekap percakapan' : 'Kotak masuk'}</p>
          <h1 className="mt-2 font-serif text-3xl text-[#0b3d2e] sm:text-5xl">Pesan Anda.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#65706c]">
            {ownerSide
              ? 'Rekap percakapan antara calon pembeli/penyewa dan Homy AI tentang listing yang Anda kelola. Semua pertanyaan tercatat otomatis, dikelompokkan per properti.'
              : 'Riwayat percakapan Anda dengan Homy AI, dikelompokkan per objek properti. Semua tersimpan otomatis setiap kali Anda bertanya di halaman properti atau Asisten AI.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8ccbb] bg-white px-3 text-sm font-semibold text-[#33433d] disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Muat ulang
          </button>
          <Link href="/ai-assistant" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0b3d2e] px-4 text-sm font-semibold text-white hover:bg-[#14553f]">
            <Sparkles className="size-4" /> Tanya Homy AI
          </Link>
        </div>
      </div>

      {!busy && rows.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-[#33433d]">
          <span className="rounded-full bg-white px-3 py-1.5 shadow-[0_6px_20px_rgba(20,42,32,.05)]">{threads.length} properti</span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-[0_6px_20px_rgba(20,42,32,.05)]">{rows.length} tanya-jawab</span>
          {ownerSide && <span className="rounded-full bg-white px-3 py-1.5 shadow-[0_6px_20px_rgba(20,42,32,.05)]">{buyers} calon pembeli</span>}
        </div>
      )}

      {error && (
        <p className="mt-6 flex items-center gap-2 rounded-xl bg-[#fbeeec] px-4 py-3 text-sm font-medium text-[#b45c50]"><AlertCircle className="size-4 shrink-0" /> {error}</p>
      )}

      {needsAuth && !busy && (
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-[0_10px_35px_rgba(20,42,32,.08)] sm:p-8">
          <p className="flex items-center gap-2 font-serif text-xl text-[#0b3d2e]"><MessageSquare className="size-5" /> Masuk dulu untuk melihat pesan</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#65706c]">
            Halaman Pesan menampilkan riwayat percakapan akun Anda dengan Homy AI. Masuk dengan akun Homy supaya percakapannya bisa dikelompokkan per properti.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/auth" className="inline-flex h-10 items-center rounded-lg bg-[#0b3d2e] px-4 text-sm font-semibold text-white hover:bg-[#14553f]">Masuk / daftar</Link>
            <Link href="/buy" className="inline-flex h-10 items-center rounded-lg border border-[#d8ccbb] px-4 text-sm font-semibold text-[#33433d]">Jelajahi properti</Link>
          </div>
        </div>
      )}

      {busy && (
        <div className="mt-8 grid min-h-[420px] place-items-center rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.08)]">
          <span className="flex items-center gap-2 text-sm text-[#718078]"><Loader2 className="size-4 animate-spin" /> Memuat percakapan…</span>
        </div>
      )}

      {!busy && !needsAuth && !rows.length && !error && (
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-[0_10px_35px_rgba(20,42,32,.08)] sm:p-8">
          <p className="flex items-center gap-2 font-serif text-xl text-[#0b3d2e]"><Sparkles className="size-5 text-[#c09b54]" /> Belum ada percakapan</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65706c]">
            {ownerSide
              ? 'Belum ada calon pembeli/penyewa yang bertanya ke Homy AI tentang listing Anda. Begitu ada yang bertanya, ringkasannya otomatis muncul di sini.'
              : 'Pesan akan muncul otomatis setelah Anda bertanya ke Homy AI tentang sebuah properti. Coba mulai dari halaman properti atau Asisten AI.'}
          </p>
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Contoh pertanyaan</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((item) => (
                <Link key={item} href="/ai-assistant" className="rounded-full border border-[#e5dccd] bg-[#fbf8f3] px-3 py-1.5 text-xs font-semibold text-[#33433d] hover:border-[#0b3d2e]">{item}</Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {!busy && !needsAuth && threads.length > 0 && active && (
        <div className="mt-6 grid overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.08)] lg:min-h-[640px] lg:grid-cols-[340px_1fr]">
          {/* Daftar utas (per properti) */}
          <aside className={`border-[#e8dfd3] lg:block lg:border-r ${mobileThreadOpen ? 'hidden' : 'block'}`}>
            <div className="border-b border-[#e8dfd3] p-4">
              <label className="flex h-11 items-center gap-2 rounded-lg border border-[#e8dfd3] px-3 text-sm text-[#65706c]">
                <Search className="size-4 shrink-0" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari properti atau pertanyaan…" className="min-w-0 flex-1 bg-transparent outline-none" />
              </label>
            </div>
            <div className="max-h-[70vh] overflow-auto lg:max-h-none">
              {threads.map((thread) => {
                const isActive = thread.key === active.key
                const last = thread.rows[thread.rows.length - 1]
                const distinctBuyers = new Set(thread.rows.map((row) => row.userEmail ?? 'tamu')).size
                return (
                  <button
                    key={thread.key}
                    type="button"
                    onClick={() => selectThread(thread.key)}
                    className={`flex w-full gap-3 border-b border-[#f0e9df] p-4 text-left transition ${isActive ? 'bg-[#edf2ed]' : 'hover:bg-[#fbf8f3]'}`}
                  >
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-[#f2f0ea]">
                      {thread.image
                        ? <img src={thread.image} alt={thread.title} className="size-full object-cover" />
                        : <span className="grid size-full place-items-center text-[#a18a61]">{thread.propertyId ? <ImageIcon className="size-5" /> : <Sparkles className="size-5" />}</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-semibold text-[#0b3d2e]">{thread.title}</span>
                        <span className="shrink-0 text-xs text-[#9ca39e]">{relativeDay(thread.lastAt)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-xs text-[#c09b54]">{thread.location}{thread.listingType ? ` · ${thread.listingType === 'rent' ? 'Sewa' : 'Jual'}` : ''}</span>
                      <span className="mt-1 line-clamp-1 text-sm text-[#65706c]">{plainify(last.question)}</span>
                      <span className="mt-1 block text-xs text-[#9ca39e]">
                        {thread.rows.length} tanya-jawab{ownerSide && distinctBuyers > 1 ? ` · ${distinctBuyers} calon pembeli` : ''}
                      </span>
                    </span>
                  </button>
                )
              })}
              {!threads.length && <p className="p-4 text-sm text-[#718078]">Tidak ada percakapan yang cocok dengan pencarian.</p>}
            </div>
          </aside>

          {/* Transkrip percakapan utas terpilih */}
          <section className={`min-w-0 flex-col lg:flex ${mobileThreadOpen ? 'flex' : 'hidden'}`}>
            <div className="flex items-start gap-3 border-b border-[#e8dfd3] p-4 sm:p-5">
              <button type="button" onClick={() => setMobileThreadOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#d8ccbb] text-[#33433d] lg:hidden" aria-label="Kembali ke daftar pesan">
                <ArrowLeft className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-1 font-semibold text-[#0b3d2e]">{active.title}</h2>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-[#65706c]"><MapPin className="size-3.5 shrink-0" /> {active.location}{active.listingType ? ` · ${active.listingType === 'rent' ? 'Sewa' : 'Jual'}` : ''}</p>
                <p className="mt-1 text-xs text-[#9ca39e]">Terakhir aktif {fullStamp(active.lastAt)} WIB</p>
              </div>
              {active.propertyId && (
                <Link href={`/property/${active.propertyId}`} className="hidden shrink-0 items-center gap-1 rounded-lg border border-[#d8ccbb] px-3 py-2 text-xs font-semibold text-[#33433d] sm:inline-flex">
                  Lihat listing
                </Link>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-auto bg-[#fcfaf7] p-4 sm:p-6">
              {sessionsOf(active.rows).map((session) => (
                <div key={session.key} className="space-y-3">
                  {ownerSide && (
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-full bg-[#e2eee7] text-[#0b3d2e]"><UserIcon className="size-3.5" /></span>
                      <span className="text-xs font-semibold text-[#33433d]">{maskEmail(session.email)}</span>
                      <span className="text-xs text-[#9ca39e]">· {fullStamp(session.rows[0].createdAt)} WIB</span>
                    </div>
                  )}
                  {session.rows.map((row) => (
                    <div key={row.id} className="space-y-2">
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#0b3d2e] px-4 py-3 text-sm leading-6 text-white sm:max-w-[75%]">
                          <p className="mb-1 flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#f6e2a8]">
                            {row.isMine ? 'Anda' : maskEmail(row.userEmail)} <UserIcon className="size-3" />
                          </p>
                          <p className="whitespace-pre-wrap">{plainify(row.question)}</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm leading-6 text-[#33433d] shadow-[0_4px_14px_rgba(20,42,32,.06)] sm:max-w-[75%]">
                          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#a18a61]"><Bot className="size-3" /> Homy AI</p>
                          <p className="whitespace-pre-wrap">{plainify(row.answer)}</p>
                          <p className="mt-2 text-right text-[11px] text-[#9ca39e]">{clock(row.createdAt)} WIB</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="border-t border-[#e8dfd3] bg-white p-4 sm:p-5">
              <p className="text-sm text-[#65706c]">
                {ownerSide
                  ? 'Percakapan ini terjadi lewat Homy AI. Untuk menindaklanjuti calon pembeli, hubungi lewat menu Inquiries / Leads di dashboard.'
                  : active.propertyId
                    ? 'Ingin lanjut bertanya soal properti ini? Buka halaman propertinya dan tanyakan lewat panel Homy AI — percakapan baru otomatis tercatat di sini.'
                    : 'Ingin bertanya lagi? Buka Asisten AI atau halaman properti — setiap percakapan baru otomatis muncul di sini.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {active.propertyId && (
                  <Link href={`/property/${active.propertyId}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0b3d2e] px-4 text-sm font-semibold text-white hover:bg-[#14553f]"><Sparkles className="size-4" /> Tanya lewat halaman properti</Link>
                )}
                <Link href="/ai-assistant" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8ccbb] px-4 text-sm font-semibold text-[#33433d]">Asisten AI</Link>
                {ownerSide && (
                  <Link href={profile?.roles.includes('property_owner') && !profile?.roles.includes('agent') ? '/dashboard/property-owner/inquiries' : '/dashboard/agent/leads'} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8ccbb] px-4 text-sm font-semibold text-[#33433d]">
                    <MessageSquare className="size-4" /> Buka Inquiries / Leads
                  </Link>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {sessionLoading && !rows.length && !busy && !needsAuth && (
        <p className="mt-6 text-sm text-[#718078]">Menyiapkan kotak masuk…</p>
      )}
    </section>
  )
}
