/**
 * Homy — jadwal kunjungan properti (visits) + ketersediaan agen/pemilik.
 *
 * Dipakai oleh:
 *  - `app/api/visits/route.ts` (publik: lihat slot + booking kunjungan)
 *  - `app/api/ai/chat/route.ts` (Homy AI: menjawab pertanyaan jadwal & survey)
 *
 * Semua waktu ditampilkan dalam WIB (UTC+7, tanpa DST). Server-side only.
 */
import { createClient as createServiceClient } from '@supabase/supabase-js'

const WIB_OFFSET_MINUTES = 7 * 60
const LEAD_MINUTES = 120
const DEFAULT_DAYS = 14
const MAX_SLOTS = 60

export type AvailabilityRow = {
  user_id?: string | null
  weekday: number
  is_active?: boolean | null
  start_time?: string | null
  end_time?: string | null
  slot_minutes?: number | null
  mode?: string | null
  location?: string | null
  notes?: string | null
}

export type VisitSlot = {
  iso: string
  date: string
  dayLabel: string
  timeLabel: string
  weekday: number
  mode: string
  location?: string | null
}

export type VisitContext = {
  propertyId: string
  propertyTitle: string
  ownerId: string
  agentName: string | null
  agentPhone: string | null
  availability: AvailabilityRow[]
  taken: string[]
  slots: VisitSlot[]
}

export const MODE_LABEL: Record<string, string> = {
  onsite: 'Di lokasi',
  online: 'Online',
  both: 'Di lokasi / online',
}

const DAY_LABEL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const VALID_MODES = ['onsite', 'online', 'both']

/** Supabase service-role client (server-side). Return null kalau env belum lengkap. */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function minutesOfDay(value?: string | null) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const mins = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(mins) || hours > 23 || mins > 59) return null
  return hours * 60 + mins
}

function hhmm(minutes: number) {
  const safe = ((minutes % 1440) + 1440) % 1440
  return String(Math.floor(safe / 60)).padStart(2, '0') + ':' + String(safe % 60).padStart(2, '0')
}

/** Waktu "sekarang" dalam WIB, dibaca lewat getter UTC. */
function wibNow(at?: number) {
  return new Date((at ?? Date.now()) + WIB_OFFSET_MINUTES * 60_000)
}

function isoFromWib(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(Date.UTC(year, month, day, hour, minute) - WIB_OFFSET_MINUTES * 60_000).toISOString()
}

export function normalizeMode(value?: string | null) {
  const mode = String(value ?? 'both').trim().toLowerCase()
  return VALID_MODES.includes(mode) ? mode : 'both'
}

/** Bangun daftar slot kunjungan dari ketersediaan agen/pemilik. */
export function buildSlots(
  rows: AvailabilityRow[],
  taken: string[] = [],
  options?: { days?: number; now?: number; maxSlots?: number },
): VisitSlot[] {
  const days = options?.days ?? DEFAULT_DAYS
  const maxSlots = options?.maxSlots ?? MAX_SLOTS
  const nowMs = options?.now ?? Date.now()
  const takenSet = new Set(taken.map((value) => new Date(value).toISOString()))
  const base = wibNow(nowMs)
  const slots: VisitSlot[] = []

  for (let offset = 0; offset < days && slots.length < maxSlots; offset += 1) {
    const cursor = new Date(base.getTime() + offset * 86_400_000)
    const weekday = cursor.getUTCDay()
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth()
    const day = cursor.getUTCDate()
    const daySlots = rows.filter((row) => row.is_active !== false && Number(row.weekday) === weekday)
    if (!daySlots.length) continue
    const dayLabel = DAY_LABEL[weekday] + ', ' + day + ' ' + MONTH_LABEL[month]

    for (const row of daySlots) {
      const start = minutesOfDay(row.start_time)
      const end = minutesOfDay(row.end_time)
      const step = Number(row.slot_minutes) > 0 ? Math.min(240, Math.max(15, Math.round(Number(row.slot_minutes)))) : 60
      if (start == null || end == null || end <= start) continue
      const mode = normalizeMode(row.mode)
      for (let minute = start; minute + step <= end && slots.length < maxSlots; minute += step) {
        const iso = isoFromWib(year, month, day, Math.floor(minute / 60), minute % 60)
        if (new Date(iso).getTime() - nowMs < LEAD_MINUTES * 60_000) continue
        if (takenSet.has(iso)) continue
        slots.push({
          iso,
          date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          dayLabel,
          timeLabel: `${hhmm(minute)}–${hhmm(minute + step)}`,
          weekday,
          mode,
          location: row.location ?? null,
        })
      }
    }
  }
  return slots
}

/** Ketersediaan mingguan (untuk konteks AI): "Senin 09:00–17:00 (slot 60 menit)". */
export function weeklySummary(rows: AvailabilityRow[]) {
  return rows
    .filter((row) => row.is_active !== false)
    .sort((a, b) => Number(a.weekday) - Number(b.weekday))
    .map((row) => {
      const start = minutesOfDay(row.start_time)
      const end = minutesOfDay(row.end_time)
      if (start == null || end == null) return null
      const step = Number(row.slot_minutes) > 0 ? Math.round(Number(row.slot_minutes)) : 60
      return `${DAY_LABEL[Number(row.weekday) % 7]} ${hhmm(start)}–${hhmm(end)} (slot ${step} menit, ${MODE_LABEL[normalizeMode(row.mode)]})`
    })
    .filter(Boolean)
    .join('; ')
}

/** Ambil properti + ketersediaan agen/pemilik + slot bebas. */
export async function getVisitContext(propertyId: string, options?: { days?: number; now?: number }): Promise<VisitContext | null> {
  const admin = serviceClient()
  if (!admin || !propertyId) return null
  const { data: property } = await admin
    .from('properties')
    .select('id,title,status,owner_id')
    .eq('id', propertyId)
    .maybeSingle()
  const row = property as { id?: string; title?: string | null; status?: string | null; owner_id?: string | null } | null
  if (!row?.id || !row.owner_id) return null
  const ownerId = String(row.owner_id)

  const [availability, visits, profile] = await Promise.all([
    admin
      .from('partner_availability')
      .select('user_id,weekday,is_active,start_time,end_time,slot_minutes,mode,location')
      .eq('user_id', ownerId)
      .eq('is_active', true),
    admin.from('visits').select('scheduled_at,status').eq('property_id', row.id).neq('status', 'cancelled'),
    admin.from('profiles').select('id,full_name,phone').eq('id', ownerId).maybeSingle(),
  ])

  const availabilityRows = (availability.data ?? []) as AvailabilityRow[]
  const taken = (visits.data ?? []).map((item: { scheduled_at?: string | null }) => new Date(String(item.scheduled_at)).toISOString())
  const agent = profile.data as { full_name?: string | null; phone?: string | null } | null

  return {
    propertyId: String(row.id),
    propertyTitle: String(row.title ?? 'Properti'),
    ownerId,
    agentName: agent?.full_name ?? null,
    agentPhone: agent?.phone ?? null,
    availability: availabilityRows,
    taken,
    slots: buildSlots(availabilityRows, taken, { days: options?.days, now: options?.now }),
  }
}

/** Blok teks ketersediaan untuk prompt Homy AI. */
export function availabilityBlock(ctx: VisitContext) {
  const weekly = weeklySummary(ctx.availability)
  const lines = [`=== JADWAL KUNJUNGAN (WIB) ===`, `Agen/pemilik penanggung jawab: ${ctx.agentName || 'agen Homy'}`]
  if (!weekly) {
    lines.push('Agen/pemilik BELUM mengatur jadwal ketersediaan di Homy.')
    lines.push('Arahan: minta pengguna mengirim pertanyaan lewat form "Tanya pemilik" di halaman ini supaya agen/pemilik menghubungi balik untuk mengatur waktu survey.')
    return lines.join('\n')
  }
  lines.push('Ketersediaan rutin: ' + weekly)
  const upcoming = ctx.slots.slice(0, 8)
  if (upcoming.length) {
    lines.push(
      'Slot terdekat yang masih kosong: ' +
        upcoming.map((slot) => `${slot.dayLabel} ${slot.timeLabel}${slot.mode === 'online' ? ' (online)' : ''}`).join(' | '),
    )
    lines.push('Kalau pengguna ingin survey/lihat unit, arahkan memilih salah satu slot di panel "Jadwalkan kunjungan" pada halaman ini — jadwal otomatis tercatat untuk agen/pemilik.')
  } else {
    lines.push('Belum ada slot kosong dalam 14 hari ke depan — arahkan pengguna mengirim pertanyaan lewat form "Tanya pemilik".')
  }
  return lines.join('\n')
}
