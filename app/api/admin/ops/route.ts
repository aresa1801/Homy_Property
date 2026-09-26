import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/notifications'
import { sendPartnerStatusEmail } from '@/lib/email'
import { sanitizeAreas, NOTARY_REQUEST_STATUS_META } from '@/lib/notary'

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

  // ---------- Partnership & kontak (moderasi calon mitra) ----------
  if (kind === 'partnership.review') {
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'ID pengajuan wajib' }, { status: 400 })
    const status = String(body.status ?? '')
    if (!['reviewing', 'contacted', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Status pengajuan tidak valid' }, { status: 400 })
    }
    const { data: before } = await admin
      .from('partner_leads')
      .select('id,kind,full_name,email,phone,company,position,city,province,website,license_no,entity_type,npwp,coverage_area,services,focus_areas,user_id,metadata,status')
      .eq('id', id)
      .maybeSingle()
    if (!before) return NextResponse.json({ error: 'Pengajuan kemitraan tidak ditemukan' }, { status: 404 })
    if (status === 'rejected' && !note) {
      return NextResponse.json({ error: 'Catatan alasan wajib diisi agar bisa dikirim ke calon mitra' }, { status: 400 })
    }

    // 1) Kirim balasan email ke calon mitra (best effort).
    const mail = await sendPartnerStatusEmail({
      to: String(before.email ?? ''),
      fullName: before.full_name,
      kind: before.kind,
      status: status as 'reviewing' | 'contacted' | 'approved' | 'rejected',
      note: note || null,
    })

    const { error } = await admin
      .from('partner_leads')
      .update({
        status,
        review_note: note || null,
        reviewed_by: actor.id,
        reviewed_at: now,
        updated_at: now,
        last_emailed_at: mail.skipped ? null : now,
        last_email_status: mail.ok ? 'sent' : mail.skipped ? 'skipped' : 'failed',
        last_email_subject: mail.subject ?? null,
      })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const action = status === 'approved' ? 'partnership.approved' : status === 'rejected' ? 'partnership.rejected' : 'partnership.' + status
    await audit(action, 'partner_lead', id, { previous_status: before.status, kind: before.kind, note, email: mail.ok ? 'sent' : mail.skipped ? 'skipped' : 'failed' })

    // 2) Notaris yang disetujui otomatis tayang di direktori notaris (mitra legal).
    let notaryId: string | null = null
    if (String(before.kind) === 'notary') {
      const metadata = (before.metadata ?? {}) as Record<string, unknown>
      const structured = sanitizeAreas(metadata.areas)
      const fromCoverage = String(before.coverage_area ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((name) => ({ province: String(before.province ?? ''), kabupaten: name, kecamatan: '' }))
      const areas = structured.length ? structured : fromCoverage
      const notaryRecord = {
        lead_id: id,
        user_id: before.user_id ?? null,
        name: String(before.full_name ?? 'Notaris'),
        office_name: before.company ?? null,
        sk_no: before.license_no ?? null,
        entity_type: before.entity_type ?? null,
        npwp: before.npwp ?? null,
        phone: before.phone ?? null,
        whatsapp: before.phone ?? null,
        email: before.email ?? null,
        website: before.website ?? null,
        province: areas[0]?.province || before.province || null,
        kabupaten: areas[0]?.kabupaten || null,
        kecamatan: areas[0]?.kecamatan || null,
        services: before.services ?? null,
        focus_areas: before.focus_areas ?? null,
        updated_at: now,
      }
      if (status === 'approved') {
        const { data: existing } = await admin.from('notaries').select('id').eq('lead_id', id).maybeSingle()
        if (existing?.id) {
          notaryId = String(existing.id)
          await admin.from('notaries').update({ ...notaryRecord, status: 'active', verified_at: now, verified_by: actor.id }).eq('id', notaryId)
        } else {
          const { data: inserted, error: insertError } = await admin
            .from('notaries')
            .insert({ ...notaryRecord, status: 'active', verified_at: now, verified_by: actor.id })
            .select('id')
            .single()
          if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
          notaryId = String(inserted.id)
        }
        await admin.from('notary_areas').delete().eq('notary_id', notaryId)
        if (areas.length) {
          await admin.from('notary_areas').insert(
            areas.map((area) => ({
              notary_id: notaryId,
              province: area.province || before.province || null,
              kabupaten: area.kabupaten || null,
              kecamatan: area.kecamatan || null,
            })),
          )
        }
        await audit('notary.published', 'notary', notaryId, { lead_id: id, areas: areas.length })
      } else if (status === 'rejected') {
        const { data: existing } = await admin.from('notaries').select('id').eq('lead_id', id).maybeSingle()
        if (existing?.id) {
          notaryId = String(existing.id)
          await admin.from('notaries').update({ status: 'inactive', updated_at: now }).eq('id', notaryId)
          await audit('notary.unpublished', 'notary', notaryId, { lead_id: id, reason: 'lead_rejected' })
        }
      }
    }

    return NextResponse.json({ ok: true, status, id, email: mail.ok ? 'sent' : mail.skipped ? 'skipped' : 'failed', notary_id: notaryId })
  }

  // ---------- Direktori notaris (aktif/nonaktif + sunting) ----------
  if (kind === 'notary.update') {
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'ID notaris wajib' }, { status: 400 })
    const patch: Record<string, unknown> = { updated_at: now }
    if (body.status !== undefined) {
      const status = String(body.status)
      if (!['active', 'inactive', 'pending'].includes(status)) return NextResponse.json({ error: 'Status notaris tidak valid' }, { status: 400 })
      patch.status = status
    }
    if (typeof body.featured === 'boolean') patch.featured = body.featured
    for (const key of ['notes', 'name', 'office_name', 'sk_no', 'phone', 'whatsapp', 'email', 'website', 'address', 'province', 'kabupaten', 'kecamatan', 'services', 'focus_areas']) {
      if (typeof body[key] === 'string') patch[key] = String(body[key]).trim().slice(0, 400) || null
    }
    const { error } = await admin.from('notaries').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (Array.isArray(body.areas)) {
      const areas = sanitizeAreas(body.areas)
      await admin.from('notary_areas').delete().eq('notary_id', id)
      if (areas.length) {
        await admin.from('notary_areas').insert(areas.map((area) => ({ notary_id: id, province: area.province || null, kabupaten: area.kabupaten || null, kecamatan: area.kecamatan || null })))
      }
    }
    await audit('notary.updated', 'notary', id, { ...patch, areas: Array.isArray(body.areas) ? body.areas.length : undefined })
    return NextResponse.json({ ok: true, id })
  }

  // ---------- Pengajuan pendampingan notaris (tindak lanjut tim Homy) ----------
  if (kind === 'notary_request.update') {
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'ID pengajuan notaris wajib' }, { status: 400 })
    const status = String(body.status ?? '')
    if (!Object.keys(NOTARY_REQUEST_STATUS_META).includes(status)) {
      return NextResponse.json({ error: 'Status pengajuan tidak valid' }, { status: 400 })
    }
    const { data: before } = await admin.from('notary_requests').select('id,user_id,status,property_id,kecamatan,kabupaten,province').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'Pengajuan notaris tidak ditemukan' }, { status: 404 })
    const notaryId = String(body.notary_id ?? '').trim() || null
    const { error } = await admin
      .from('notary_requests')
      .update({ status, admin_note: note || null, notary_id: notaryId, handled_by: actor.id, handled_at: now, updated_at: now })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await audit('notary_request.' + status, 'notary_request', id, { previous_status: before.status, note, notary_id: notaryId })
    if (before.user_id) {
      try {
        await notifyUser({
          userId: String(before.user_id),
          kind: 'notary.recommended',
          title: 'Update pengajuan notaris/PPAT Anda',
          body: NOTARY_REQUEST_STATUS_META[status]?.label ? `Status: ${NOTARY_REQUEST_STATUS_META[status].label}` : status,
          href: '/notaris',
          data: { notary_request_id: id, status },
        })
      } catch { /* best effort */ }
    }
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

  // ---------- Verifikasi mitra (Agen / Pemilik Properti) ----------
  if (kind === 'verification.approve' || kind === 'verification.reject' || kind === 'verification.reopen') {
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'ID verifikasi wajib' }, { status: 400 })
    const { data: before } = await admin
      .from('partner_verifications')
      .select('id,user_id,requested_role,status,full_name,agreement_id,submitted_at')
      .eq('id', id)
      .maybeSingle()
    if (!before) return NextResponse.json({ error: 'Data verifikasi tidak ditemukan' }, { status: 404 })

    if (kind === 'verification.reject' && !note) {
      return NextResponse.json({ error: 'Catatan alasan penolakan wajib diisi' }, { status: 400 })
    }
    if (kind === 'verification.approve' && !before.agreement_id) {
      return NextResponse.json({ error: 'Mitra belum menandatangani Perjanjian Kerja Sama.' }, { status: 409 })
    }

    const status = kind === 'verification.approve' ? 'approved' : kind === 'verification.reject' ? 'rejected' : 'pending'
    const patch: Record<string, unknown> = {
      status,
      reviewed_by: actor.id,
      reviewed_at: now,
      reviewer_note: note || null,
      updated_at: now,
    }
    const { data: saved, error } = await admin
      .from('partner_verifications')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Persetujuan = buka akses peran mitra (dan set peran utama bila masih 'user').
    if (status === 'approved') {
      const role = String(before.requested_role ?? '')
      if (['agent', 'property_owner'].includes(role)) {
        const { error: roleError } = await admin
          .from('user_roles')
          .upsert({ user_id: before.user_id, role, status: 'active', granted_at: now }, { onConflict: 'user_id,role' })
        if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 })
        try {
          const { data: profile } = await admin.from('profiles').select('role').eq('id', before.user_id).maybeSingle()
          if (!profile || profile.role === 'user') {
            await admin.from('profiles').update({ role }).eq('id', before.user_id)
          }
        } catch { /* profil opsional */ }
      }
    }

    await audit('verification.' + status, 'partner_verification', id, {
      previous_status: before.status,
      role: before.requested_role,
      note,
      full_name: before.full_name,
    })

    try {
      const roleLabel = String(before.requested_role) === 'agent' ? 'Agen Properti' : 'Pemilik Properti'
      await notifyUser({
        userId: String(before.user_id),
        kind: status === 'approved' ? 'verification.approved' : status === 'rejected' ? 'verification.rejected' : 'verification.submitted',
        title:
          status === 'approved'
            ? `Verifikasi ${roleLabel} disetujui`
            : status === 'rejected'
              ? `Verifikasi ${roleLabel} perlu perbaikan`
              : `Verifikasi ${roleLabel} sedang ditinjau ulang`,
        body:
          status === 'approved'
            ? 'Akun mitra Anda aktif. Silakan mulai memasang listing properti.'
            : status === 'rejected'
              ? note || 'Silakan perbarui data/dokumen lalu kirim ulang.'
              : 'Tim Homy meninjau ulang pengajuan Anda.',
        href: '/verify',
        data: { verification_id: id, role: before.requested_role, status },
      })
    } catch { /* notifikasi best effort */ }

    return NextResponse.json({ ok: true, status, verification: saved })
  }

  // ---------- Sanksi mitra: teguran / peringatan / suspend / blokir ----------
  if (kind === 'sanction.add' || kind === 'sanction.lift') {
    const LEVELS: Record<string, number> = { teguran: 1, peringatan: 2, suspend: 3, blokir: 4 }
    const CATEGORIES = ['etika', 'komisi', 'rule', 'penipuan', 'lainnya']

    // Sinkronkan status peran mitra (agent/property_owner) mengikuti sanksi efektif.
    async function syncRoleStatus(userId: string) {
      const { data: st } = await admin!.rpc('partner_sanction_state', { p_uid: userId })
      const state = String((st as Record<string, unknown> | null)?.state ?? 'active')
      const next = state === 'blokir' ? 'blocked' : state === 'suspend' ? 'suspended' : 'active'
      await admin!.from('user_roles').update({ status: next }).eq('user_id', userId).in('role', ['agent', 'property_owner'])
      return state
    }

    if (kind === 'sanction.add') {
      const userId = String(body.userId ?? '')
      if (!userId) return NextResponse.json({ error: 'Mitra wajib dipilih' }, { status: 400 })
      const role = ['agent', 'property_owner', 'all'].includes(String(body.role ?? '')) ? String(body.role) : 'all'
      const kindSlug = String(body.sanctionKind ?? '')
      if (!(kindSlug in LEVELS)) return NextResponse.json({ error: 'Tingkat sanksi tidak valid.' }, { status: 400 })
      const level = LEVELS[kindSlug]
      const category = CATEGORIES.includes(String(body.category ?? '')) ? String(body.category) : 'lainnya'
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 600) : ''
      if (reason.length < 5) return NextResponse.json({ error: 'Alasan pelanggaran wajib diisi (min. 5 karakter).' }, { status: 400 })

      // Akun admin/super admin tidak boleh dikenai sanksi mitra.
      const { data: targetRoles } = await admin.from('user_roles').select('role').eq('user_id', userId)
      const tRoles = Array.isArray(targetRoles) ? targetRoles.map((r: { role: string }) => r.role) : []
      if (tRoles.some((r) => ['admin', 'super_admin'].includes(r))) {
        return NextResponse.json({ error: 'Akun admin tidak bisa dikenai sanksi mitra.' }, { status: 409 })
      }

      // Suspend wajib punya masa berlaku; blokir permanen (ends_at null).
      let endsAt: string | null = null
      if (level === 3) {
        const days = Math.max(1, Math.min(365, Number(body.durationDays ?? 7) || 7))
        endsAt = new Date(Date.now() + days * 86400000).toISOString()
      }

      const { data: saved, error } = await admin
        .from('partner_sanctions')
        .insert({
          user_id: userId, role, level, kind: kindSlug, category, reason,
          note: note || null, status: 'active', starts_at: now, ends_at: endsAt,
          created_by: actor.id, updated_at: now,
        })
        .select('id,user_id,role,level,kind,category,reason,note,status,starts_at,ends_at,created_at')
        .maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const state = await syncRoleStatus(userId)
      await audit('sanction.' + kindSlug, 'partner_sanction', (saved as { id?: string } | null)?.id ?? null, { user_id: userId, role, level, category, ends_at: endsAt })

      const LABEL: Record<string, string> = { teguran: 'Teguran', peringatan: 'Peringatan', suspend: 'Penangguhan (suspend)', blokir: 'Pemblokiran' }
      try {
        await notifyUser({
          userId,
          kind: level >= 4 ? 'sanction.blocked' : level === 3 ? 'sanction.suspended' : 'sanction.warning',
          title: `${LABEL[kindSlug]} akun mitra Anda`,
          body: reason + (level === 3 && endsAt ? ` (berlaku sampai ${new Date(endsAt).toLocaleDateString('id-ID')})` : ''),
          href: '/dashboard/agent',
          data: { sanction_id: (saved as { id?: string } | null)?.id ?? null, level, category, state },
        })
      } catch { /* notifikasi best effort */ }

      return NextResponse.json({ ok: true, sanction: saved, state })
    }

    // sanction.lift — cabut sanksi lebih awal (mis. mitra memperbaiki pelanggaran).
    const sanctionId = String(body.id ?? '')
    if (!sanctionId) return NextResponse.json({ error: 'ID sanksi wajib.' }, { status: 400 })
    const { data: before } = await admin.from('partner_sanctions').select('id,user_id,kind,level,status,note').eq('id', sanctionId).maybeSingle()
    if (!before) return NextResponse.json({ error: 'Data sanksi tidak ditemukan.' }, { status: 404 })
    if (before.status !== 'active') return NextResponse.json({ error: 'Sanksi ini sudah tidak aktif.' }, { status: 409 })
    const mergedNote = [before.note, note ? `Dicabut: ${note}` : 'Dicabut oleh admin'].filter(Boolean).join(' | ')
    const { error } = await admin
      .from('partner_sanctions')
      .update({ status: 'lifted', lifted_by: actor.id, lifted_at: now, note: mergedNote, updated_at: now })
      .eq('id', sanctionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const state = await syncRoleStatus(String(before.user_id))
    await audit('sanction.lifted', 'partner_sanction', sanctionId, { user_id: before.user_id, kind: before.kind, note })
    try {
      await notifyUser({
        userId: String(before.user_id),
        kind: 'sanction.lifted',
        title: 'Sanksi mitra dicabut',
        body: note || 'Sanksi Anda telah dicabut. Akun mitra kembali aktif.',
        href: '/dashboard/agent',
        data: { sanction_id: sanctionId, state },
      })
    } catch { /* notifikasi best effort */ }

    return NextResponse.json({ ok: true, id: sanctionId, state })
  }

  return NextResponse.json({ error: 'Aksi tidak dikenal: ' + kind }, { status: 400 })
}