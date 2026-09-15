/**
 * Homy — email notifikasi (Resend HTTP API).
 *
 * Env:
 *  - RESEND_API_KEY   (wajib untuk benar-benar mengirim; kalau kosong → skip, tidak error)
 *  - HOMY_EMAIL_FROM  (opsional, default `Homy Property <notifikasi@homy.id>`)
 *  - HOMY_APP_URL     (opsional, default https://homyproperty.id)
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export type ListingStatus = 'published' | 'rejected' | 'pending'

export type ListingMailInput = {
  to: string
  title: string
  status: ListingStatus
  note?: string | null
  ownerName?: string
  listingId?: string
  reason?: 'moderated' | 'resubmitted'
}

function appUrl() {
  return (process.env.HOMY_APP_URL || 'https://homyproperty.id').replace(/\/$/, '')
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string))
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}

function copyFor(input: ListingMailInput) {
  const listing = escapeHtml(input.title || 'Listing properti')
  const dashboard = `${appUrl()}/dashboard/property-owner`

  if (input.reason === 'resubmitted') {
    return {
      subject: `Listing "${input.title}" diajukan ulang dan sedang ditinjau`,
      heading: 'Listing Anda masuk antrean moderasi',
      body: `Terima kasih, <strong>${escapeHtml(input.title)}</strong> sudah diajukan ulang. Tim Homy akan meninjau kembali dan memberi kabar lewat email ini.`,
      accent: '#c9a961',
      cta: 'Lihat dashboard',
      url: dashboard,
      note: null as string | null,
    }
  }

  if (input.status === 'published') {
    return {
      subject: `Selamat! Listing "${input.title}" sudah tayang`,
      heading: 'Listing Anda sudah tayang 🎉',
      body: `<strong>${listing}</strong> sudah lolos moderasi dan kini tampil di halaman publik Homy. Calon pembeli/penyewa bisa menemukan dan menghubungi Anda.`,
      accent: '#4e866d',
      cta: 'Lihat listing Anda',
      url: input.listingId ? `${appUrl()}/property/${input.listingId}` : dashboard,
      note: null as string | null,
    }
  }

  if (input.status === 'rejected') {
    return {
      subject: `Listing "${input.title}" perlu diperbaiki`,
      heading: 'Listing Anda belum bisa ditayangkan',
      body: `<strong>${listing}</strong> ditolak oleh tim moderasi Homy. Silakan perbaiki sesuai catatan di bawah, lalu ajukan ulang dari dashboard Anda.`,
      accent: '#b45c50',
      cta: 'Perbaiki & ajukan ulang',
      url: dashboard,
      note: (input.note || '').trim() || null,
    }
  }

  return {
    subject: `Status listing "${input.title}" diperbarui`,
    heading: 'Status listing Anda diperbarui',
    body: `<strong>${listing}</strong> kembali masuk antrean moderasi Homy.`,
    accent: '#c9a961',
    cta: 'Lihat dashboard',
    url: dashboard,
    note: (input.note || '').trim() || null,
  }
}

function renderHtml(input: ListingMailInput) {
  const copy = copyFor(input)
  const noteBlock = copy.note
    ? `<div style="margin:20px 0;padding:16px;border-radius:12px;background:#fff7e3;border:1px solid #f0e2bd">
         <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9b762a">Catatan moderator</p>
         <p style="margin:0;color:#5b4a1f;line-height:1.6">${escapeHtml(copy.note)}</p>
       </div>`
    : ''
  const greeting = input.ownerName ? `<p style="margin:0 0 12px;color:#65706c">Halo ${escapeHtml(input.ownerName)},</p>` : ''

  return `<!doctype html><html><body style="margin:0;background:#f7f3ec;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#0b3d2e;margin-bottom:20px">Homy<span style="color:#c9a961">.</span></div>
    <div style="background:#ffffff;border:1px solid #e8dfd3;border-radius:16px;padding:28px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${copy.accent}">Notifikasi listing</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;line-height:1.3;color:#0b3d2e">${copy.heading}</h1>
      ${greeting}
      <p style="margin:0;color:#33433d;line-height:1.7">${copy.body}</p>
      ${noteBlock}
      <a href="${copy.url}" style="display:inline-block;margin-top:8px;background:#0b3d2e;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600">${copy.cta}</a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8a938f">Email otomatis dari Homy Property. Anda menerima ini karena memasang listing properti di Homy.<br/>Pencarian properti terpercaya di Indonesia.</p>
  </div></body></html>`
}

/** Kirim email status listing. Tidak pernah melempar error — selalu return hasil. */
export async function sendListingStatusEmail(input: ListingMailInput) {
  if (!input.to) return { ok: false, skipped: true, reason: 'missing recipient' }
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.HOMY_EMAIL_FROM || 'Homy Property <notifikasi@homy.id>'
  const copy = copyFor(input)

  if (!apiKey) {
    console.warn(`[homy-email] RESEND_API_KEY belum di-set — email ke ${input.to} dilewati (${copy.subject})`)
    return { ok: false, skipped: true, reason: 'email provider not configured', subject: copy.subject }
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [input.to], subject: copy.subject, html: renderHtml(input) }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[homy-email] gagal kirim:', response.status, detail.slice(0, 300))
      return { ok: false, status: response.status, subject: copy.subject }
    }
    const payload = (await response.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: payload.id, subject: copy.subject }
  } catch (error) {
    console.error('[homy-email] error:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'request failed', subject: copy.subject }
  }
}

/* --------------------------------------------------------------------------- */
/* Notifikasi jadwal kunjungan (dijadwalkan lewat Homy AI di halaman properti)  */
/* --------------------------------------------------------------------------- */

export type VisitMailInput = {
  to: string
  ownerName?: string
  visitorName?: string
  visitorEmail?: string
  visitorPhone?: string
  propertyTitle: string
  propertyId?: string
  scheduledAt: string
  dayLabel?: string
  timeLabel?: string
  mode?: string | null
  location?: string | null
  notes?: string | null
}

const MODE_TEXT: Record<string, string> = { onsite: 'Di lokasi (survey langsung)', online: 'Online (video call)', both: 'Di lokasi / online' }

export function visitMailSubject(input: VisitMailInput) {
  const when = [input.dayLabel, input.timeLabel].filter(Boolean).join(' ')
  return `Kunjungan baru: ${input.propertyTitle}${when ? ' — ' + when : ''}`
}

function visitHtml(input: VisitMailInput) {
  const when = [input.dayLabel, input.timeLabel].filter(Boolean).join(', ') || new Date(input.scheduledAt).toISOString()
  const rows: Array<[string, string]> = [
    ['Properti', input.propertyTitle],
    ['Waktu (WIB)', when],
    ['Cara', MODE_TEXT[String(input.mode ?? '')] ?? (input.mode ? String(input.mode) : 'Belum ditentukan')],
  ]
  if (input.location) rows.push(['Lokasi/titik temu', String(input.location)])
  if (input.visitorName) rows.push(['Pengunjung', escapeHtml(input.visitorName)])
  if (input.visitorEmail) rows.push(['Email', escapeHtml(input.visitorEmail)])
  if (input.visitorPhone) rows.push(['Telepon/WhatsApp', escapeHtml(input.visitorPhone)])
  if (input.notes) rows.push(['Catatan pengunjung', escapeHtml(input.notes)])

  const table = rows
    .map(
      ([label, value], index) =>
        `<tr style="background:${index % 2 ? '#ffffff' : '#f7f3ec'}"><td style="padding:10px 12px;font-size:13px;color:#718078;white-space:nowrap">${label}</td><td style="padding:10px 12px;font-size:14px;color:#20332c;font-weight:600">${value}</td></tr>`,
    )
    .join('')

  const ctaUrl = `${appUrl()}/dashboard/property-owner/calendar`
  const greeting = input.ownerName ? `<p style="margin:0 0 12px;color:#65706c">Halo ${escapeHtml(input.ownerName)},</p>` : ''

  return `<!doctype html><html><body style="margin:0;background:#f7f3ec;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#0b3d2e;margin-bottom:20px">Homy<span style="color:#c9a961">.</span></div>
    <div style="background:#ffffff;border:1px solid #e8dfd3;border-radius:16px;padding:28px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c9a961">Jadwal kunjungan</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;line-height:1.3;color:#0b3d2e">Ada pengunjung yang mau melihat unit Anda</h1>
      ${greeting}
      <p style="margin:0 0 18px;color:#33433d;line-height:1.7">Jadwal ini sudah <strong>tercatat otomatis</strong> di dashboard Anda. Silakan konfirmasi ke pengunjung lewat email/telepon di bawah.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e8dfd3;border-radius:12px;overflow:hidden">${table}</table>
      <a href="${ctaUrl}" style="display:inline-block;margin-top:20px;background:#0b3d2e;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600">Buka kalender kunjungan</a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8a938f">Email otomatis dari Homy Property. Anda menerima ini karena memasang properti di Homy.<br/>Pencarian properti terpercaya — <a href="${appUrl()}" style="color:#0b3d2e">${appUrl().replace(/^https?:\/\//, '')}</a></p>
  </div></body></html>`
}

/** Kirim email jadwal kunjungan ke agen/pemilik. Tidak pernah melempar error. */
export async function sendVisitScheduledEmail(input: VisitMailInput) {
  const subject = visitMailSubject(input)
  if (!input.to) return { ok: false, skipped: true, reason: 'missing recipient', subject }
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.HOMY_EMAIL_FROM || 'Homy Property <notifikasi@homy.id>'
  if (!apiKey) {
    console.warn(`[homy-email] RESEND_API_KEY belum di-set — email kunjungan ke ${input.to} dilewati (${subject})`)
    return { ok: false, skipped: true, reason: 'email provider not configured', subject }
  }
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [input.to], subject, html: visitHtml(input) }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[homy-email] gagal kirim jadwal kunjungan:', response.status, detail.slice(0, 300))
      return { ok: false, status: response.status, subject }
    }
    const payload = (await response.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: payload.id, subject }
  } catch (error) {
    console.error('[homy-email] error jadwal kunjungan:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'request failed', subject }
  }
}
