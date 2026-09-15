import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const ADMIN_ROLES = ['admin', 'super_admin']
const SUPER_ROLES = ['super_admin']
const GRANTABLE = ['user', 'agent', 'property_owner', 'admin', 'super_admin']

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function requireRole(allowed: string[]) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = Array.isArray(roles) ? roles.map((r: { role: string }) => r.role) : []
  if (!list.some((r) => allowed.includes(r))) {
    return { error: NextResponse.json({ error: 'Anda tidak punya akses untuk aksi ini' }, { status: 403 }) }
  }
  return { user, roles: list }
}

export async function POST(request: Request) {
  const gate = await requireRole(ADMIN_ROLES)
  if (gate.error) return gate.error
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  const actor = gate.user!

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }) }
  const kind = String(body.kind ?? '')
  const now = new Date().toISOString()
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''

  async function audit(action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) {
    try { await admin.from('audit_logs').insert({ actor_id: actor.id, action, entity_type: entityType, entity_id: entityId, metadata }) } catch { /* best effort */ }
  }

  // ---------- Penagihan: verifikasi / tolak laporan transaksi mitra ----------
  if (kind === 'billing.verify' || kind === 'billing.reject') {
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'ID laporan wajib' }, { status: 400 })
    const { data: before } = await admin.from('transaction_reports').select('id,property_title,sale_price,commission_amount,user_id,role,status').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'Laporan transaksi tidak ditemukan' }, { status: 404 })
    const status = kind === 'billing.verify' ? 'verified' : 'rejected'
    const patch: Record<string, unknown> = { status, review_note: note || null, verified_by: actor.id, verified_at: now, updated_at: now }
    const { error } = await admin.from('transaction_reports').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await audit(kind === 'billing.verify' ? 'transaction.verified' : 'transaction.rejected', 'transaction_report', id, { previous_status: before.status, commission_amount: before.commission_amount, sale_price: before.sale_price, note })
    return NextResponse.json({ ok: true, status, id })
  }

  // ---------- Laporan & penipuan ----------
  if (kind === 'report.resolve' || kind === 'report.investigate' || kind === 'report.dismiss') {
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'ID laporan wajib' }, { status: 400 })
    const status = kind === 'report.resolve' ? 'resolved' : kind === 'report.investigate' ? 'investigating' : 'dismissed'
    const patch: Record<string, unknown> = { status, resolution_note: note || null, resolved_by: actor.id }
    if (status !== 'investigating') patch.resolved_at = now
    const { error } = await admin.from('moderation_reports').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await audit('report.' + status, 'moderation_report', id, { note })
    return NextResponse.json({ ok: true, status, id })
  }

  // ---------- Peran & izin (super admin) ----------
  if (kind === 'role.grant' || kind === 'role.revoke') {
    const superGate = await requireRole(SUPER_ROLES)
    if (superGate.error) return superGate.error
    const userId = String(body.userId ?? '')
    const role = String(body.role ?? '')
    if (!userId || !GRANTABLE.includes(role)) return NextResponse.json({ error: 'Peran tidak valid' }, { status: 400 })
    if (kind === 'role.revoke' && role === 'super_admin' && userId === actor.id) {
      return NextResponse.json({ error: 'Tidak bisa mencabut peran super admin dari akun sendiri' }, { status: 409 })
    }
    if (kind === 'role.grant') {
      const { error } = await admin.from('user_roles').upsert({ user_id: userId, role, status: 'active', granted_at: now }, { onConflict: 'user_id,role' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit('role.granted', 'user_role', userId, { role })
      return NextResponse.json({ ok: true, role, granted: true })
    }
    const { error } = await admin.from('user_roles').delete().eq('user_id', userId).eq('role', role)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await audit('role.revoked', 'user_role', userId, { role })
    return NextResponse.json({ ok: true, role, granted: false })
  }

  // ---------- Feature flags (super admin) ----------
  if (kind === 'flag.update') {
    const superGate = await requireRole(SUPER_ROLES)
    if (superGate.error) return superGate.error
    const key = String(body.key ?? '')
    if (!key) return NextResponse.json({ error: 'Key flag wajib' }, { status: 400 })
    const patch: Record<string, unknown> = { updated_at: now, updated_by: actor.id }
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
    if (body.rollout !== undefined) patch.rollout = Math.max(0, Math.min(100, Number(body.rollout) || 0))
    const { data, error } = await admin.from('feature_flags').update(patch).eq('key', key).select('key,label,description,enabled,rollout,updated_at').maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await audit('flag.updated', 'feature_flag', null, { key, ...patch })
    return NextResponse.json({ ok: true, flag: data })
  }

  // ---------- Konfigurasi platform (super admin) ----------
  if (kind === 'setting.update') {
    const superGate = await requireRole(SUPER_ROLES)
    if (superGate.error) return superGate.error
    const key = String(body.key ?? '')
    if (!key) return NextResponse.json({ error: 'Key konfigurasi wajib' }, { status: 400 })
    const value = body.value ?? {}
    const { data, error } = await admin.from('platform_settings').upsert({ key, value, updated_at: now, updated_by: actor.id }, { onConflict: 'key' }).select('key,label,value,updated_at').maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await audit('setting.updated', 'platform_setting', null, { key, value })
    return NextResponse.json({ ok: true, setting: data })
  }

  return NextResponse.json({ error: 'Aksi tidak dikenal: ' + kind }, { status: 400 })
}
