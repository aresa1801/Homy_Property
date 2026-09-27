/**
 * Homy — penyusun PDF Surat Perjanjian Pemasaran, Penjualan & Penyewaan Properti
 * antara Pemilik Properti dan Agen Properti (dokumen MANDIRI, tanpa kop Homy).
 *
 * Memakai `lib/pdf-lite.ts` (tanpa dependensi eksternal) sehingga dokumen dapat
 * dibuat langsung pada runtime Next.js tanpa proses build tambahan.
 */

import { buildPdf, type PdfBlock } from '@/lib/pdf-lite'
import {
  BLANK,
  OWNER_AGREEMENT_SUBTITLE,
  OWNER_AGREEMENT_TITLE,
  OWNER_AGREEMENT_VERSION,
  buildOwnerAgreementClauses,
  exclusivityLabel,
  feePayerLabel,
  filler,
  formatDateId,
  formatRupiah,
  identityTypeLabel,
  listingModeLabel,
  numberFromPercent,
  ownerAgreementNumber,
  type OwnerAgreementData,
  type OwnerAgreementParty,
} from '@/lib/owner-agreement'

export type OwnerAgreementPdfInput = {
  data: OwnerAgreementData
  /** `template` = formulir kosong berlabel TEMPLATE; `final` = dokumen terisi (default). */
  mode?: 'template' | 'final'
  /** Benih nomor dokumen (mis. id agen) supaya nomor stabil per dokumen. */
  seed?: string
  /** Waktu pembuatan dokumen (opsional). */
  generatedAt?: string
}

function partyAddress(party: OwnerAgreementParty) {
  return [party.address, party.city, party.province]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

function partyRows(label: string, party: OwnerAgreementParty): { label: string; value: string }[] {
  return [
    { label: `${label} — nama`, value: filler(party.name) },
    { label: 'Jenis identitas', value: identityTypeLabel(party.identityType) },
    { label: 'Nomor identitas', value: filler(party.identityNumber) },
    { label: 'Alamat', value: filler(partyAddress(party)) },
    { label: 'Telepon/WhatsApp', value: filler(party.phone) },
    { label: 'Surel', value: filler(party.email) },
    { label: 'Pekerjaan/perusahaan', value: filler([party.occupation, party.companyName].map((v) => String(v ?? '').trim()).filter(Boolean).join(' · ')) },
    { label: 'NPWP', value: filler(party.npwp) },
  ]
}

export function buildOwnerAgreementPdf(input: OwnerAgreementPdfInput): Uint8Array {
  const template = input.mode === 'template'
  const data: OwnerAgreementData = {
    ...input.data,
    owner: input.data?.owner ?? {},
    agent: input.data?.agent ?? {},
    property: input.data?.property ?? {},
    terms: input.data?.terms ?? {},
  }
  const number = String(data.number ?? '').trim() || ownerAgreementNumber(data, input.seed ?? '')
  const clauses = buildOwnerAgreementClauses(data)
  const property = data.property
  const terms = data.terms

  const saleFee = numberFromPercent(terms.salePrice, terms.feePercent)
  const rentFee = numberFromPercent(terms.rentPrice, terms.feePercent)
  const documents = Array.isArray(property.documents) ? property.documents.filter(Boolean) : []
  const witnesses = (Array.isArray(data.witnesses) ? data.witnesses : []).filter((row) => String(row?.name ?? '').trim())

  const blocks: PdfBlock[] = [
    {
      type: 'title',
      text: OWNER_AGREEMENT_TITLE,
      sub: `${OWNER_AGREEMENT_SUBTITLE}\nNomor: ${number}\nDibuat di ${filler(data.place, '................')} pada ${formatDateId(data.date)}  ·  Versi dokumen ${OWNER_AGREEMENT_VERSION}`,
      badge: template ? 'TEMPLATE' : OWNER_AGREEMENT_VERSION,
    },
    {
      type: 'meta',
      lines: [
        'Dokumen MANDIRI antara Pemilik Properti (Pihak Pertama) dan Agen Properti (Pihak Kedua).',
        'Homy Property tidak menjadi pihak dalam perjanjian ini; aplikasi Homy Property hanya membantu agen menyusun dan mengunduh dokumen.',
      ],
    },
    {
      type: 'note',
      label: template ? 'Petunjuk penggunaan formulir' : 'Catatan dokumen',
      text: template
        ? 'Formulir ini kosong dan dapat dicetak untuk diisi tangan. Isi bagian yang diberi tanda titik-titik, bacakan kepada kedua pihak, tempelkan materai sesuai ketentuan, lalu tanda tangani di hadapan para saksi. Untuk dokumen terisi otomatis, isi datanya pada menu Perjanjian Pemilik di dasbor agen.'
        : 'Dokumen ini disusun dengan bantuan aplikasi Homy Property oleh Agen Properti untuk mengikat perjanjian pemasaran dengan Pemilik Properti. Perjanjian ini bukan perjanjian dengan Homy Property. Pastikan seluruh data telah diperiksa, dibacakan kepada kedua pihak, dan dibubuhi materai sesuai ketentuan sebelum ditandatangani.',
    },
    { type: 'group', atomic: true, blocks: [
      { type: 'heading', text: 'Pihak Pertama — Pemilik Properti' },
      { type: 'keyvalues', rows: partyRows('Pemilik', data.owner) },
    ] },
    { type: 'group', atomic: true, blocks: [
      { type: 'heading', text: 'Pihak Kedua — Agen Properti' },
      { type: 'keyvalues', rows: partyRows('Agen', data.agent) },
      ...(String(data.agent.representative ?? '').trim()
        ? [{ type: 'paragraph' as const, text: `Diwakili oleh: ${String(data.agent.representative)} (berdasarkan surat kuasa yang sah).` }]
        : []),
    ] },
    { type: 'group', atomic: true, blocks: [
      { type: 'heading', text: 'Ringkasan Data Properti' },
      {
        type: 'keyvalues',
        rows: [
          { label: 'Jenis/judul', value: filler([property.propertyType, property.title].map((v) => String(v ?? '').trim()).filter(Boolean).join(' — ')) },
          { label: 'Alamat', value: filler([property.address, property.city, property.province, property.postalCode].map((v) => String(v ?? '').trim()).filter(Boolean).join(', ')) },
          { label: 'Bukti kepemilikan', value: `${filler(property.certificateType, 'SHM/SHGB/AJB/Girik/Lainnya')} No. ${filler(property.certificateNumber)}` },
          { label: 'Luas tanah / bangunan', value: `${filler(property.landArea)} m2 / ${filler(property.buildingArea)} m2` },
          { label: 'Kamar tidur / mandi / lantai', value: `${filler(property.bedrooms)} / ${filler(property.bathrooms)} / ${filler(property.floors)}` },
          { label: 'Tahun dibangun', value: filler(property.yearBuilt) },
          { label: 'IMB/PBG/SLF', value: filler(property.imNumber) },
          { label: 'Fasilitas & kondisi', value: filler(property.facilities) },
        ],
      },
      ...(documents.length
        ? [{ type: 'paragraph' as const, text: 'Dokumen properti yang diserahkan pemilik kepada agen:' }, { type: 'bullets' as const, items: documents }]
        : []),
    ] },
    { type: 'group', atomic: true, blocks: [
      { type: 'heading', text: 'Ringkasan Ketentuan Komersial' },
      {
        type: 'keyvalues',
        rows: [
          { label: 'Tujuan pemasaran', value: listingModeLabel(terms.listingMode) },
          ...(terms.listingMode !== 'rent'
            ? [
                { label: 'Harga jual', value: formatRupiah(terms.salePrice) + (terms.negotiable ? ' (dapat dinegosiasikan)' : '') },
                { label: 'Batas harga terendah', value: formatRupiah(terms.minPrice) },
              ]
            : []),
          ...(terms.listingMode === 'rent' || terms.listingMode === 'both'
            ? [{ label: 'Harga sewa', value: `${formatRupiah(terms.rentPrice)} per ${filler(terms.rentPeriod, 'tahun')}` }]
            : []),
          { label: 'Imbal jasa agen', value: `${filler(terms.feePercent, '……')}% dari harga jual/sewa` },
          { label: 'Ditanggung oleh', value: feePayerLabel(terms.feePayer) },
          { label: 'Waktu pembayaran', value: filler(terms.feeTiming, 'pada saat akad/pelunasan') },
          { label: 'Sifat penugasan', value: exclusivityLabel(terms.exclusivity) },
          { label: 'Jangka waktu', value: `${filler(terms.durationMonths, '……')} bulan, mulai ${formatDateId(terms.startDate)}` },
        ],
      },
      {
        type: 'bullets',
        items: [
          ...(saleFee ? [`Contoh imbal jasa penjualan: ${formatRupiah(terms.salePrice)} x ${filler(terms.feePercent, '……')}% = ${formatRupiah(saleFee)}.`] : []),
          ...(rentFee ? [`Contoh imbal jasa penyewaan: ${formatRupiah(terms.rentPrice)} x ${filler(terms.feePercent, '……')}% = ${formatRupiah(rentFee)}.`] : []),
          String(terms.marketingScope ?? '').trim()
            ? `Cakupan pekerjaan pemasaran: ${String(terms.marketingScope)}.`
            : 'Cakupan pekerjaan pemasaran: foto/video, publikasi kanal digital, penjadwalan & pendampingan survey, negosiasi atas persetujuan pemilik, dan pendampingan administrasi hingga akad.',
        ],
      },
      ...(String(terms.specialTerms ?? '').trim()
        ? [{ type: 'note' as const, label: 'Ketentuan khusus yang disepakati', text: String(terms.specialTerms) }]
        : []),
    ] },
    { type: 'divider' },
    { type: 'heading', text: 'Isi Perjanjian' },
  ]

  for (const clause of clauses) {
    const clauseBlocks: PdfBlock[] = [{ type: 'heading', text: clause.title }]
    for (const paragraph of clause.paragraphs ?? []) clauseBlocks.push({ type: 'paragraph', text: paragraph })
    if (clause.items?.length) clauseBlocks.push({ type: 'bullets', items: clause.items })
    blocks.push({ type: 'group', atomic: true, blocks: clauseBlocks })
  }

  const stampNote =
    'Dokumen ini dibuat dalam 2 (dua) rangkap; masing-masing pihak menerima 1 (satu) rangkap. ' +
    'Dokumen dibubuhi materai sesuai ketentuan perpajakan yang berlaku dan ditandatangani secara basah (tanda tangan asli) oleh Pihak Pertama, Pihak Kedua, dan para saksi pada ruang tanda tangan yang tersedia.'

  const witnessList = witnesses.length
    ? witnesses.slice(0, 4)
    : [{ name: '', address: '', phone: '' }, { name: '', address: '', phone: '' }]

  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'paragraph',
    text: `Yang bertanda tangan di bawah ini menyatakan telah membaca, memahami, dan menyetujui seluruh isi perjanjian beserta lampirannya, tanpa paksaan dari pihak mana pun. Dibuat dan disepakati di ${filler(data.place, '................')} pada tanggal ${formatDateId(data.date)}, oleh dan antara kedua pihak dengan disaksikan para saksi di bawah ini.`,
  })
  blocks.push({
    type: 'signature',
    wet: true,
    columns: [
      {
        label: 'PIHAK PERTAMA',
        name: filler(data.owner.name, 'Pemilik Properti'),
        role: 'Pemilik Properti',
        fields: [
          { label: 'Nama lengkap', value: filler(data.owner.name) },
          { label: 'No. identitas', value: filler(data.owner.identityNumber) },
          { label: 'Tanggal', value: BLANK },
        ],
      },
      {
        label: 'PIHAK KEDUA',
        name: filler(data.agent.name, 'Agen Properti'),
        role: 'Agen Properti',
        fields: [
          { label: 'Nama lengkap', value: filler(data.agent.name) },
          { label: 'No. identitas', value: filler(data.agent.identityNumber) },
          { label: 'Tanggal', value: BLANK },
        ],
      },
    ],
    note: 'Tempelkan materai sesuai ketentuan pada salah satu ruang tanda tangan di atas. Tanda tangan dibubuhkan dengan pena pada ruang kosong yang tersedia.',
  })
  blocks.push({
    type: 'group',
    atomic: true,
    blocks: [
      { type: 'heading', text: 'Saksi-Saksi' },
      {
        type: 'paragraph',
        text: 'Para saksi menyatakan telah menyaksikan penandatanganan perjanjian ini oleh kedua pihak dan memahami isinya.',
      },
      {
        type: 'keyvalues',
        rows: witnessList.flatMap((witness, index) => [
          { label: `Saksi ${index + 1} — nama`, value: filler(witness.name) },
          { label: `Saksi ${index + 1} — alamat`, value: filler(witness.address) },
          { label: `Saksi ${index + 1} — telepon`, value: filler(witness.phone) },
        ]),
      },
      {
        type: 'signature',
        wet: true,
        materai: false,
        columns: witnessList.map((witness, index) => ({
          label: `SAKSI ${index + 1}`,
          name: filler(witness.name, `Saksi ${index + 1}`),
          fields: [
            { label: 'Nama lengkap', value: filler(witness.name) },
            { label: 'Tanggal', value: BLANK },
          ],
        })),
      },
    ],
  })
  blocks.push({ type: 'note', label: 'Catatan', text: stampNote })

  return buildPdf({
    title: OWNER_AGREEMENT_TITLE,
    badge: template ? 'TEMPLATE' : OWNER_AGREEMENT_VERSION,
    blocks,
    footerNote: `${number} · Dokumen mandiri Pemilik Properti & Agen Properti · Homy bukan pihak.`,
    watermark: template ? 'TEMPLATE' : undefined,
  })
}
