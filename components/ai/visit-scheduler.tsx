'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Check, Loader2, LogIn, MapPin, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Slot = { iso: string; date: string; dayLabel: string; timeLabel: string; weekday: number; mode: string }
type Day = { date: string; dayLabel: string; slots: Slot[] }
type Payload = {
  ok?: boolean
  agentName?: string | null
  configured?: boolean
  weekly?: string | null
  modeLabel?: string | null
  days?: Day[]
  total?: number
  error?: string
}
type Done = { dayLabel: string; timeLabel: string; mode: string; message: string; agent?: string | null; emailOk?: boolean }

const MODE_TEXT: Record<string, string> = { onsite: 'Di lokasi', online: 'Online', both: 'Di lokasi / online' }

/** Panel jadwal kunjungan: Homy AI memaparkan ketersediaan agen/pemilik, pengguna memilih slot. */
export function VisitScheduler({ propertyId }: { propertyId?: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Payload | null>(null)
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [picked, setPicked] = useState<Slot | null>(null)
  const [notes, setNotes] = useState('')
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    try {
      const response = await fetch('/api/visits?propertyId=' + encodeURIComponent(propertyId), { cache: 'no-store' })
      const payload = (await response.json().catch(() => ({}))) as Payload
      if (!response.ok) throw new Error(payload?.error || 'Gagal memuat jadwal ketersediaan.')
      setData(payload)
      setActiveDay(payload.days?.[0]?.date ?? null)
      setPicked(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat jadwal ketersediaan.')
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    let cancelled = false
    createClient()
      .auth.getUser()
      .then(({ data: session }) => { if (!cancelled) setSignedIn(Boolean(session.user)) })
      .catch(() => { if (!cancelled) setSignedIn(false) })
    return () => { cancelled = true }
  }, [])

  async function book() {
    if (!picked || !propertyId || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, scheduledAt: picked.iso, notes }),
      })
      const payload = await response.json().catch(() => ({}))
      if (response.status === 401) {
        setSignedIn(false)
        throw new Error(payload?.error || 'Masuk dulu untuk menjadwalkan kunjungan.')
      }
      if (!response.ok) {
        if (response.status === 409) void load()
        throw new Error(payload?.error || 'Gagal mengirim jadwal kunjungan.')
      }
      setDone({
        dayLabel: payload?.slot?.dayLabel ?? picked.dayLabel,
        timeLabel: payload?.slot?.timeLabel ?? picked.timeLabel,
        mode: payload?.slot?.mode ?? picked.mode,
        message: String(payload?.message ?? 'Jadwal tercatat.'),
        agent: payload?.agent?.name ?? null,
        emailOk: Boolean(payload?.email?.ok),
      })
      setNotes('')
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim jadwal kunjungan.')
    } finally {
      setBusy(false)
    }
  }

  const days = data?.days ?? []
  const current = days.find((day) => day.date === activeDay) ?? days[0] ?? null

  return (
    <div data-visit-scheduler className="min-w-0 rounded-2xl bg-white p-4 sm:p-6 shadow-[0_10px_35px_rgba(20,42,32,.07)]">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-5 text-[#0b3d2e]" />
        <h2 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Jadwalkan kunjungan</h2>
      </div>
      <p className="mt-2 text-sm text-[#65706c]">
        {data?.agentName ? 'Jadwal ketersediaan ' + data.agentName + '.' : 'Jadwal ketersediaan agen/pemilik.'} Pilih waktu yang cocok, agen/pemilik langsung dapat notifikasi.
      </p>

      {done ? (
        <div className="mt-4 rounded-xl bg-[#edf2ed] p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]"><Check className="size-4" /> Jadwal terkirim</p>
          <p className="mt-2 text-sm text-[#33433d]">{done.dayLabel} · {done.timeLabel} ({MODE_TEXT[done.mode] ?? done.mode})</p>
          {done.agent && <p className="mt-1 text-xs text-[#718078]">Penanggung jawab: {done.agent}</p>}
          <p className="mt-2 text-xs leading-5 text-[#718078]">{done.message}</p>
          <button type="button" onClick={() => { setDone(null); void load() }} className="mt-3 rounded-lg border border-[#d8ccbb] px-3 py-1.5 text-xs font-semibold text-[#33433d] hover:bg-white">
            Pilih jadwal lain
          </button>
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-8 animate-pulse rounded-lg bg-[#f7f3ec]" />
          <div className="h-16 animate-pulse rounded-lg bg-[#f7f3ec]" />
        </div>
      ) : !data?.configured || !days.length ? (
        <div className="mt-4 rounded-xl bg-[#f7f3ec] p-4 text-sm text-[#65706c]">
          <p>{data?.configured ? 'Belum ada slot kosong dalam 14 hari ke depan.' : 'Agen/pemilik belum mengatur jadwal ketersediaan di Homy.'}</p>
          <p className="mt-2 text-xs leading-5 text-[#718078]">Kirim pertanyaan lewat form <strong>Tanya pemilik</strong> di halaman ini — agen/pemilik akan menghubungi Anda untuk mengatur waktu survey.</p>
        </div>
      ) : (
        <>
          {data?.weekly && <p className="mt-3 rounded-lg bg-[#f7f3ec] px-3 py-2 text-xs leading-5 text-[#65706c]">Ketersediaan rutin: {data.weekly}</p>}
          <div className="mt-3 -mx-1 flex max-w-full min-w-0 gap-2 overflow-x-auto px-1 pb-1">
            {days.map((day) => (
              <button
                key={day.date}
                type="button"
                onClick={() => { setActiveDay(day.date); setPicked(null) }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${day.date === (current?.date ?? '') ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white' : 'border-[#e5dccd] bg-white text-[#33433d] hover:border-[#0b3d2e]'}`}
              >
                {day.dayLabel}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(current?.slots ?? []).map((slot) => {
              const on = picked?.iso === slot.iso
              return (
                <button
                  key={slot.iso}
                  type="button"
                  onClick={() => setPicked(slot)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold ${on ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white' : 'border-[#e5dccd] bg-white text-[#33433d] hover:border-[#0b3d2e]'}`}
                >
                  {slot.mode === 'online' ? <Video className="size-3.5" /> : <CalendarClock className="size-3.5" />}
                  {slot.timeLabel}
                </button>
              )
            })}
          </div>
          {current?.slots?.[0]?.mode && (
            <p className="mt-2 text-xs text-[#718078]">Mode kunjungan: {MODE_TEXT[current.slots[0].mode] ?? current.slots[0].mode}</p>
          )}

          {picked && (
            <div className="mt-4 rounded-xl border border-[#e5dccd] p-3">
              <p className="text-sm font-semibold text-[#0b3d2e]">{picked.dayLabel} · {picked.timeLabel}</p>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Catatan (opsional): misal mau lihat dapur & garasi"
                className="mt-2 w-full rounded-lg border border-[#e8dfd3] p-2.5 text-sm outline-none focus:border-[#0b3d2e]"
              />
              {signedIn === false ? (
                <a href={'/auth/login?next=' + encodeURIComponent('/property/' + String(propertyId ?? ''))} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b3d2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14553f]">
                  <LogIn className="size-4" /> Masuk untuk menjadwalkan
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => { void book() }}
                  disabled={busy || signedIn === null}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b3d2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14553f] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                  {busy ? 'Mengirim…' : 'Kirim jadwal kunjungan'}
                </button>
              )}
              <p className="mt-2 text-xs leading-5 text-[#718078]">Agen/pemilik menerima notifikasi email dan jadwal otomatis tercatat di dashboard mereka.</p>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 rounded-lg bg-[#fbeeec] px-3 py-2 text-xs text-[#b45c50]">{error}</p>}
    </div>
  )
}
