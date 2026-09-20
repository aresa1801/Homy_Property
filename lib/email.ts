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

/* --------------------------------------------------------------------------- */
/* Titik temu dikirim SETELAH jadwal kunjungan dikonfirmasi agen/pemilik        */
/* --------------------------------------------------------------------------- */

export type MeetingPointMailInput = {
  to: string
  visitorName?: string
  propertyTitle: string
  propertyId?: string
  dayLabel?: string
  timeLabel?: string
  meetingPoint?: string | null
  mapUrl?: string | null
  agentName?: string | null
  agentPhone?: string | null
}

export function visitMeetingSubject(input: MeetingPointMailInput) {
  const when = [input.dayLabel, input.timeLabel].filter(Boolean).join(' ')
  return `Jadwal dikonfirmasi: ${input.propertyTitle}${when ? ' — ' + when : ''}`
}

function meetingHtml(input: MeetingPointMailInput) {
  const when = [input.dayLabel, input.timeLabel].filter(Boolean).join(', ')
  const rows: Array<[string, string]> = [['Properti', escapeHtml(input.propertyTitle)]]
  if (when) rows.push(['Waktu (WIB)', when])
  if (input.meetingPoint) rows.push(['Titik temu', escapeHtml(String(input.meetingPoint))])
  if (input.agentName) rows.push(['Agen/pemilik', escapeHtml(String(input.agentName))])
  if (input.agentPhone) rows.push(['Kontak', escapeHtml(String(input.agentPhone))])

  const table = rows
    .map(
      ([label, value], index) =>
        `<tr style="background:${index % 2 ? '#ffffff' : '#f7f3ec'}"><td style="padding:10px 12px;font-size:13px;color:#718078;white-space:nowrap">${label}</td><td style="padding:10px 12px;font-size:14px;color:#20332c;font-weight:600">${value}</td></tr>`,
    )
    .join('')

  const cta = input.mapUrl
    ? `<a href="${escapeHtml(String(input.mapUrl))}" style="display:inline-block;margin-top:20px;background:#0b3d2e;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600">Buka titik temu di Google Maps</a>`
    : ''
  const greeting = input.visitorName ? `<p style="margin:0 0 12px;color:#65706c">Halo ${escapeHtml(input.visitorName)},</p>` : ''

  return `<!doctype html><html><body style="margin:0;background:#f7f3ec;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#0b3d2e;margin-bottom:20px">Homy<span style="color:#c9a961">.</span></div>
    <div style="background:#ffffff;border:1px solid #e8dfd3;border-radius:16px;padding:28px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c9a961">Kunjungan dikonfirmasi</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;line-height:1.3;color:#0b3d2e">Jadwal Anda sudah dikonfirmasi</h1>
      ${greeting}
      <p style="margin:0 0 18px;color:#33433d;line-height:1.7">Agen/pemilik sudah mengonfirmasi jadwal kunjungan Anda. Detail lokasi dan titik temu ada di bawah ini — mohon datang tepat waktu dan hubungi agen/pemilik bila perlu mengubah jadwal.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e8dfd3;border-radius:12px;overflow:hidden">${table}</table>
      ${cta}
    </div>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8a938f">Email otomatis dari Homy Property. Demi keamanan, mohon tidak membagikan detail titik temu ke pihak lain.<br/>Pencarian properti terpercaya — <a href="${appUrl()}" style="color:#0b3d2e">${appUrl().replace(/^https?:\/\//, '')}</a></p>
  </div></body></html>`
}

/** Kirim email titik temu ke calon pembeli/penyewa setelah jadwal dikonfirmasi. Tidak pernah melempar error. */
export async function sendVisitMeetingPointEmail(input: MeetingPointMailInput) {
  const subject = visitMeetingSubject(input)
  if (!input.to) return { ok: false, skipped: true, reason: 'missing recipient', subject }
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.HOMY_EMAIL_FROM || 'Homy Property <notifikasi@homy.id>'
  if (!apiKey) {
    console.warn(`[homy-email] RESEND_API_KEY belum di-set — email titik temu ke ${input.to} dilewati (${subject})`)
    return { ok: false, skipped: true, reason: 'email provider not configured', subject }
  }
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [input.to], subject, html: meetingHtml(input) }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[homy-email] gagal kirim titik temu:', response.status, detail.slice(0, 300))
      return { ok: false, status: response.status, reason: 'provider rejected the message', subject }
    }
    const payload = (await response.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: payload.id, subject }
  } catch (error) {
    console.error('[homy-email] error titik temu:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'request failed', subject }
  }
}

/* --------------------------------------------------------------------------- */
/* Tindak lanjut SETELAH kunjungan (follow-up ke calon pembeli/penyewa)         */
/* --------------------------------------------------------------------------- */

export type FollowUpAlternative = {
  id: string
  title?: string | null
  city?: string | null
  district?: string | null
  price?: number | string | null
  listing_type?: string | null
}

export type VisitFollowUpInput = {
  to: string
  buyerName?: string
  propertyTitle: string
  propertyId?: string | null
  interested: boolean
  sellerName?: string | null
  sellerContact?: string | null
  feedback?: string | null
  nextSteps?: string | null
  alternatives?: FollowUpAlternative[]
}

function rupiahText(value?: number | string | null) {
  const amount = typeof value === 'string' ? Number(value) : value
  if (!amount || Number.isNaN(amount)) return 'Harga menyusul'
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}

export function visitFollowUpSubject(input: VisitFollowUpInput) {
  return input.interested
    ? `Langkah berikutnya untuk ${input.propertyTitle}`
    : `Pilihan properti lain yang mirip ${input.propertyTitle}`
}

function followUpHtml(input: VisitFollowUpInput) {
  const greeting = input.buyerName ? `<p style="margin:0 0 12px;color:#65706c">Halo ${escapeHtml(input.buyerName)},</p>` : ''
  const alternatives = (input.alternatives ?? []).slice(0, 4)
  const altBlock = !input.interested && alternatives.length
    ? `<p style="margin:22px 0 10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a18a61">Rekomendasi untuk Anda</p>
       ${alternatives
         .map(
           (item) => `<a href="${appUrl()}/property/${item.id}" style="display:block;margin:0 0 10px;padding:14px 16px;border:1px solid #e8dfd3;border-radius:12px;text-decoration:none">
             <p style="margin:0;font-weight:700;color:#0b3d2e">${escapeHtml(String(item.title ?? 'Properti'))}</p>
             <p style="margin:4px 0 0;font-size:13px;color:#718078">${escapeHtml([item.district, item.city].filter(Boolean).join(', ') || 'Lokasi menyusul')}${item.listing_type === 'rent' ? ' · Sewa' : ' · Jual'}</p>
             <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#0b3d2e">${rupiahText(item.price)}${item.listing_type === 'rent' ? ' / bulan' : ''}</p>
           </a>`,
         )
         .join('')}`
    : ''

  const steps = input.interested
    ? `<ol style="margin:12px 0 0;padding-left:20px;color:#33433d;line-height:1.9">
         <li>Konfirmasi minat Anda dengan membalas email ini atau menghubungi pemilik/agen.</li>
         <li>Siapkan dokumen: KTP, dan untuk pembelian KPR siapkan slip gaji/rekening 3 bulan terakhir.</li>
         <li>Jadwalkan negosiasi harga &amp; cek sertifikat/IMB bersama pemilik.</li>
         <li>Lanjut ke proses booking, PPJB, lalu akad/balik nama.</li>
       </ol>`
    : `<p style="margin:12px 0 0;color:#33433d;line-height:1.8">Terima kasih atas waktunya. Kalau unit tadi belum cocok, tidak masalah — kami bantu carikan pilihan lain yang lebih sesuai kriteria Anda.</p>`

  const contact = input.sellerContact
    ? `<p style="margin:14px 0 0;color:#33433d;line-height:1.8">Kontak pemilik/agen${input.sellerName ? ` (${escapeHtml(input.sellerName)})` : ''}: <strong>${escapeHtml(input.sellerContact)}</strong></p>`
    : ''

  const feedback = input.feedback
    ? `<div style="margin:18px 0 0;padding:14px 16px;border-radius:12px;background:#f7f3ec;border:1px solid #e8dfd3">
         <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a18a61">Catatan kunjungan</p>
         <p style="margin:0;color:#33433d;line-height:1.7">${escapeHtml(input.feedback)}</p>
       </div>`
    : ''

  const headline = input.interested ? 'Terima kasih sudah berkunjung!' : 'Belum cocok? Kami punya pilihan lain'

  return `<!doctype html><html><body style="margin:0;background:#f7f3ec;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#0b3d2e;margin-bottom:20px">Homy<span style="color:#c9a961">.</span></div>
    <div style="background:#ffffff;border:1px solid #e8dfd3;border-radius:16px;padding:28px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${input.interested ? '#4e866d' : '#c9a961'}">Tindak lanjut kunjungan</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;line-height:1.3;color:#0b3d2e">${headline}</h1>
      ${greeting}
      <p style="margin:0;color:#33433d;line-height:1.7">Kunjungan Anda ke <strong>${escapeHtml(input.propertyTitle)}</strong> sudah tercatat. ${
        input.interested ? 'Karena Anda tertarik, berikut langkah selanjutnya yang bisa diambil:' : 'Berikut pilihan properti lain yang mirip dan bisa Anda pertimbangkan:'
      }</p>
      ${steps}
      ${contact}
      ${feedback}
      ${altBlock}
      <a href="${input.propertyId ? `${appUrl()}/property/${input.propertyId}` : `${appUrl()}/buy`}" style="display:inline-block;margin-top:22px;background:#0b3d2e;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600">${
        input.interested ? 'Lihat properti' : 'Cari properti lain'
      }</a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8a938f">Email otomatis dari Homy Property setelah kunjungan Anda.<br/>Pencarian properti terpercaya — <a href="${appUrl()}" style="color:#0b3d2e">${appUrl().replace(/^https?:\/\//, '')}</a></p>
  </div></body></html>`
}

/** Kirim email tindak lanjut setelah kunjungan. Tidak pernah melempar error. */
export async function sendVisitFollowUpEmail(input: VisitFollowUpInput) {
  const subject = visitFollowUpSubject(input)
  if (!input.to) return { ok: false, skipped: true, reason: 'missing recipient', subject }
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.HOMY_EMAIL_FROM || 'Homy Property <notifikasi@homy.id>'
  if (!apiKey) {
    console.warn(`[homy-email] RESEND_API_KEY belum di-set — email tindak lanjut ke ${input.to} dilewati (${subject})`)
    return { ok: false, skipped: true, reason: 'email provider not configured', subject }
  }
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [input.to], subject, html: followUpHtml(input) }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[homy-email] gagal kirim tindak lanjut:', response.status, detail.slice(0, 300))
      return { ok: false, status: response.status, reason: 'provider rejected the message', detail: detail.slice(0, 160), subject }
    }
    const payload = (await response.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: payload.id, subject }
  } catch (error) {
    console.error('[homy-email] error tindak lanjut:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'request failed', subject }
  }
}

/* --------------------------------------------------------------------------- */
/* Pengingat melengkapi verifikasi mitra (dikirim admin dari dasbor)            */
/* --------------------------------------------------------------------------- */

export type VerificationReminderMailInput = {
  to: string
  name?: string | null
  roles: string[]
  missing: string[]
  percent?: number
  message?: string | null
}

const VERIFY_ROLE_LABEL: Record<string, string> = { agent: 'Agen Properti', property_owner: 'Pemilik Properti' }

export function verificationReminderSubject(input: VerificationReminderMailInput) {
  const roles = (input.roles ?? []).map((role) => VERIFY_ROLE_LABEL[role] ?? role).join(' & ')
  return roles ? `Lengkapi verifikasi ${roles} Anda di Homy` : 'Lengkapi verifikasi mitra Homy Anda'
}

function verificationReminderHtml(input: VerificationReminderMailInput) {
  const roleText = (input.roles ?? []).map((role) => VERIFY_ROLE_LABEL[role] ?? role).join(' & ') || 'mitra'
  const missing = (input.missing ?? []).filter(Boolean).slice(0, 12)
  const percent = typeof input.percent === 'number' ? Math.max(0, Math.min(100, Math.round(input.percent))) : null
  const greeting = input.name ? `<p style="margin:0 0 12px;color:#65706c">Halo ${escapeHtml(input.name)},</p>` : ''

  const listBlock = missing.length
    ? `<p style="margin:18px 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a18a61">Yang masih perlu dilengkapi</p>
       <ul style="margin:0;padding-left:20px;color:#33433d;line-height:1.9">${missing.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p style="margin:18px 0 0;color:#33433d;line-height:1.8">Semua bagian utama sudah terisi — silakan tinjau sekali lagi lalu kirim pengajuan verifikasi Anda.</p>'

  const progress = percent !== null
    ? `<div style="margin:18px 0 0;padding:14px 16px;border-radius:12px;background:#f7f3ec;border:1px solid #e8dfd3">
         <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a18a61">Kelengkapan data</p>
         <p style="margin:0;font-size:20px;font-weight:700;color:#0b3d2e">${percent}%</p>
       </div>`
    : ''

  const noteBlock = input.message
    ? `<div style="margin:18px 0 0;padding:14px 16px;border-radius:12px;background:#fff7e3;border:1px solid #f0e2bd">
         <p style="margin:0;color:#5b4a1f;line-height:1.7">${escapeHtml(input.message)}</p>
       </div>`
    : ''

  const ctaRole = (input.roles ?? [])[0] ?? 'agent'

  return `<!doctype html><html><body style="margin:0;background:#f7f3ec;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#0b3d2e;margin-bottom:20px">Homy<span style="color:#c9a961">.</span></div>
    <div style="background:#ffffff;border:1px solid #e8dfd3;border-radius:16px;padding:28px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c9a961">Verifikasi mitra</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;line-height:1.3;color:#0b3d2e">Satu langkah lagi agar akun ${escapeHtml(roleText)} Anda aktif</h1>
      ${greeting}
      <p style="margin:0;color:#33433d;line-height:1.7">Verifikasi mitra Homy memastikan listing Anda terpercaya bagi pembeli &amp; penyewa. Lengkapi data berikut di halaman verifikasi — cukup sekali, butuh sekitar 5 menit.</p>
      ${progress}
      ${listBlock}
      ${noteBlock}
      <a href="${appUrl()}/verify?role=${encodeURIComponent(ctaRole)}" style="display:inline-block;margin-top:22px;background:#0b3d2e;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600">Lanjutkan verifikasi</a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8a938f">Email otomatis dari Homy Property. Anda menerima ini karena mendaftar sebagai mitra (agen/pemilik properti) di Homy.<br/>Pencarian properti terpercaya — <a href="${appUrl()}" style="color:#0b3d2e">${appUrl().replace(/^https?:\/\//, '')}</a></p>
  </div></body></html>`
}

/** Kirim email pengingat verifikasi mitra. Tidak pernah melempar error — selalu return hasil. */
export async function sendVerificationReminderEmail(input: VerificationReminderMailInput) {
  const subject = verificationReminderSubject(input)
  if (!input.to) return { ok: false, skipped: true, reason: 'missing recipient', subject }
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.HOMY_EMAIL_FROM || 'Homy Property <notifikasi@homy.id>'
  if (!apiKey) {
    console.warn(`[homy-email] RESEND_API_KEY belum di-set — pengingat verifikasi ke ${input.to} dilewati (${subject})`)
    return { ok: false, skipped: true, reason: 'email provider not configured', subject }
  }
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [input.to], subject, html: verificationReminderHtml(input) }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[homy-email] gagal kirim pengingat verifikasi:', response.status, detail.slice(0, 300))
      return { ok: false, status: response.status, reason: 'provider rejected the message', subject }
    }
    const payload = (await response.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: payload.id, subject }
  } catch (error) {
    console.error('[homy-email] error pengingat verifikasi:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'request failed', subject }
  }
}
