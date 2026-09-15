'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Bell, BellRing, CalendarDays, CalendarX, CheckCircle2, Inbox, Loader2, MessageSquare, Search, Sparkles, Trash2, X, XCircle } from 'lucide-react'

type NotificationItem = {
  id: string
  kind: string
  title: string
  body: string | null
  href: string | null
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

type SavedAlert = { id: string; label: string | null }

type BellVariant = 'light' | 'plain'

const META: Record<string, { icon: typeof Bell; tint: string; soft: string }> = {
  'inquiry.new': { icon: MessageSquare, tint: '#0b3d2e', soft: '#e2eee7' },
  'inquiry.reply': { icon: Sparkles, tint: '#8a6d21', soft: '#fdf3dc' },
  'visit.new': { icon: CalendarDays, tint: '#0f2a44', soft: '#e6ecf3' },
  'visit.confirmed': { icon: CheckCircle2, tint: '#2f6f4f', soft: '#e2eee7' },
  'visit.cancelled': { icon: CalendarX, tint: '#a34438', soft: '#fbeeec' },
  'visit.completed': { icon: CheckCircle2, tint: '#2f6f4f', soft: '#e2eee7' },
  'listing.approved': { icon: BadgeCheck, tint: '#2f6f4f', soft: '#e2eee7' },
  'listing.rejected': { icon: XCircle, tint: '#a34438', soft: '#fbeeec' },
  'listing.match': { icon: Search, tint: '#8a6d21', soft: '#fdf3dc' },
  'alert.saved': { icon: BellRing, tint: '#0b3d2e', soft: '#e2eee7' },
  system: { icon: Bell, tint: '#0b3d2e', soft: '#f2f0ea' },
}

function meta(kind: string) {
  return META[kind] ?? META.system
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  const minute = 60000
  const hour = 3600000
  const day = 86400000
  if (diff < minute) return 'baru saja'
  if (diff < hour) return Math.floor(diff / minute) + ' menit lalu'
  if (diff < day) return Math.floor(diff / hour) + ' jam lalu'
  if (diff < 2 * day) return 'kemarin'
  if (diff < 7 * day) return Math.floor(diff / day) + ' hari lalu'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export function NotificationBell({ variant = 'plain' }: { variant?: BellVariant }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [alerts, setAlerts] = useState<SavedAlert[]>([])
  const [busy, setBusy] = useState(false)
  const hostRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=20', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (payload?.authenticated === false) { setItems([]); setUnread(0); return }
      setItems(Array.isArray(payload?.data) ? payload.data : [])
      setUnread(Number(payload?.unread ?? 0) || 0)
    } catch { /* diamkan */ } finally { setLoading(false) }
  }, [])

  const loadAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      setAlerts(Array.isArray(payload?.data) ? payload.data.map((row: { id: string; label: string | null }) => ({ id: row.id, label: row.label })) : [])
    } catch { /* diamkan */ }
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => { void load() }, 45000)
    const onFocus = () => { void load() }
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [load])

  useEffect(() => {
    if (!open) return
    void load(); void loadAlerts()
    const onClick = (event: MouseEvent) => { if (hostRef.current && !hostRef.current.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open, load, loadAlerts])

  async function act(body: Record<string, unknown>) {
    setBusy(true)
    try {
      await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      await load()
    } finally { setBusy(false) }
  }

  async function openItem(item: NotificationItem) {
    setItems((rows) => rows.map((row) => (row.id === item.id ? { ...row, read_at: row.read_at ?? new Date().toISOString() } : row)))
    if (!item.read_at) setUnread((value) => Math.max(0, value - 1))
    if (!item.read_at) void act({ action: 'read', id: item.id })
    setOpen(false)
    if (item.href) router.push(item.href)
  }

  async function removeAlert(id: string) {
    setAlerts((rows) => rows.filter((row) => row.id !== id))
    await fetch('/api/alerts?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => null)
  }

  const buttonClass = variant === 'light'
    ? 'relative grid size-9 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20 sm:size-10'
    : 'relative grid size-9 place-items-center rounded-full border border-[#e5dccd] bg-white text-[#0b3d2e] transition hover:border-[#c9a961] sm:size-10'

  return (
    <div ref={hostRef} className="relative">
      <button type="button" className={buttonClass} aria-label={unread > 0 ? 'Notifikasi, ' + unread + ' belum dibaca' : 'Notifikasi'} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
        <Bell className="size-4 sm:size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-[#b45c50] px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-[#f7f3ec]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifikasi" className="absolute right-0 top-12 z-40 flex max-h-[75vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[#e5dccd] bg-white shadow-[0_24px_60px_rgba(20,42,32,.18)]">
          <div className="flex items-center justify-between gap-2 border-b border-[#eee7dc] px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="font-serif text-base text-[#0b3d2e]">Notifikasi</p>
              {unread > 0 && <span className="rounded-full bg-[#e2eee7] px-2 py-0.5 text-[11px] font-semibold text-[#0b3d2e]">{unread} baru</span>}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && <button type="button" disabled={busy} onClick={() => { void act({ action: 'read_all' }) }} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#4e866d] transition hover:bg-[#f2f7f4] disabled:opacity-50">Tandai semua</button>}
              <button type="button" disabled={busy} onClick={() => { void act({ action: 'clear_read' }) }} aria-label="Bersihkan yang sudah dibaca" className="grid size-7 place-items-center rounded-lg text-[#718078] transition hover:bg-[#f7f3ec] disabled:opacity-50"><Trash2 className="size-3.5" /></button>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="border-b border-[#eee7dc] bg-[#fbfaf7] px-4 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#a18a61]">Pencarian tersimpan</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {alerts.map((alert) => (
                  <span key={alert.id} className="inline-flex items-center gap-1 rounded-full border border-[#e5dccd] bg-white py-1 pl-2.5 pr-1 text-[11px] text-[#33433d]">
                    {alert.label || 'Pencarian'}
                    <button type="button" onClick={() => { void removeAlert(alert.id) }} aria-label="Hapus pencarian" className="grid size-4 place-items-center rounded-full text-[#a09a8c] transition hover:bg-[#fbeeec] hover:text-[#b45c50]"><X className="size-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && items.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#718078]"><Loader2 className="size-4 animate-spin" /> Memuat notifikasi…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#f2f0ea] text-[#a18a61]"><Inbox className="size-5" /></span>
                <p className="mt-3 font-semibold text-[#20332c]">Belum ada notifikasi</p>
                <p className="mt-1 text-xs leading-5 text-[#718078]">Aktivitas listing, pertanyaan pembeli, jadwal kunjungan, dan properti baru yang cocok dengan pencarian Anda akan muncul di sini.</p>
              </div>
            )}
            {items.map((item) => {
              const config = meta(item.kind)
              const Icon = config.icon
              const unreadItem = !item.read_at
              return (
                <button key={item.id} type="button" onClick={() => { void openItem(item) }} className={'flex w-full gap-3 border-b border-[#f2f0ea] px-4 py-3 text-left transition hover:bg-[#fbfaf7] ' + (unreadItem ? 'bg-[#f7fbf9]' : '')}>
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: config.soft, color: config.tint }}><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className={'text-sm leading-snug ' + (unreadItem ? 'font-semibold text-[#0b3d2e]' : 'font-medium text-[#33433d]')}>{item.title}</span>
                      {unreadItem && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#4e866d]" />}
                    </span>
                    {item.body && <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[#718078]">{item.body}</span>}
                    <span className="mt-1 block text-[11px] text-[#a09a8c]">{timeAgo(item.created_at)}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="border-t border-[#eee7dc] bg-[#fbfaf7] px-4 py-2 text-center text-[11px] text-[#a09a8c]">Notifikasi diperbarui otomatis tiap 45 detik</div>
        </div>
      )}
    </div>
  )
}
