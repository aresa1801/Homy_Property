/**
 * Homy — Surat Perjanjian Pemasaran, Penjualan & Penyewaan Properti (Agen ↔ Pemilik).
 *
 * Dokumen MANDIRI antara Pemilik Properti dan Agen Properti. Dokumen ini BUKAN
 * perjanjian dengan Homy Property dan TIDAK memakai kop surat Homy. Aplikasi Homy
 * hanya membantu agen menyusun dan mengunduh perjanjian tertulis dengan pemilik
 * properti yang menitipkan propertinya untuk dijual/disewakan.
 *
 * Dipakai oleh:
 *  - `lib/owner-agreement-pdf.ts` (penyusun PDF, memakai `lib/pdf-lite.ts`)
 *  - `app/api/agent/owner-agreement/route.ts` (unduhan PDF)
 *  - `components/dashboard/boards-owner-agreement.tsx` (form dasbor agen)
 *
 * Setiap perubahan substansi WAJIB menaikkan OWNER_AGREEMENT_VERSION.
 */

export const OWNER_AGREEMENT_VERSION = 'v1.0'
export const OWNER_AGREEMENT_TITLE = 'Surat Perjanjian Pemasaran, Penjualan dan Penyewaan Properti'
export const OWNER_AGREEMENT_SUBTITLE = 'Perjanjian tertulis antara Pemilik Properti (Pihak Pertama) dan Agen Properti (Pihak Kedua)'

/** Placeholder untuk field kosong supaya dokumen tetap bisa dicetak lalu diisi tangan. */
export const BLANK = '................................................'

export type OwnerIdentityType = 'ktp' | 'sim' | 'paspor'
export type OwnerListingMode = 'sale' | 'rent' | 'both'
export type OwnerExclusivity = 'exclusive' | 'non-exclusive'
export type OwnerFeePayer = 'pemilik' | 'agen' | 'pembeli' | 'disepakati'

export const OWNER_IDENTITY_TYPES: { value: OwnerIdentityType; label: string }[] = [
  { value: 'ktp', label: 'KTP' },
  { value: 'sim', label: 'SIM' },
  { value: 'paspor', label: 'Paspor' },
]

export const OWNER_LISTING_MODES: { value: OwnerListingMode; label: string }[] = [
  { value: 'sale', label: 'Dijual' },
  { value: 'rent', label: 'Disewakan' },
  { value: 'both', label: 'Dijual dan/atau disewakan' },
]

export const OWNER_EXCLUSIVITY: { value: OwnerExclusivity; label: string }[] = [
  { value: 'non-exclusive', label: 'Non-eksklusif (pemilik boleh menunjuk agen lain)' },
  { value: 'exclusive', label: 'Eksklusif (hanya agen ini selama masa perjanjian)' },
]

export const OWNER_FEE_PAYERS: { value: OwnerFeePayer; label: string }[] = [
  { value: 'pemilik', label: 'Pemilik Properti' },
  { value: 'pembeli', label: 'Pembeli/Penyewa' },
  { value: 'disepakati', label: 'Disepakati bersama (dibagi kedua pihak)' },
  { value: 'agen', label: 'Agen (ditanggung sendiri oleh agen)' },
]

export type OwnerAgreementParty = {
  name: string
  identityType?: OwnerIdentityType | string | null
  identityNumber?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  phone?: string | null
  email?: string | null
  occupation?: string | null
  companyName?: string | null
  npwp?: string | null
  representative?: string | null
}

export type OwnerAgreementProperty = {
  propertyType?: string | null
  title?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null
  certificateType?: string | null
  certificateNumber?: string | null
  landArea?: string | null
  buildingArea?: string | null
  bedrooms?: string | null
  bathrooms?: string | null
  floors?: string | null
  yearBuilt?: string | null
  facilities?: string | null
  imNumber?: string | null
  documents?: string[]
  keyHandover?: boolean
  notes?: string | null
}

export type OwnerAgreementTerms = {
  listingMode?: OwnerListingMode | string | null
  salePrice?: string | null
  minPrice?: string | null
  rentPrice?: string | null
  rentPeriod?: string | null
  negotiable?: boolean
  feePercent?: string | null
  feePayer?: OwnerFeePayer | string | null
  feeTiming?: string | null
  exclusivity?: OwnerExclusivity | string | null
  durationMonths?: string | null
  startDate?: string | null
  marketingScope?: string | null
  specialTerms?: string | null
}

export type OwnerAgreementWitness = {
  name?: string | null
  address?: string | null
  phone?: string | null
}

export type OwnerAgreementData = {
  number?: string | null
  place?: string | null
  date?: string | null
  owner: OwnerAgreementParty
  agent: OwnerAgreementParty
  property: OwnerAgreementProperty
  terms: OwnerAgreementTerms
  witnesses?: OwnerAgreementWitness[]
}

export type OwnerAgreementClause = {
  title: string
  paragraphs?: string[]
  items?: string[]
}

/* ------------------------------ pembantu teks ------------------------------ */

/** Isi teks atau placeholder titik-titik bila kosong (agar bisa dicetak & diisi tangan). */
export function filler(value?: string | null, fallback: string = BLANK) {
  const text = String(value ?? '').trim()
  return text || fallback
}

export function formatRupiah(value?: number | string | null) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(number) || number <= 0) return BLANK
  return 'Rp ' + Math.round(number).toLocaleString('id-ID')
}

export function formatDateId(value?: string | null) {
  const raw = String(value ?? '').trim()
  if (!raw) return BLANK
  const date = new Date(raw.length <= 10 ? raw + 'T00:00:00' : raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function identityTypeLabel(value?: string | null) {
  const found = OWNER_IDENTITY_TYPES.find((item) => item.value === value)
  return found ? found.label : 'KTP/SIM/Paspor'
}

export function listingModeLabel(value?: string | null) {
  const found = OWNER_LISTING_MODES.find((item) => item.value === value)
  return found ? found.label : BLANK
}

export function exclusivityLabel(value?: string | null) {
  const found = OWNER_EXCLUSIVITY.find((item) => item.value === value)
  return found ? found.label.split(' (')[0] : BLANK
}

export function feePayerLabel(value?: string | null) {
  const found = OWNER_FEE_PAYERS.find((item) => item.value === value)
  return found ? found.label : BLANK
}

export function numberFromPercent(price?: string | null, percent?: string | null) {
  const base = Number(String(price ?? '').replace(/[^0-9.]/g, ''))
  const rate = Number(String(percent ?? '').replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(base) || !Number.isFinite(rate) || base <= 0 || rate <= 0) return null
  return (base * rate) / 100
}

/** Rentang tanggal berakhir berdasarkan tanggal mulai + durasi bulan. */
export function endDateFrom(start?: string | null, months?: string | null) {
  const raw = String(start ?? '').trim()
  const count = Number(String(months ?? '').replace(/[^0-9]/g, ''))
  if (!raw || !Number.isFinite(count) || count <= 0) return null
  const date = new Date(raw.length <= 10 ? raw + 'T00:00:00' : raw)
  if (Number.isNaN(date.getTime())) return null
  date.setMonth(date.getMonth() + count)
  return date.toISOString().slice(0, 10)
}

/** Nomor dokumen mandiri: OA/AGN/<tahun>/<6 digit>. */
export function ownerAgreementNumber(data: OwnerAgreementData, seed: string) {
  const year = new Date(String(data.date ?? '') || Date.now()).getFullYear() || new Date().getFullYear()
  const digits = String(seed ?? '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || String(Date.now()).slice(-6)
  return `OA/AGN/${year}/${digits}`
}

export const OWNER_DOCUMENT_OPTIONS = [
  'Sertifikat tanah/bangunan (asli atau fotokopi)',
  'IMB/PBG/SLF',
  'KTP pemilik',
  'Kartu Keluarga',
  'Bukti pembayaran PBB terakhir',
  'Denah/layout bangunan',
  'Fotokopi AJB/akta sebelumnya',
  'Surat kuasa (bila dikuasakan)',
] as const

export const OWNER_MARKETING_SCOPE_OPTIONS = [
  'Foto & video properti (profesional/semi-profesional)',
  'Pemasangan papan nama/plang (bila diizinkan pemilik)',
  'Publikasi ke kanal digital (marketplace properti, media sosial, aplikasi Homy)',
  'Penjadwalan & pendampingan survey calon pembeli/penyewa',
  'Negosiasi harga atas persetujuan tertulis pemilik',
  'Pendampingan proses administrasi hingga akad',
] as const

/* --------------------------------- pasal ---------------------------------- */

export function buildOwnerAgreementClauses(data: OwnerAgreementData): OwnerAgreementClause[] {
  const owner = data.owner ?? ({} as OwnerAgreementParty)
  const agent = data.agent ?? ({} as OwnerAgreementParty)
  const property = data.property ?? ({} as OwnerAgreementProperty)
  const terms = data.terms ?? ({} as OwnerAgreementTerms)

  const ownerName = filler(owner.name, 'Pihak Pertama')
  const agentName = filler(agent.name, 'Pihak Kedua')
  const feePercent = filler(terms.feePercent, '……')
  const feePayer = feePayerLabel(terms.feePayer)
  const exclusivity = exclusivityLabel(terms.exclusivity)
  const mode = listingModeLabel(terms.listingMode)
  const duration = filler(terms.durationMonths, '……')
  const scope = String(terms.marketingScope ?? '').trim()
  const propertyLabel = [property.propertyType, property.title].map((part) => String(part ?? '').trim()).filter(Boolean).join(' — ')
  const propertyAddress = [property.address, property.city, property.province, property.postalCode]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ')
  const endDate = endDateFrom(terms.startDate, terms.durationMonths)
  const saleFee = numberFromPercent(terms.salePrice, terms.feePercent)
  const rentFee = numberFromPercent(terms.rentPrice, terms.feePercent)
  const documents = Array.isArray(property.documents) ? property.documents.filter(Boolean) : []
  const witnesses = (Array.isArray(data.witnesses) ? data.witnesses : []).filter((row) => String(row?.name ?? '').trim())

  return [
    {
      title: 'Pasal 1 — Definisi',
      items: [
        '“Pihak Pertama” adalah Pemilik Properti atau pihak yang sah berhak menitipkan properti untuk dipasarkan, dijual, dan/atau disewakan.',
        '“Pihak Kedua” adalah Agen Properti yang menerima penugasan pemasaran berdasarkan Perjanjian ini.',
        '“Properti” adalah objek yang diuraikan pada Pasal 3 beserta seluruh bagian yang melekat dan tidak terpisahkan darinya.',
        '“Harga Jual/Sewa” adalah harga kesepakatan final yang tercantum pada akta, perjanjian pengikatan jual beli (PPJB), akad kredit, atau perjanjian sewa.',
        '“Calon Pembeli/Penyewa” adalah pihak yang diperkenalkan oleh Pihak Kedua atau yang mengikuti proses pemasaran berdasarkan Perjanjian ini.',
        '“Imbal Jasa (Komisi)” adalah imbalan Pihak Kedua atas keberhasilan menemukan pembeli/penyewa sampai terjadinya transaksi, dengan besaran pada Pasal 6.',
        '“Transaksi” adalah setiap penjualan, pembelian, sewa-menyewa, atau bentuk pengalihan hak atas Properti yang terjadi karena, melalui, atau sebagai hasil dari pemasaran oleh Pihak Kedua.',
      ],
    },
    {
      title: 'Pasal 2 — Para Pihak',
      paragraphs: [
        `PIHAK PERTAMA: ${ownerName}, selanjutnya disebut Pemilik Properti, yang bertindak sebagai pemilik sah Properti dan berwenang menandatangani Perjanjian ini.`,
        `PIHAK KEDUA: ${agentName}, selanjutnya disebut Agen Properti, yang menjalankan usaha jasa pemasaran properti dan menerima penugasan dari Pihak Pertama.`,
        'Kedua pihak menyatakan cakap hukum, tidak dalam keadaan dipaksa, dan sepakat mengikatkan diri pada Perjanjian ini berdasarkan asas itikad baik serta kebebasan berkontrak sebagaimana diatur dalam Pasal 1320 Kitab Undang-Undang Hukum Perdata.',
      ],
    },
    {
      title: 'Pasal 3 — Objek Perjanjian',
      paragraphs: [
        'Pihak Pertama menitipkan dan menugaskan Properti berikut kepada Pihak Kedua untuk dipasarkan, diupayakan penjualan dan/atau penyewaan:',
      ],
      items: [
        `Jenis/judul properti: ${filler(propertyLabel, '................................................')}`,
        `Alamat lengkap: ${filler(propertyAddress, '................................................')}`,
        `Bukti kepemilikan: ${filler(property.certificateType, 'SHM/SHGB/AJB/Girik/Lainnya')} nomor ${filler(property.certificateNumber)}`,
        `Luas tanah: ${filler(property.landArea)} m2 · Luas bangunan: ${filler(property.buildingArea)} m2`,
        `Kamar tidur: ${filler(property.bedrooms)} · Kamar mandi: ${filler(property.bathrooms)} · Jumlah lantai: ${filler(property.floors)}`,
        `Tahun dibangun: ${filler(property.yearBuilt)} · IMB/PBG/SLF: ${filler(property.imNumber)}`,
        `Fasilitas & kondisi: ${filler(property.facilities)}`,
        'Kedua pihak sepakat bahwa segala keterangan mengenai Properti merupakan bagian yang tidak terpisahkan dari Perjanjian ini.',
      ],
    },
    {
      title: 'Pasal 4 — Sifat Penugasan dan Masa Berlaku',
      paragraphs: [
        `Penugasan ini diberikan secara ${exclusivity} (pilih salah satu: eksklusif/non-eksklusif).`,
        `Perjanjian berlaku untuk jangka waktu ${duration} bulan, terhitung sejak ${formatDateId(terms.startDate)} sampai ${formatDateId(endDate)}.`,
      ],
      items: [
        'Apabila tidak diperjanjikan lain, perjanjian dianggap diperpanjang hanya apabila kedua pihak menyetujui perpanjangan secara tertulis atau melalui pesan elektronik yang dapat dibuktikan.',
        'Pada penugasan NON-EKSKLUSIF, Pihak Pertama berhak menunjuk agen/broker lain, namun wajib memberitahukan kepada Pihak Kedua apabila transaksi terjadi melalui pihak lain agar tidak terjadi tumpang tindih klaim imbal jasa.',
        'Pada penugasan EKSKLUSIF, Pihak Pertama hanya menugaskan Pihak Kedua selama masa perjanjian; transaksi dengan Calon Pembeli/Penyewa yang diperkenalkan Pihak Kedua tetap tunduk pada Pasal 6.',
        'Penugasan ini bersifat pemberian kuasa pemasaran dan TIDAK mengalihkan kepemilikan Properti kepada Pihak Kedua dalam bentuk apa pun.',
      ],
    },
    {
      title: 'Pasal 5 — Harga dan Ketentuan Transaksi',
      paragraphs: [
        `Harga yang ditetapkan Pihak Pertama: untuk penjualan ${formatRupiah(terms.salePrice)}${terms.negotiable ? ' (dapat dinegosiasikan)' : ' (harga bersih minimum)'}; untuk penyewaan ${formatRupiah(terms.rentPrice)} per ${filler(terms.rentPeriod, 'tahun')}.`,
        `Batas harga terendah yang dapat diterima Pihak Pertama: ${formatRupiah(terms.minPrice)}. Pihak Kedua dilarang menyepakati harga di bawah batas tersebut tanpa persetujuan tertulis Pihak Pertama.`,
      ],
      items: [
        `Properti dipasarkan untuk: ${mode}.`,
        'Pihak Kedua wajib memasarkan Properti sesuai harga dan data yang disepakati, serta tidak melakukan manipulasi harga, informasi palsu, atau janji yang tidak dapat dipenuhi.',
        'Setiap tawaran dari Calon Pembeli/Penyewa yang berbeda dari harga kesepakatan wajib dikonsultasikan lebih dahulu kepada Pihak Pertama.',
        'Biaya-biaya transaksi (mis. notaris/PPAT, BPHTB, pajak penjual, provisi bank, komisi pembeli) diatur dan ditanggung sesuai kesepakatan para pihak serta peraturan perpajakan yang berlaku, di luar imbal jasa Pihak Kedua.',
        'Apabila harga Properti hendak diubah selama masa perjanjian, perubahan dilakukan melalui addendum yang disetujui kedua pihak.',
      ],
    },
    {
      title: 'Pasal 6 — Imbal Jasa (Komisi) Agen',
      paragraphs: [
        `Atas keberhasilan pemasaran sampai terjadinya Transaksi, Pihak Kedua berhak menerima imbal jasa sebesar ${feePercent}% dari Harga Jual/Sewa, ditanggung oleh ${feePayer}.`,
        `Contoh perhitungan penjualan: harga jual ${formatRupiah(terms.salePrice)} x ${feePercent}% = ${saleFee ? formatRupiah(saleFee) : BLANK}.`,
        `Contoh perhitungan penyewaan: harga sewa ${formatRupiah(terms.rentPrice)} x ${feePercent}% = ${rentFee ? formatRupiah(rentFee) : BLANK}.`,
      ],
      items: [
        `Imbal jasa dibayarkan ${filler(terms.feeTiming, 'pada saat akad/pelunasan transaksi')}.`,
        'Hak atas imbal jasa timbul pada saat Transaksi benar-benar terjadi (akad jual-beli sah atau perjanjian sewa disepakati dan berjalan), bukan pada saat Properti sekadar dipasarkan atau ditemukan calon pembeli.',
        'Apabila transaksi dibatalkan oleh sebab wanprestasi Pihak Pertama atau kesepakatan bersama, imbal jasa dihitung proporsional atas jasa pemasaran yang telah nyata dilakukan, melalui musyawarah kedua pihak.',
        'Pembayaran imbal jasa dilakukan melalui transfer bank ke rekening Pihak Kedua dengan bukti transfer yang sah; kedua pihak menyimpan bukti pembayaran.',
        'Setiap pajak atas imbal jasa menjadi tanggungan pihak penerima imbal jasa sesuai peraturan perpajakan yang berlaku.',
        'Pihak Kedua hanya berhak atas satu imbal jasa untuk setiap Transaksi dan tidak dibenarkan menerima atau meminta uang tambahan dari Calon Pembeli/Penyewa tanpa persetujuan tertulis Pihak Pertama.',
      ],
    },
    {
      title: 'Pasal 7 — Hak dan Kewajiban Pemilik Properti (Pihak Pertama)',
      items: [
        'Menjamin Properti benar-benar miliknya/pihak yang sah, tidak dalam sengketa, tidak dijaminkan, tidak sedang disewakan kepada pihak lain, dan tidak terikat penjualan kepada pihak lain.',
        'Menyerahkan data dan dokumen Properti yang benar, lengkap, dan terkini kepada Pihak Kedua, termasuk legalitas, kondisi bangunan, dan informasi biaya yang menjadi tanggungan pembeli/penyewa.',
        'Memberikan izin kepada Pihak Kedua untuk memasarkan Properti, memotret/merekam, serta menayangkan data Properti pada kanal pemasaran, kecuali untuk data yang secara tegas dikecualikan.',
        'Memberikan akses dan waktu yang wajar bagi Pihak Kedua untuk menunjukkan Properti kepada Calon Pembeli/Penyewa yang telah membuat janji.',
        'Memberitahukan secara tertulis/terbukti kepada Pihak Kedua apabila Properti terjual atau tersewa langsung olehnya atau melalui pihak lain, maksimal 3 (tiga) hari setelah kesepakatan terjadi.',
        'Menanggung keabsahan kepemilikan dan legalitas Properti, serta membebaskan Pihak Kedua dari tuntutan pihak lain yang timbul karena ketidakbenaran data yang diberikan.',
      ],
    },
    {
      title: 'Pasal 8 — Hak dan Kewajiban Agen Properti (Pihak Kedua)',
      items: [
        'Memasarkan Properti secara aktif, jujur, profesional, dan sesuai data yang benar; tidak menyesatkan Calon Pembeli/Penyewa.',
        'Menjaga kerahasiaan harga terendah, data kepemilikan, dan informasi yang bersifat rahasia yang diberikan Pihak Pertama.',
        'Tidak mengubah harga, kondisi, atau isi Perjanjian tanpa persetujuan tertulis Pihak Pertama.',
        'Tidak memungut/menerima uang dalam bentuk apa pun (tanda jadi, titip jaminan, biaya booking) tanpa persetujuan tertulis Pihak Pertama dan bukti resmi, dan tidak menampung dana milik pemilik maupun calon pembeli/penyewa.',
        'Menghubungkan Calon Pembeli/Penyewa kepada Pihak Pertama secara terbuka (memperkenalkan identitas kedua belah pihak) sebelum terjadinya kesepakatan harga.',
        'Menyerahkan laporan perkembangan pemasaran secara berkala (minimal 1 kali per bulan atau setelah survey penting) kepada Pihak Pertama.',
        'Mengembalikan kunci/akses Properti kepada Pihak Pertama apabila perjanjian berakhir atau ditutup.',
      ],
    },
    {
      title: 'Pasal 9 — Pemasaran dan Publikasi',
      paragraphs: [
        'Pihak Kedua memasarkan Properti dengan cakupan pekerjaan: ' +
          (scope ? scope + '.' : 'foto/video properti, publikasi kanal digital, penjadwalan dan pendampingan survey, negosiasi atas persetujuan Pihak Pertama, serta pendampingan administrasi hingga akad.'),
      ],
      items: [
        'Material pemasaran (foto, video, teks) wajib menggambarkan kondisi dan spesifikasi Properti secara wajar dan tidak menyesatkan.',
        'Pemasangan plang/papan nama di lokasi hanya dilakukan dengan izin terbuka Pihak Pertama.',
        'Pihak Pertama berhak meminta perbaikan atau penurunan materi pemasaran yang tidak akurat dalam waktu wajar setelah pemberitahuan.',
        'Pihak Kedua berhak menyebut Properti pada katalog dan kanal pemasaran yang digunakannya.'
      ],
    },
    {
      title: 'Pasal 10 — Penitipan Kunci dan Akses Properti',
      paragraphs: [
        property.keyHandover
          ? 'Pihak Pertama menitipkan kunci/akses Properti kepada Pihak Kedua untuk keperluan survey dan pameran, dan Pihak Kedua bertanggung jawab menjaga keamanan Properti selama masa penitipan.'
          : 'Penitipan kunci/akses Properti TIDAK dilakukan. Setiap survey dilakukan dengan pengaturan jadwal bersama Pihak Pertama atau pihak yang dikuasakan.',
      ],
      items: [
        'Pihak Kedua wajib mendampingi setiap kunjungan Calon Pembeli/Penyewa ke Properti, kecuali disepakati lain secara tertulis.',
        'Kerusakan/kehilangan yang terjadi karena kelalaian Pihak Kedua selama masa penitipan menjadi tanggung jawab Pihak Kedua sesuai hukum yang berlaku.',
        'Pihak Pertama wajib memberi tahu Pihak Kedua apabila halaman/bangunan akan direnovasi atau ada perubahan kondisi yang mempengaruhi pemasaran.',
      ],
    },
    {
      title: 'Pasal 11 — Laporan, Pembukuan Calon Pembeli, dan Bukti Klaim Imbal Jasa',
      paragraphs: [
        'Untuk melindungi hak kedua pihak atas imbal jasa, Pihak Kedua wajib mencatat dan melaporkan identitas Calon Pembeli/Penyewa yang diperkenalkan beserta tanggal pengenalan (laporan prospek).',
        'Laporan prospek berupa catatan/daftar yang dapat disalin melalui aplikasi Homy Property, pesan WhatsApp, surel, atau dokumen tertulis, dan menjadi bukti yang sah antara kedua pihak.',
      ],
      items: [
        'Perkenalan dianggap sah apabila Pihak Kedua telah memberitahukan identitas Calon Pembeli/Penyewa kepada Pihak Pertama sebelum atau pada saat survey pertama.',
        'Pihak Kedua dilarang memalsukan atau menambahkan nama Calon Pembeli/Penyewa yang tidak nyata diperkenalkan.',
        'Apabila transaksi dengan Calon Pembeli/Penyewa yang telah dilaporkan terjadi setelah Perjanjian berakhir, hak imbal jasa tetap berlaku sepanjang terjadi dalam masa tenggang 90 (sembilan puluh) hari setelah berakhirnya Perjanjian.',
      ],
    },
    {
      title: 'Pasal 12 — Larangan dan Benturan Kepentingan',
      items: [
        'Pihak Kedua dilarang membeli Properti secara pribadi dengan menyembunyikan identitasnya (mengambil keuntungan atas informasi yang dipercayakan).',
        'Pihak Kedua dilarang menerima komisi ganda secara diam-diam dari pemilik dan pembeli/penyewa untuk satu Transaksi tanpa pengungkapan tertulis kepada kedua pihak.',
        'Kedua pihak dilarang melakukan pemalsuan dokumen, penipuan, pencucian uang, atau pendanaan kegiatan yang dilarang hukum.',
        'Apabila terjadi benturan kepentingan (mis. Pihak Kedua memiliki kepentingan pada Properti atau pihak pembeli), Pihak Kedua wajib mengungkapkannya kepada Pihak Pertama secara tertulis sebelum transaksi.',
      ],
    },
    {
      title: 'Pasal 13 — Kerahasiaan dan Perlindungan Data Pribadi',
      paragraphs: [
        'Kedua pihak menjaga kerahasiaan seluruh informasi yang diperoleh selama Perjanjian ini, termasuk harga, data kepemilikan, dan data pribadi masing-masing pihak serta Calon Pembeli/Penyewa, sesuai Undang-Undang Perlindungan Data Pribadi.',
        'Data pribadi yang dipertukarkan hanya digunakan untuk keperluan pelaksanaan Perjanjian ini dan tidak boleh dijual, dibagikan, atau digunakan untuk kepentingan lain tanpa persetujuan pemilik data.',
      ],
      items: [
        'Kewajiban kerahasiaan tetap berlaku setelah Perjanjian berakhir.',
        'Kebocoran data akibat kelalaian salah satu pihak wajib diberitahukan kepada pihak lain paling lambat 3x24 jam sejak diketahui.',
      ],
    },
    {
      title: 'Pasal 14 — Pengakhiran Perjanjian',
      items: [
        'Perjanjian berakhir dengan sendirinya pada akhir jangka waktu pada Pasal 4, kecuali diperpanjang secara tertulis oleh kedua pihak.',
        'Salah satu pihak dapat mengakhiri Perjanjian lebih awal dengan pemberitahuan tertulis paling lambat 14 hari kalender sebelumnya.',
        'Perjanjian dapat diakhiri seketika apabila terjadi pelanggaran material yang tidak diperbaiki dalam 7 hari kalender setelah ditegur, atau dengan alasan mendesak yang dibenarkan hukum.',
        'Pengakhiran tidak menghapus kewajiban yang telah timbul, termasuk hak imbal jasa atas Transaksi dari Calon Pembeli/Penyewa yang telah diperkenalkan sebelum pengakhiran, sesuai Pasal 11.',
      ],
    },
    {
      title: 'Pasal 15 — Keadaan Memaksa (Force Majeure)',
      paragraphs: [
        'Tidak ada pihak yang dianggap lalai apabila terjadi keadaan memaksa di luar kesalahannya, seperti bencana alam, kerusuhan, perang, wabah, atau kebijakan pemerintah yang menghambat pelaksanaan Perjanjian, dengan kewajiban memberitahukan dan berupaya meminimalkan dampaknya.',
      ],
    },
    {
      title: 'Pasal 16 — Penyelesaian Sengketa dan Hukum yang Berlaku',
      paragraphs: [
        'Perjanjian ini diatur dan ditafsirkan berdasarkan hukum Republik Indonesia.',
        'Setiap perselisihan diselesaikan lebih dahulu secara musyawarah dalam waktu 30 (tiga puluh) hari kalender sejak pemberitahuan perselisihan.',
        'Apabila musyawarah tidak mencapai kesepakatan, para pihak sepakat menyelesaikannya melalui pengadilan yang berwenang di wilayah hukum Properti atau tempat tinggal Pihak Pertama.',
      ],
    },
    {
      title: 'Pasal 17 — Lain-lain',
      items: [
        'Perjanjian ini merupakan satu-satunya kesepakatan tertulis antara kedua pihak mengenai objek ini dan menggantikan segala kesepakatan lisan sebelumnya.',
        'Perubahan atau penambahan ketentuan dilakukan melalui addendum tertulis yang ditandatangani kedua pihak dan menjadi bagian yang tidak terpisahkan dari Perjanjian ini.',
        'Apabila terdapat ketentuan yang dinyatakan tidak sah atau tidak dapat dilaksanakan, ketentuan lainnya tetap berlaku.',
        'Judul pasal hanya untuk memudahkan pembacaan dan tidak mempengaruhi penafsiran isi Perjanjian.',
        'Perjanjian ini dibuat dalam 2 (dua) rangkap, masing-masing rangkap bermaterai cukup dan memiliki kekuatan hukum yang sama, ditandatangani oleh kedua pihak dan para saksi.',
      ],
    },
    {
      title: 'Pasal 18 — Penutup',
      paragraphs: [
        'Demikian Perjanjian ini dibuat, dibaca, dipahami, dan disetujui oleh kedua pihak dengan penuh kesadaran dan tanpa paksaan, serta ditandatangani dalam keadaan sehat jasmani dan rohani.',
        'Dokumen ini merupakan perjanjian mandiri antara Pemilik Properti dan Agen Properti. Homy Property tidak menjadi pihak dalam Perjanjian ini. Apabila Transaksi terjadi melalui platform Homy Property, komisi platform (jika ada) diatur dalam Perjanjian Kerja Sama Mitra yang terpisah dan Pihak Kedua wajib memberitahukannya kepada Pihak Pertama sebelum Transaksi.',
      ],
    },
  ]
}

/** Cek kelengkapan minimal sebelum dokumen diunduh (dipakai untuk peringatan di UI). */
export function ownerAgreementMissing(data: OwnerAgreementData): string[] {
  const missing: string[] = []
  const text = (value?: string | null) => String(value ?? '').trim()
  if (text(data?.owner?.name).length < 3) missing.push('Nama Pemilik Properti')
  if (text(data?.owner?.identityNumber).replace(/\D/g, '').length < 6) missing.push('Nomor identitas Pemilik')
  if (text(data?.owner?.address).length < 5) missing.push('Alamat Pemilik')
  if (text(data?.agent?.name).length < 3) missing.push('Nama Agen')
  if (text(data?.agent?.identityNumber).replace(/\D/g, '').length < 6) missing.push('Nomor identitas Agen')
  if (text(data?.property?.address).length < 5) missing.push('Alamat Properti')
  if (text(data?.property?.city).length < 2) missing.push('Kota Properti')
  if (!text(data?.terms?.listingMode)) missing.push('Tujuan (jual/sewa)')
  if (!text(data?.terms?.feePercent)) missing.push('Persentase imbal jasa agen')
  if (!text(data?.terms?.durationMonths)) missing.push('Jangka waktu penugasan')
  return missing
}
