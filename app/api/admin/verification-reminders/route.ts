/**
 * Homy — pengingat verifikasi mitra (agen/pemilik yang belum melengkapi).
 *
 *  GET  : daftar mitra yang masih perlu melengkapi verifikasi + status pengingat terakhir.
 *  POST : kirim pengingat (notifikasi in-app + email bila Resend aktif).
 *
 * Hanya admin & super admin. Semua penulisan lewat service role, lalu dicatat di audit_logs.
 */
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/notifications'
import { isEmailConfigured, sendVerificationReminderEmail } from '@/lib/email'
import { REQUIREMENT_LABELS, completionPercent, missingRequirements } from '@/lib/verification'

const ADMIN_ROLES = ['admin', 'super_admin']
const PARTNER_ROLES = ['agent', 'property_owner']
const COOLDOWN_DAYS = 7
const MAX_RECIPIENTS = 200
const ROLE_LABEL: Record<string, string> = { agent: 'Agen Properti', property_owner: 'Pemilik Properti' }

type Target = {
  userId: string
  name: string | null
  email: string | null
  phone: string | null
  roles: string[]
  roleLabels: string[]
  missing: string[]
  percent: number
  status: string
  lastReminderAt: string | null
  cooldown: boolean
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = Array.isArray(roles) ? roles.map((row: { role: string }) => row.role) : []
  if (!list.some((role) => ADMIN_ROLES.includes(role))) {
    return { error: NextResponse.json({ error: 'Anda tidak punya akses untuk aksi ini' }, { status: 403 }) }
  }
  return { user }
}

/** Mitra aktif (agen/pemilik) yang verifikasinya belum selesai/ditinjau. */
async function collectTargets(admin: NonNullable<ReturnType<typeof serviceClient>>): Promise<Target[]> {
  const { data: roleRows } = await admin.from('user_roles').select('user_id,role,status').in('role', PARTNER_ROLES)
  const byUser = new Map<string, string[]>()
  for (const row of (roleRows ?? []) as Array<{ user_id?: string | null; role?: string | null; status?: string | null }>) {
    if (String(row.status ?? 'active') !== 'active') continue
    const userId = String(row.user_id ?? '')
    const role = String(row.role ?? '')
    if (!userId || !PARTNER_ROLES.includes(role)) continue
    const list = byUser.get(userId) ?? []
    if (!list.includes(role)) list.push(role)
    byUser.set(userId, list)
  }
  const ids = Array.from(byUser.keys()).slice(0, MAX_RECIPIENTS)
  if (!ids.length) return []

  // Staf platform (admin/super admin) tidak diingatkan sebagai mitra.
  const { data: staffRows } = await admin.from('user_roles').select('user_id,role').in('user_id', ids).in('role', ADMIN_ROLES)
  const staff = new Set(((staffRows ?? []) as Array<{ user_id?: string | null }>).map((row) => String(row.user_id ?? '')))

  const select = 'user_id,requested_role,status,full_name,phone,identity_type,identity_number,birth_date,gender,address,city,province,bank_name,bank_account_number,bank_account_name,identity_doc_path,selfie_doc_path,availability,agreement_id,submitted_at,updated_at'
  const since = new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString()

  const [verifications, profiles, reminders] = await Promise.all([
    admin.from('partner_verifications').select(select).in('user_id', ids),
    admin.from('profiles').select('id,full_name,phone').in('id', ids),
    admin.from('notifications').select('user_id,created_at').eq('kind', 'verification.reminder').gte('created_at', since).in('user_id', ids),
  ])

  const verByKey = new Map<string, Record<string, unknown>>()
  for (const row of (verifications.data ?? []) as Array<Record<string, unknown>>) verByKey.set(`${row.user_id}:${row.requested_role}`, row)
  const profileMap = new Map<string, { full_name?: string | null; phone?: string | null }>()
  for (const row of (profiles.data ?? []) as Array<{ id: string; full_name?: string | null; phone?: string | null }>) profileMap.set(String(row.id), row)
  const lastReminder = new Map<string, string>()
  for (const row of (reminders.data ?? []) as Array<{ user_id?: string | null; created_at?: string | null }>) {
    const userId = String(row.user_id ?? '')
    const at = String(row.created_at ?? '')
    if (!userId || !at) continue
    const current = lastReminder.get(userId)
    if (!current || at > current) lastReminder.set(userId, at)
  }

  const targets: Target[] = []
  for (const userId of ids) {
    if (staff.has(userId)) continue
    const roles = byUser.get(userId) ?? []
    const pending: string[] = []
    const missingLabels = new Set<string>()
    let percent = 100
    let status = 'none'
    for (const role of roles) {
      const record = verByKey.get(`${userId}:${role}`) ?? null
      const recordStatus = String(record?.status ?? 'none')
      if (recordStatus === 'pending' || recordStatus === 'approved') continue
      pending.push(role)
      status = recordStatus
      percent = Math.min(percent, record ? completionPercent(record) : 0)
      for (const key of missingRequirements(record)) missingLabels.add(REQUIREMENT_LABELS[key] ?? String(key))
    }
    if (!pending.length) continue // sudah dikirim/diverifikasi → tidak perlu diingatkan

    const profile = profileMap.get(userId)
    const verificationRow = verByKey.get(`${userId}:${pending[0]}`) ?? null
    const lastAt = lastReminder.get(userId) ?? null
    targets.push({
      userId,
      name: profile?.full_name ?? (verificationRow?.full_name ? String(verificationRow.full_name) : null),
      email: null,
      phone: profile?.phone ?? (verificationRow?.phone ? String(verificationRow.phone) : null),
      roles: pending,
      roleLabels: pending.map((role) => ROLE_LABEL[role] ?? role),
      missing: Array.from(missingLabels),
      percent: Number.isFinite(percent) ? percent : 0,
      status,
      lastReminderAt: lastAt,
      cooldown: Boolean(lastAt),
    })
  }

  // Email diambil lewat auth admin (profiles tidak menyimpan email).
  await Promise.all(
    targets.map(async (target) => {
      try {
        const { data } = await admin.auth.admin.getUserById(target.userId)
        target.email = data?.user?.email ?? null
      } catch { /* email opsional */ }
    }),
  )

  targets.sort((a, b) => b.missing.length - a.missing.length || (a.name ?? '').localeCompare(b.name ?? ''))
  return targets
}

export async function GET() {
  const gate = await requireAdmin()
  if (gate.error) return gate.error
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const targets = await collectTargets(admin)
  const dueCount = targets.filter((target) => !target.cooldown).length
  return NextResponse.json({
    ok: true,
    cooldownDays: COOLDOWN_DAYS,
    emailConfigured: isEmailConfigured(),
    dueCount,
    total: targets.length,
    targets,
  })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (gate.error) return gate.error
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  const actor = gate.user!

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { body = {} }
  const requested = Array.isArray(body.userIds) ? body.userIds.map((value) => String(value)).filter(Boolean) : null
  const force = body.force === true
  const note = typeof body.message === 'string' ? body.message.trim().slice(0, 400) : ''

  const all = await collectTargets(admin)
  const selected = requested ? all.filter((target) => requested.includes(target.userId)) : all
  const wanted = selected.filter((target) => force || !target.cooldown)
  const onCooldown = selected.filter((target) => !force && target.cooldown)

  const sent: Array<{ userId: string; name: string | null; email: string | null; inApp: boolean; emailSent: boolean }> = []
  for (const target of wanted) {
    const roleText = target.roleLabels.join(' & ')
    let inApp = false
    try {
      const written = await notifyUser({
        userId: target.userId,
        kind: 'verification.reminder',
        title: `Lengkapi verifikasi ${roleText} Anda`,
        body: target.missing.length
          ? `Masih ada ${target.missing.length} bagian yang perlu dilengkapi: ${target.missing.slice(0, 4).join(', ')}${target.missing.length > 4 ? ', …' : ''}.`
          : 'Data utama sudah terisi — silakan tinjau lalu kirim pengajuan verifikasi Anda.',
        href: `/verify?role=${encodeURIComponent(target.roles[0] ?? 'agent')}`,
        data: { source: 'admin-reminder', actor: actor.id, roles: target.roles, percent: target.percent },
      })
      inApp = written > 0
    } catch { inApp = false }

    let emailSent = false
    if (target.email) {
      const result = await sendVerificationReminderEmail({
        to: target.email,
        name: target.name,
        roles: target.roles,
        missing: target.missing,
        percent: target.percent,
        message: note || null,
      })
      emailSent = result.ok === true
    }
    sent.push({ userId: target.userId, name: target.name, email: target.email, inApp, emailSent })
  }

  try {
    await admin.from('audit_logs').insert({
      actor_id: actor.id,
      action: 'verification.reminded',
      entity_type: 'partner_verification',
      entity_id: null,
      metadata: {
        count: sent.length,
        users: sent.map((item) => item.userId),
        roles: Array.from(new Set(wanted.flatMap((target) => target.roles))),
        force,
        cooldown_skipped: onCooldown.map((target) => target.userId),
      },
    })
  } catch { /* audit best effort */ }

  return NextResponse.json({
    ok: true,
    sent,
    skipped: onCooldown.map((target) => ({ userId: target.userId, name: target.name, reason: `Sudah diingatkan pada ${target.lastReminderAt}` })),
    emailConfigured: isEmailConfigured(),
  })
}
