/**
 * Homy — email notifikasi (Resend HTTP API).
 *
 * Env:
 *  - RESEND_API_KEY   (wajib untuk benar-benar mengirim; kalau kosong → skip, tidak error)
 *  - HOMY_EMAIL_FROM  (opsional, default `Homy Property <notifikasi@homy.id>`)
 *  - HOMY_APP_URL     (opsional, default https://homy-coral.vercel.app)
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
  return (process.env.HOMY_APP_URL || 'https://homy-coral.vercel.app').replace(/\/$/, '')
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
