/**
 * Homy — penyusun dokumen PDF Perjanjian Kerja Sama Mitra.
 * Memakai `lib/pdf-lite.ts` (tanpa dependensi) sehingga dokumen bisa dibuat
 * langsung di runtime Next.js tanpa proses build tambahan.
 */

import { buildPdf, type PdfBlock } from '@/lib/pdf-lite'
import {
  AGREEMENT_LAMPIRAN,
  AGREEMENT_TITLE,
  AGREEMENT_VERSION,
  COMMISSION_EXAMPLE,
  COMMISSION_RATE,
  COMPANY_BANK,
  COMPANY_EMAIL,
  COMPANY_LEGAL,
  COMPANY_SITE,
  PARTNER_ROLE_LABEL,
  agreementNumber,
  buildAgreementClauses,
  formatRupiah,
} from '@/lib/partner-agreement'
import {
  agreementFingerprint,
  draftSerial,
  fingerprintGroups,
  formatSignatureStampShort,
  formatSignatureTimestamp,
  signatureId,
  signatureSerial,
  summarizeUserAgent,
} from '@/lib/agreement-sign'
import {
  AVAILABILITY_MODES,
  IDENTITY_TYPES,
  WEEKDAY_LABELS,
  formatDateId,
  type AvailabilityEntry,
  type VerificationRole,
} from '@/lib/verification'

export type AgreementPartner = {
  fullName: string
  nickname?: string | null
  identityType?: string | null
  identityNumber?: string | null
  birthPlace?: string | null
  birthDate?: string | null
  gender?: string | null
  occupation?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  companyName?: string | null
  agencyLicense?: string | null
  npwp?: string | null
  address?: string | null
  rtRw?: string | null
  village?: string | null
  district?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null
  nationality?: string | null
  identityExpiry?: string | null
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
  emergencyName?: string | null
  emergencyPhone?: string | null
}

export type AgreementPdfInput = {
  role: VerificationRole
  partner: AgreementPartner
  availability?: AvailabilityEntry[] | null
  userId: string
  verificationId?: string | null
  agreementId?: string | null
  signedAt: string
  version?: string
  /** Nomor serial tanda tangan (dihitung otomatis bila kosong). */
  serial?: string | null
  /** Alamat IP perangkat saat menandatangani (opsional, untuk sertifikat). */
  signedIp?: string | null
  /** User agent perangkat saat menandatangani (opsional, untuk sertifikat). */
  userAgent?: string | null
  /** `draft` = Draf Perjanjian (belum sah); `final` = dokumen bertanda tangan (default). */
  mode?: 'draft' | 'final'
  /** Waktu pembuatan draf (dipakai untuk timestamp + serial draf). */
  generatedAt?: string
  /** Salinan foto identitas (JPEG) untuk Lampiran D pada draf. */
  identityImage?: { data: Uint8Array; width: number; height: number } | null
}

function identityLabel(value?: string | null) {
  const found = IDENTITY_TYPES.find((item) => item.value === value)
  return found ? found.label : 'KTP/SIM'
}

function modeLabel(value?: string | null) {
  const found = AVAILABILITY_MODES.find((item) => item.value === value)
  return found ? found.label : 'Di lokasi / online'
}

function fullAddress(partner: AgreementPartner) {
  return [
    partner.address,
    partner.rtRw ? `RT/RW ${partner.rtRw}` : null,
    partner.village,
    partner.district,
    partner.city,
    partner.province,
    partner.postalCode,
  ]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

function availabilityLines(rows?: AvailabilityEntry[] | null) {
  const list = Array.isArray(rows) ? rows : []
  const active = list.filter((row) => row?.is_active)
  if (!active.length) return ['Belum diatur.']
  const order = [1, 2, 3, 4, 5, 6, 0]
  return order
    .map((weekday) => active.find((row) => Number(row.weekday) === weekday))
    .filter((row): row is AvailabilityEntry => Boolean(row))
    .map(
      (row) =>
        `${WEEKDAY_LABELS[Number(row.weekday)] ?? 'Hari'}: ${String(row.start_time).slice(0, 5)}-${String(row.end_time).slice(0, 5)} WIB` +
        `, slot ${row.slot_minutes ?? 60} menit, ${modeLabel(row.mode)}` +
        (row.location ? ` (${row.location})` : ''),
    )
}

export function buildAgreementPdf(input: AgreementPdfInput): Uint8Array {
  const draft = input.mode === 'draft'
  const version = input.version ?? AGREEMENT_VERSION
  /** Waktu acuan: untuk draf = saat dokumen dibuat, untuk final = saat ditandatangani. */
  const referenceAt = draft ? String(input.generatedAt ?? new Date().toISOString()) : input.signedAt
  const signedDate = new Date(referenceAt)
  const number = agreementNumber(input.role, input.userId, referenceAt)
  const roleLabel = PARTNER_ROLE_LABEL[input.role]
  const clauses = buildAgreementClauses(input.role)
  const partner = input.partner

  // Identitas penandatanganan elektronik (model DocuSign: serial + timestamp + sidik jari)
  const providedSerial = String(input.serial ?? '').trim()
  const serial = draft
    ? providedSerial.startsWith('DRF/')
      ? providedSerial
      : draftSerial(input.role, input.userId, referenceAt)
    : providedSerial || signatureSerial(input.role, input.userId, input.signedAt)
  const signatureKey = signatureId(input.role, input.userId, referenceAt, version)
  const fingerprint = agreementFingerprint({
    role: input.role,
    userId: input.userId,
    version,
    signedAt: referenceAt,
    fullName: String(partner.fullName ?? '-'),
    identityNumber: partner.identityNumber ?? null,
    serial,
  })
  const signedStamp = formatSignatureTimestamp(referenceAt)
  const signedStampShort = formatSignatureStampShort(referenceAt)

  const partnerRows: { label: string; value: string }[] = [
    { label: 'Nama lengkap', value: String(partner.fullName ?? '-') },
    { label: 'Nama panggilan', value: String(partner.nickname ?? '-') },
    { label: 'Peran mitra', value: roleLabel },
    { label: 'Jenis identitas', value: identityLabel(partner.identityType) },
    { label: 'Nomor identitas', value: String(partner.identityNumber ?? '-') },
    { label: 'Masa berlaku identitas', value: formatDateId(partner.identityExpiry) },
    { label: 'Kewarganegaraan', value: String(partner.nationality ?? 'Indonesia') },
    { label: 'Tempat, tanggal lahir', value: `${String(partner.birthPlace ?? '-')}, ${formatDateId(partner.birthDate)}` },
    { label: 'Jenis kelamin', value: partner.gender === 'female' ? 'Perempuan' : partner.gender === 'male' ? 'Laki-laki' : '-' },
    { label: 'Pekerjaan', value: String(partner.occupation ?? '-') },
    { label: 'Telepon', value: String(partner.phone ?? '-') },
    { label: 'WhatsApp', value: String(partner.whatsapp ?? '-') },
    { label: 'Email', value: String(partner.email ?? '-') },
    { label: 'Alamat domisili', value: fullAddress(partner) || '-' },
    {
      label: 'Rekening komisi',
      value:
        [partner.bankName, partner.bankAccountNumber, partner.bankAccountName ? `a.n. ${partner.bankAccountName}` : null]
          .map((part) => String(part ?? '').trim())
          .filter(Boolean)
          .join(' · ') || '-',
    },
    {
      label: 'Kontak darurat',
      value:
        [partner.emergencyName, partner.emergencyPhone]
          .map((part) => String(part ?? '').trim())
          .filter(Boolean)
          .join(' — ') || '-',
    },
    { label: 'Nama badan/agensi', value: String(partner.companyName ?? '-') },
    { label: 'Nomor izin/keagenan', value: String(partner.agencyLicense ?? '-') },
    { label: 'NPWP', value: String(partner.npwp ?? '-') },
    { label: 'ID pengguna Homy', value: String(input.userId ?? '-') },
    {
      label: 'ID verifikasi',
      value: String(input.verificationId ?? '-'),
    },
    {
      label: 'ID perjanjian',
      value: String(input.agreementId ?? '-'),
    },
  ]

  const blocks: PdfBlock[] = [
    {
      type: 'title',
      text: AGREEMENT_TITLE,
      sub: draft ? `DRAF — Nomor: ${number}  ·  Versi dokumen: ${version}` : `Nomor: ${number}  ·  Versi dokumen: ${version}`,
      badge: draft ? 'DRAFT' : version,
    },
    {
      type: 'meta',
      lines: draft
        ? [
            `Status: DRAF — BELUM DITANDATANGANI  ·  Dibuat: ${formatSignatureTimestamp(referenceAt)}`,
            `Serial draf: ${serial}`,
            `Diterbitkan oleh ${COMPANY_LEGAL} melalui platform ${COMPANY_SITE} · Kontak kemitraan: ${COMPANY_EMAIL}`,
          ]
        : [
            `Status: DITANDATANGANI SECARA DIGITAL  ·  Tanggal tanda tangan: ${formatDateId(input.signedAt)} ${signedDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
            `Diterbitkan oleh ${COMPANY_LEGAL} melalui platform ${COMPANY_SITE} · Kontak kemitraan: ${COMPANY_EMAIL}`,
          ],
    },
    {
      type: 'note',
      label: draft ? 'Catatan draf perjanjian' : 'Catatan dokumen digital',
      text: draft
        ? 'Dokumen ini adalah DRAF Perjanjian Kerja Sama yang dihasilkan dari data formulir mitra. Draf belum sah dan belum mengikat para pihak sampai ditandatangani secara elektronik. ' +
          'Setelah mitra menandatangani, sistem Homy Property akan menerbitkan versi final lengkap dengan serial tanda tangan, timestamp, dan sertifikat penandatanganan elektronik.'
        : 'Salinan ini dihasilkan otomatis oleh sistem Homy Property dan sah sebagai arsip digital perjanjian yang ditandatangani melalui platform. ' +
          'Keaslian dapat diverifikasi admin melalui ID verifikasi dan ID perjanjian pada lampiran di bawah. Simpan dokumen ini untuk keperluan administrasi Anda.',
    },
    { type: 'group', atomic: true, blocks: [
      { type: 'heading', text: 'Lampiran A — Data Mitra' },
      { type: 'keyvalues', rows: partnerRows },
    ] },
    { type: 'group', atomic: true, blocks: [
      { type: 'heading', text: 'Lampiran B — Ketersediaan Waktu Layanan' },
      { type: 'paragraph', text: 'Jadwal berikut menjadi acuan penjadwalan survey & komunikasi dengan pengguna Homy Property:' },
      { type: 'bullets', items: availabilityLines(input.availability) },
    ] },
    { type: 'group', atomic: true, blocks: [
      { type: 'heading', text: 'Lampiran C — Ringkasan Komisi' },
      {
        type: 'bullets',
        items: [
          `Tarif komisi Homy: ${COMMISSION_RATE}% dari harga jual final setiap transaksi yang difasilitasi platform.`,
          `Contoh: harga jual final ${formatRupiah(COMMISSION_EXAMPLE.salePrice)} x ${COMMISSION_RATE}% = ${formatRupiah(COMMISSION_EXAMPLE.amount)}.`,
          'Transaksi sewa: 0,5% dari nilai kontrak sewa (maksimal sewa 1 tahun pertama), kecuali disepakati lain secara tertulis.',
          'Pelaporan transaksi: maksimal 3 hari kerja setelah transaksi. Pembayaran komisi: maksimal 7 hari kerja setelah pelunasan.',
          `Rekening resmi pembayaran komisi: ${COMPANY_BANK.bank} nomor ${COMPANY_BANK.accountNumber} atas nama ${COMPANY_BANK.accountHolder} — ditagihkan saat properti terjual atau tersewa.`,
        ],
      },
      { type: 'note', text: AGREEMENT_LAMPIRAN.join(' ') },
    ] },
  ]

  const identityImage = input.identityImage
  if (identityImage) {
    const identityName = identityLabel(partner.identityType)
    blocks.push({
      type: 'group',
      atomic: true,
      blocks: [
        { type: 'heading', text: 'Lampiran D — Salinan Dokumen Identitas' },
        {
          type: 'paragraph',
          text: `Salinan ${identityName} mitra yang diunggah melalui formulir perjanjian (maksimal 1 MB). Berkas asli tersimpan privat pada sistem Homy Property.`,
        },
        {
          type: 'image',
          image: {
            data: identityImage.data,
            width: identityImage.width,
            height: identityImage.height,
            maxHeight: 340,
            caption: `Salinan ${identityName} — ${String(partner.fullName ?? 'Mitra Homy')}`,
          },
        },
      ],
    })
  }

  blocks.push({ type: 'divider' })
  blocks.push({ type: 'heading', text: 'Isi Perjanjian Kerja Sama' })

  for (const clause of clauses) {
    const clauseBlocks: PdfBlock[] = [{ type: 'heading', text: clause.title }]
    for (const paragraph of clause.paragraphs ?? []) clauseBlocks.push({ type: 'paragraph', text: paragraph })
    if (clause.items?.length) clauseBlocks.push({ type: 'bullets', items: clause.items })
    // Satu pasal = satu blok atomic supaya tidak terpotong antar halaman.
    blocks.push({ type: 'group', atomic: true, blocks: clauseBlocks })
  }

  blocks.push({ type: 'divider' })
  blocks.push({ type: 'group', atomic: true, blocks: [
    { type: 'heading', text: draft ? 'Penandatanganan Elektronik (Menunggu Mitra)' : 'Penandatanganan Elektronik' },
    {
      type: 'paragraph',
      text: draft
        ? 'Perjanjian Kerja Sama ini masih berupa DRAF. Bagian tanda tangan di bawah belum diisi dan belum sah. Setelah mitra menandatangani secara elektronik melalui platform, sistem akan menerbitkan versi final dengan serial tanda tangan, waktu tanda tangan (WIB), sidik jari dokumen, dan sertifikat penandatanganan elektronik.'
        : 'Perjanjian Kerja Sama ini ditandatangani secara elektronik oleh para pihak. Dengan tanda tangan digital ini, MITRA menyatakan telah membaca, memahami, dan menyetujui seluruh isi Perjanjian beserta lampirannya. Setiap tanda tangan memiliki nomor serial, waktu tanda tangan (WIB), dan sidik jari dokumen yang tercatat pada sistem Homy Property.',
    },
    {
      type: 'signature',
      columns: draft
        ? [
            {
              label: `Pihak Kedua — Mitra (${roleLabel})`,
              name: '(belum ditandatangani)',
              fields: [
                { label: 'Nama', value: String(partner.fullName ?? '-') },
                { label: 'Peran', value: roleLabel },
                { label: 'Status', value: 'Menunggu tanda tangan' },
                { label: 'Serial draf', value: serial },
                { label: 'Dibuat', value: signedStampShort },
              ],
            },
            {
              label: 'Pihak Pertama — Homy Property',
              name: '(menunggu mitra)',
              fields: [
                { label: 'Nama', value: 'Admin Kemitraan Homy' },
                { label: 'Peran', value: COMPANY_LEGAL },
                { label: 'No. dokumen', value: number },
                { label: 'Status', value: 'Menunggu mitra' },
                { label: 'Email', value: COMPANY_EMAIL },
              ],
            },
          ]
        : [
            {
              label: `Pihak Kedua — Mitra (${roleLabel})`,
              name: String(partner.fullName ?? '-'),
              fields: [
                { label: 'Nama', value: String(partner.fullName ?? '-') },
                { label: 'Peran', value: roleLabel },
                { label: 'No. serial', value: serial },
                { label: 'Waktu ttd', value: signedStampShort },
                { label: 'Email', value: String(partner.email ?? '-') },
              ],
            },
            {
              label: 'Pihak Pertama — Homy Property',
              name: 'Admin Kemitraan Homy',
              fields: [
                { label: 'Nama', value: 'Admin Kemitraan Homy' },
                { label: 'Peran', value: COMPANY_LEGAL },
                { label: 'No. dokumen', value: number },
                { label: 'Waktu ttd', value: signedStampShort },
                { label: 'Email', value: COMPANY_EMAIL },
              ],
            },
          ],
      note: draft
        ? `Draf ini dibuat melalui ${COMPANY_SITE} pada ${signedStamp}. Status dokumen: DRAF — belum sah dan belum mengikat para pihak.`
        : `Ditandatangani secara elektronik melalui ${COMPANY_SITE} pada ${signedStamp}. Status dokumen: SAH sebagai arsip digital perjanjian.`,
    },
  ] })

  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'certificate',
    title: draft ? 'Ringkasan Draf Perjanjian' : 'Sertifikat Penandatanganan Elektronik',
    rows: draft
      ? [
          { label: 'Nomor dokumen', value: number },
          { label: 'Versi dokumen', value: version },
          { label: 'Serial draf', value: serial },
          { label: 'ID dokumen draf', value: signatureKey },
          { label: 'Dibuat pada', value: signedStamp },
          { label: 'Mitra', value: `${String(partner.fullName ?? '-')} — ${roleLabel}` },
          { label: 'Email mitra', value: String(partner.email ?? '-') },
          { label: 'Status dokumen', value: 'DRAF — belum ditandatangani' },
          { label: 'Dicetak dari', value: COMPANY_SITE },
          { label: 'ID verifikasi mitra', value: String(input.verificationId ?? '-') },
          { label: 'Sidik jari draf (SHA-256)', value: fingerprintGroups(fingerprint, 8) },
        ]
      : [
          { label: 'Nomor dokumen', value: number },
          { label: 'Versi dokumen', value: version },
          { label: 'Serial tanda tangan', value: serial },
          { label: 'ID tanda tangan', value: signatureKey },
          { label: 'Ditandatangani oleh', value: `${String(partner.fullName ?? '-')} — ${roleLabel}` },
          { label: 'Email mitra', value: String(partner.email ?? '-') },
          { label: 'Waktu tanda tangan', value: signedStamp },
          { label: 'Metode', value: `Tanda tangan elektronik (e-signature) melalui ${COMPANY_SITE}` },
          { label: 'Alamat IP perangkat', value: String(input.signedIp ?? '-') },
          { label: 'Perangkat', value: summarizeUserAgent(input.userAgent) },
          { label: 'ID perjanjian', value: String(input.agreementId ?? '-') },
          { label: 'ID verifikasi mitra', value: String(input.verificationId ?? '-') },
          { label: 'Sidik jari dokumen (SHA-256)', value: fingerprintGroups(fingerprint, 8) },
        ],
    note: draft
      ? 'Halaman ini menandai dokumen sebagai DRAF. Setelah mitra menandatangani secara elektronik, sistem Homy Property menerbitkan versi final lengkap dengan sertifikat penandatanganan elektronik, serial tanda tangan, timestamp, dan sidik jari SHA-256.'
      : 'Sertifikat ini dihasilkan otomatis oleh sistem Homy Property dan menjadi bagian tidak terpisahkan dari Perjanjian Kerja Sama. Keaslian dokumen dapat diverifikasi admin Homy dengan mencocokkan nomor dokumen, serial tanda tangan, dan sidik jari SHA-256 di atas.',
  })

  return buildPdf({
    title: AGREEMENT_TITLE,
    badge: draft ? 'DRAFT' : version,
    blocks,
    watermark: draft ? 'DRAFT' : undefined,
    footerNote: draft
      ? `${COMPANY_LEGAL} · DRAF Perjanjian Kerja Sama Mitra ${version} · ${COMPANY_SITE}`
      : `${COMPANY_LEGAL} · Perjanjian Kerja Sama Mitra ${version} · ${COMPANY_SITE}`,
  })
}
