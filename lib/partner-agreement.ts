/**
 * Homy — Perjanjian Kerja Sama Mitra (Agen & Pemilik Properti).
 *
 * Template tunggal yang dipakai oleh:
 *  - wizard `/verify` (langkah perjanjian, versi baca di layar)
 *  - `app/api/verify/agreement/route.ts` (penandatanganan digital)
 *  - `lib/agreement-pdf.ts` (unduhan PDF)
 *  - dasbor mitra & admin (tinjauan & arsip)
 *
 * Setiap perubahan substansi WAJIB menaikkan AGREEMENT_VERSION agar salinan mitra
 * tetap dapat ditelusuri ke versi yang benar-benar ditandatangani.
 */

import type { VerificationRole } from '@/lib/verification'

export const AGREEMENT_VERSION = 'v2.0'
export const AGREEMENT_TITLE = 'Perjanjian Kerja Sama Kemitraan Properti'
export const COMMISSION_RATE = 0.5
export const COMPANY_NAME = 'Homy Property'
export const COMPANY_LEGAL = 'Homy Property Indonesia'
export const COMPANY_EMAIL = 'mitra@homyproperty.id'
export const COMPANY_SITE = 'homyproperty.id'
export const REVIEW_SLA_DAYS = 2

export type AgreementClause = {
  title: string
  paragraphs?: string[]
  items?: string[]
}

export const PARTNER_ROLE_LABEL: Record<VerificationRole, string> = {
  agent: 'Agen Properti',
  property_owner: 'Pemilik Properti',
}

export const COMMISSION_EXAMPLE = {
  salePrice: 1500000000,
  rate: COMMISSION_RATE,
  amount: 1500000000 * (COMMISSION_RATE / 100),
}

export function formatRupiah(value: number) {
  return 'Rp ' + Math.round(value).toLocaleString('id-ID')
}

/** Ringkasan singkat yang ditampilkan di panel tanda tangan. */
export const AGREEMENT_HIGHLIGHTS: string[] = [
  'Komisi Homy 0,5% dari harga jual final untuk setiap transaksi yang difasilitasi platform.',
  'Kewajiban melaporkan setiap transaksi maksimal 3 hari kerja setelah akad/booking.',
  'Hanya boleh memasarkan properti yang sah, akurat, dan tidak terikat sengketa.',
  'Data pribadi mitra diverifikasi admin (KYC) dan dilindungi sesuai UU PDP.',
  'Perjanjian berlaku sejak ditandatangani sampai diakhiri oleh salah satu pihak.',
]

export const AGREEMENT_CONSENTS = [
  { key: 'commission', label: `Saya menyetujui komisi Homy sebesar ${COMMISSION_RATE}% dari harga jual final setiap transaksi.` },
  { key: 'report', label: 'Saya bersedia melaporkan setiap transaksi kepada Homy maksimal 3 hari kerja setelah transaksi.' },
  { key: 'data', label: 'Saya menyatakan seluruh data, dokumen, dan listing yang saya berikan adalah benar dan milik saya yang sah.' },
  { key: 'terms', label: 'Saya telah membaca, memahami, dan menerima seluruh isi Perjanjian Kerja Sama ini.' },
] as const

export type AgreementConsentKey = (typeof AGREEMENT_CONSENTS)[number]['key']

/** Pasal yang berlaku untuk kedua peran (inti kerja sama). */
function commonClauses(role: VerificationRole): AgreementClause[] {
  const roleLabel = PARTNER_ROLE_LABEL[role]
  const isAgent = role === 'agent'

  return [
    {
      title: 'Pasal 1 — Definisi',
      items: [
        '“HOMY” adalah Homy Property, penyelenggara platform properti homyproperty.id beserta aplikasinya.',
        `“MITRA” adalah pihak perseorangan/badan yang terdaftar sebagai ${roleLabel} dan telah diverifikasi oleh HOMY.`,
        '“Listing” adalah data, deskripsi, foto, video, dan informasi properti yang tayang di platform HOMY.',
        '“Transaksi” adalah setiap kesepakatan jual-beli, sewa, atau bentuk pengalihan hak atas properti yang berasal dari, difasilitasi, atau ditutup melalui platform HOMY.',
        '“Harga Jual Final” adalah nilai transaksi yang tercantum pada akad/perjanjian pengikatan jual beli (PPJB), akad kredit, atau dokumen transaksi sah lainnya.',
        '“Anak Perusahaan/Afiliasi HOMY” adalah seluruh entitas yang dikendalikan atau berada dalam satu grup usaha dengan HOMY.',
      ],
    },
    {
      title: 'Pasal 2 — Para Pihak',
      paragraphs: [
        `PIHAK PERTAMA: HOMY (${COMPANY_LEGAL}), berkedudukan di Indonesia, selaku pengelola platform, website, dan aplikasi HOMY Property.`,
        `PIHAK KEDUA: MITRA, yaitu pengguna terdaftar yang telah melengkapi data verifikasi, menandatangani Perjanjian Kerja Sama ini, dan memperoleh persetujuan admin HOMY sebagai ${roleLabel}.`,
        'Kedua pihak sepakat untuk saling mengikatkan diri pada ketentuan Perjanjian Kerja Sama ini berdasarkan asas itikad baik, keterbukaan, dan kepatuhan pada hukum yang berlaku di Republik Indonesia.',
      ],
    },
    {
      title: 'Pasal 3 — Dasar, Tujuan, dan Sifat Perjanjian',
      paragraphs: [
        'Perjanjian ini merupakan perjanjian kerja sama kemitraan untuk pemasaran properti melalui platform HOMY.',
        'Perjanjian ini BUKAN perjanjian kerja, bukan hubungan keagenan eksklusif, dan tidak menciptakan hubungan kerja/jaminan sosial antara MITRA dengan HOMY. MITRA bertindak sebagai pihak yang mandiri, tidak menerima gaji, dan tidak terikat jam kerja tertentu selain ketersediaan yang disepakati pada Pasal 10.',
        'Tujuan perjanjian: mempermudah pemasaran properti, memperluas jangkauan pembeli/penyewa, serta menjaga standar layanan, transparansi transaksi, dan keamanan pengguna HOMY.',
      ],
    },
    {
      title: 'Pasal 4 — Ruang Lingkup Kerja Sama',
      items: isAgent
        ? [
            'Memasarkan dan mengelola listing properti yang sah (milik mitra, klien, atau developer yang menunjuk MITRA), termasuk penyusunan deskripsi, harga, dan media.',
            'Menghubungkan calon pembeli/penyewa dengan pemilik properti dan mendampingi proses survey di lokasi/online sesuai ketersediaan.',
            'Memberikan tanggapan atas pertanyaan, jadwal survey, dan negosiasi pengguna maksimal 1×24 jam sejak notifikasi diterima.',
            'Membantu proses administrasi sampai terciptanya akad dan melaporkan setiap transaksi kepada HOMY.',
            'Menjaga akurasi data listing, ketersediaan properti, dan memperbarui harga serta status terjual/sewa secara berkala.',
          ]
        : [
            'Memasang dan mengelola listing properti milik MITRA sendiri, termasuk data, harga, media, dan status ketersediaan.',
            'Menanggapi pertanyaan pengguna, mengonfirmasi jadwal survey, dan mengabulkan/menjadwalkan ulang kunjungan sesuai ketersediaan pada Pasal 10.',
            'Menyampaikan data legalitas properti (sertifikat, IMB/PBG, kondisi, dan informasi biaya) secara benar dan bertanggung jawab.',
            'Memperbarui status properti menjadi terjual/tersewa (dan menutup listing) paling lambat 3 hari kerja setelah transaksi terjadi, serta melaporkan transaksi tersebut kepada HOMY.',
          ],
    },
    {
      title: 'Pasal 5 — Hak MITRA',
      items: [
        'Mendapatkan akses dasbor mitra, kanal prospek/lead, serta alat bantu analisis yang disediakan HOMY.',
        'Mendapat eksposur pemasaran listing pada halaman katalog, pencarian, rekomendasi, dan kanal pemasaran HOMY lainnya.',
        'Menerima dukungan tim kemitraan HOMY dalam hal teknis, moderasi konten, dan tindak lanjut prospek.',
        'Mendapat prioritas promosi atau program insentif apabila memenuhi kriteria dan ketentuan yang berlaku.',
        'Memperoleh salinan digital Perjanjian Kerja Sama ini beserta status verifikasinya melalui dasbor mitra.',
      ],
    },
    {
      title: 'Pasal 6 — Kewajiban MITRA',
      items: [
        'Memberikan data pribadi, data usaha, dan dokumen identitas yang benar, terkini, dan dapat dipertanggungjawabkan (Pasal 8).',
        'Hanya memasang listing atas properti yang sah, tidak sedang dalam sengketa, dan berhak dipasarkan; MITRA menanggung segala akibat jika terjadi pelanggaran kepemilikan.',
        'Menjaga kerahasiaan dan tidak menyalahgunakan data pengguna HOMY untuk kepentingan di luar transaksi properti yang bersangkutan.',
        'Tidak memungut biaya apa pun dari pengguna tanpa persetujuan tertulis HOMY dan tidak menawarkan skema investasi atau imbal hasil.',
        'Memasarkan properti dengan harga, kondisi, dan biaya yang transparan, serta tidak melakukan manipulasi harga, “gimmick” menyesatkan, atau iklan palsu.',
        'Tidak memindahkan atau mengarahkan transaksi keluar dari platform HOMY dengan tujuan menghindari kewajiban komisi.',
        'Menginformasikan kepada HOMY apabila terjadi pembatalan, gagal akad, atau perubahan material atas transaksi yang telah dilaporkan.',
      ],
    },
    {
      title: 'Pasal 7 — Hak dan Kewajiban HOMY',
      items: [
        'HOMY berhak melakukan verifikasi identitas, dokumen, dan legalitas listing; menolak, menangguhkan, atau menurunkan listing yang tidak sesuai ketentuan.',
        'HOMY berhak mengubah fitur, tampilan, algoritma penayangan, dan kebijakan platform dengan pemberitahuan melalui aplikasi/email.',
        'HOMY wajib menyediakan platform yang berfungsi wajar, kanal komunikasi pengguna, dan mekanisme pelaporan penyalahgunaan.',
        'HOMY wajib menjaga kerahasiaan data pribadi MITRA sesuai Pasal 16 dan hanya menggunakannya untuk keperluan kerja sama ini.',
        'HOMY berhak menagih komisi, meminta bukti transaksi, dan melakukan audit terhadap laporan transaksi yang tidak wajar.',
      ],
    },
    {
      title: 'Pasal 8 — Verifikasi Data & Dokumen (KYC)',
      paragraphs: [
        'MITRA wajib mengisi data diri dan domisili secara lengkap serta mengunggah foto identitas (KTP/SIM), selfie dengan identitas, dan dokumen pendukung lain (NPWP, legalitas usaha, atau surat kuasa pemasaran properti).',
        'HOMY memverifikasi data tersebut dalam waktu maksimal 2 (dua) hari kerja sejak pengajuan dikirim, dan dapat meminta klarifikasi tambahan apabila diperlukan.',
        'Verifikasi dapat ditolak apabila dokumen tidak terbaca, tidak sesuai, terindikasi dipalsukan, atau data tidak konsisten. MITRA dapat memperbaiki dan mengirim ulang tanpa batas waktu tertentu.',
        'Hasil verifikasi bukan jaminan kualitas properti maupun kelayakan transaksi; MITRA dan pengguna tetap wajib melakukan pemeriksaan (due diligence) masing-masing.',
      ],
    },
    {
      title: 'Pasal 9 — Standar Listing & Konten',
      items: [
        'Wajib memuat minimal 3 foto asli dan relevan; dilarang menggunakan foto/informasi milik pihak lain tanpa izin.',
        'Dilarang memuat konten yang melanggar hukum, SARA, menyesatkan, bersifat pornografi, atau menyinggung pihak lain.',
        'Alamat dan titik lokasi (maps) harus sesuai dengan properti yang dipasarkan.',
        'HOMY berhak menyunting judul/deskripsi untuk keperluan konsistensi katalog tanpa mengubah fakta material properti.',
        'Setiap listing baru berstatus “pending” sampai disetujui admin; listing yang melanggar dapat ditolak atau diarsipkan.',
      ],
    },
    {
      title: 'Pasal 10 — Ketersediaan Waktu & Standar Layanan',
      paragraphs: [
        'MITRA mengatur jadwal ketersediaan (hari, jam, durasi slot, dan mode lokasi/online) melalui menu Ketersediaan pada dasbor mitra. Jadwal tersebut menjadi acuan penjadwalan survey oleh pengguna HOMY.',
      ],
      items: [
        'MITRA wajib mengonfirmasi atau mengajukan penjadwalan ulang atas permintaan survey maksimal 1×24 jam sejak permintaan diterima.',
        'Perubahan jadwal ketersediaan wajib diperbarui MITRA agar slot yang ditawarkan platform tetap akurat.',
        'Apabila MITRA tidak merespons 3 (tiga) permintaan survey berturut-turut dalam 7 hari, HOMY dapat membatasi penetapan MITRA sebagai pendamping survey.',
      ],
    },
    {
      title: 'Pasal 11 — Komisi HOMY 0,5%',
      paragraphs: [
        `MITRA setuju membayar komisi kepada HOMY sebesar ${COMMISSION_RATE}% (nol koma lima persen) dari Harga Jual Final untuk setiap Transaksi Penjualan properti yang berasal dari, difasilitasi, atau ditutup melalui platform HOMY, baik sebelum maupun setelah berakhirnya Perjanjian ini sepanjang transaksi tersebut berasal dari prospek platform HOMY.`,
        `Contoh perhitungan: harga jual final ${formatRupiah(COMMISSION_EXAMPLE.salePrice)} × ${COMMISSION_RATE}% = ${formatRupiah(COMMISSION_EXAMPLE.amount)}.`,
        'Untuk transaksi sewa, komisi dihitung 0,5% dari nilai kontrak sewa yang disepakati (maksimal dari sewa 1 tahun pertama), kecuali ditentukan lain secara tertulis oleh HOMY.',
        'Komisi tidak berlaku atas transaksi yang terbukti tidak memiliki keterkaitan dengan platform HOMY, dengan kewajiban MITRA membuktikan secara wajar.',
        'Apabila terjadi double komisi (agen dan pemilik properti sama-sama terlibat dalam satu transaksi), komisi dihitung satu kali sesuai perjanjian tertulis para pihak.',
      ],
    },
    {
      title: 'Pasal 12 — Kewajiban Pelaporan Transaksi',
      paragraphs: [
        'MITRA WAJIB melaporkan setiap transaksi (booking, tanda jadi/DP, akad, hingga pelunasan) melalui menu Pelaporan Transaksi pada dasbor mitra paling lambat 3 (tiga) hari kerja setelah transaksi terjadi.',
      ],
      items: [
        'Laporan wajib memuat: data properti, nama dan kontak pembeli/penyewa, harga transaksi, tanggal transaksi, dan bukti pendukung (kuitansi/PPJB/berita acara).',
        'HOMY akan memverifikasi laporan dan menyusun invoice komisi sesuai Pasal 13.',
        'Laporan yang terbukti tidak benar, disengaja, atau dibuat-buat dapat dikenai sanksi sesuai Pasal 19.',
      ],
    },
    {
      title: 'Pasal 13 — Pembayaran Komisi & Pajak',
      items: [
        'Pembayaran komisi dilakukan maksimal 7 (tujuh) hari kerja setelah pelunasan transaksi atau setelah invoice resmi HOMY diterbitkan.',
        'Pembayaran dilakukan melalui rekening resmi HOMY; MITRA tidak diperkenankan mentransfer ke rekening pribadi mana pun atas nama HOMY tanpa konfirmasi tertulis.',
        'Setiap pajak yang timbul atas penghasilan MITRA menjadi tanggungan MITRA sesuai peraturan perpajakan yang berlaku; pajak atas jasa platform menjadi tanggungan HOMY.',
        'Keterlambatan pembayaran komisi lebih dari 14 hari kalender dapat dikenai pembekuan akun sampai pelunasan.',
      ],
    },
    {
      title: 'Pasal 14 — Kode Etik, Anti Penipuan, dan Anti Pencucian Uang',
      items: [
        'MITRA dilarang menerima pembayaran tunai di luar ketentuan resmi, meminta “uang tanda jadi” tanpa bukti sah, atau menyimpan dana milik pembeli/penyewa.',
        'MITRA dilarang melakukan penipuan, pemalsuan dokumen, pencucian uang, pendanaan terorisme, atau transaksi yang sumber dananya tidak jelas.',
        'HOMY dapat melakukan penapisan (screening) sederhana dan menolak/menghentikan kerja sama apabila ditemukan indikasi pelanggaran; data dapat diserahkan kepada pihak berwenang bila diwajibkan hukum.',
      ],
    },
    {
      title: 'Pasal 15 — Larangan Double Listing & Benturan Kepentingan',
      items: [
        'MITRA dilarang memasang properti yang sama pada beberapa akun mitra atau akun ganda tanpa keterangan yang jelas.',
        'MITRA wajib menandatangani surat kuasa pemasaran dari pemilik properti apabila memasarkan properti pihak lain, dan menyimpannya sebagai dokumen pendukung.',
        'MITRA wajib mengungkapkan kepada calon pembeli/penyewa apabila memiliki kepentingan pribadi (benturan kepentingan) atas properti yang dipasarkan.',
      ],
    },
    {
      title: 'Pasal 16 — Perlindungan Data Pribadi & Kerahasiaan',
      paragraphs: [
        'HOMY memproses data pribadi MITRA terbatas untuk keperluan verifikasi kemitraan, operasional platform, penagihan komisi, dan pemenuhan kewajiban hukum, sesuai Undang-Undang Perlindungan Data Pribadi.',
        'HOMY tidak memperjualbelikan data pribadi MITRA kepada pihak ketiga untuk tujuan pemasaran pihak ketiga.',
        'Kedua pihak menjaga kerahasiaan informasi komersial, data prospek, dan data pengguna yang diperoleh selama kerja sama, termasuk setelah Perjanjian ini berakhir.',
        'Kebocoran data yang disebabkan kelalaian salah satu pihak wajib diberitahukan kepada pihak lain maksimal 3×24 jam sejak diketahui.',
      ],
    },
    {
      title: 'Pasal 17 — Kekayaan Intelektual & Penggunaan Merek',
      items: [
        'Merek, logo, nama, dan materi pemasaran HOMY hanya boleh digunakan untuk kepentingan kerja sama ini sesuai panduan HOMY dan tidak untuk kepentingan pribadi/pihak lain.',
        'MITRA menjamin pemasangan foto, video, desain, atau materi pihak ketiga sudah memperoleh izin yang sah dan melepaskan HOMY dari tuntutan pihak ketiga atas hal tersebut.',
        'Materi pemasaran yang dibuat HOMY (katalog, brosur, konten kanal sosial) dapat digunakan HOMY untuk promosi platform.',
      ],
    },
    {
      title: 'Pasal 18 — Batasan Tanggung Jawab & Force Majeure',
      paragraphs: [
        'HOMY menyediakan platform “sebagaimana adanya” dan tidak menjamin terjadinya transaksi, hasil penjualan tertentu, maupun jumlah prospek tertentu.',
        'HOMY tidak bertanggung jawab atas kerugian yang timbul dari sengketa harga, kepemilikan, legalitas properti, maupun wanprestasi antara MITRA dengan pengguna/klien.',
        'Tidak ada pihak yang dianggap lalai apabila terjadi keadaan memaksa (force majeure) seperti bencana alam, perang, kerusuhan, gangguan besar jaringan internet/telekomunikasi, atau kebijakan pemerintah yang menghambat pelaksanaan Perjanjian.',
      ],
    },
    {
      title: 'Pasal 19 — Sanksi dan Pemutusan Kerja Sama',
      items: [
        'Pelanggaran ringan: teguran tertulis dan/atau penurunan prioritas penayangan listing.',
        'Pelanggaran sedang: pembekuan sementara akun mitra sampai perbaikan dilakukan.',
        'Pelanggaran berat (penipuan, pemalsuan dokumen, penghindaran komisi, double listing yang merugikan, pelanggaran data pribadi): pemutusan kerja sama serta penagihan komisi yang terutang.',
        'HOMY dapat memutus Perjanjian ini secara sepihak dengan pemberitahuan tertulis 7 hari sebelumnya apabila MITRA tidak lagi memenuhi syarat kemitraan.',
        'Kewajiban pembayaran komisi atas transaksi yang telah terjadi sebelum pemutusan tetap berlaku.',
      ],
    },
    {
      title: 'Pasal 20 — Jangka Waktu, Perubahan, dan Addendum',
      paragraphs: [
        'Perjanjian ini berlaku efektif sejak ditandatangani secara digital oleh MITRA dan tetap berlaku sampai diakhiri sesuai Pasal 19 atau oleh permintaan salah satu pihak.',
        'MITRA dapat mengakhiri Perjanjian ini dengan memberitahukan kepada HOMY secara tertulis; listing MITRA akan ditarik dari katalog setelah kewajiban komisi yang terutang diselesaikan.',
        `HOMY dapat memperbarui versi Perjanjian (versi saat ini: ${AGREEMENT_VERSION}). Perubahan material akan diberitahukan melalui aplikasi/email, dan MITRA wajib menyetujui versi terbaru untuk memperbarui kemitraan.`,
      ],
    },
    {
      title: 'Pasal 21 — Penyelesaian Sengketa & Hukum yang Berlaku',
      paragraphs: [
        'Perjanjian ini diatur dan ditafsirkan berdasarkan hukum Republik Indonesia.',
        'Setiap sengketa diupayakan penyelesaiannya secara musyawarah dalam waktu 30 hari kalender sejak pemberitahuan sengketa.',
        'Apabila musyawarah tidak mencapai kesepakatan, para pihak sepakat menyelesaikannya melalui pengadilan yang berwenang di Indonesia, tanpa mengurangi hak HOMY untuk melakukan upaya penagihan komisi.',
      ],
    },
    {
      title: 'Pasal 22 — Lain-lain',
      items: [
        'Perjanjian ini beserta lampiran-lampirannya merupakan keseluruhan kesepakatan dan menggantikan kesepakatan lisan sebelumnya.',
        'Apabila terdapat ketentuan yang tidak sah/batal, ketentuan lain tetap berlaku.',
        'Judul pasal hanya untuk memudahkan pembacaan dan tidak mempengaruhi penafsiran.',
        'Perjanjian ini ditandatangani secara elektronik dan sah sebagai alat bukti menurut hukum yang berlaku, termasuk ketentuan mengenai tanda tangan elektronik.',
      ],
    },
    {
      title: 'Pasal 23 — Penutup',
      paragraphs: [
        'Demikian Perjanjian Kerja Sama ini dibuat, dibaca, dan dipahami oleh MITRA, lalu disetujui serta ditandatangani secara digital melalui platform HOMY.',
        'Dengan menekan tombol “Tanda tangan & kirim pengajuan”, MITRA menyatakan telah membaca dan menyetujui seluruh isi Perjanjian Kerja Sama ini beserta lampiran data mitra yang dilampirkan.',
      ],
    },
  ]
}

export function buildAgreementClauses(role: VerificationRole): AgreementClause[] {
  return commonClauses(role)
}

export const AGREEMENT_LAMPIRAN = [
  'Lampiran A — Data Mitra (nama, identitas, kontak, domisili, data usaha) diambil otomatis dari form verifikasi.',
  'Lampiran B — Ketersediaan waktu layanan mitra (hari, jam, mode lokasi/online).',
  'Lampiran C — Ringkasan komisi 0,5% dan contoh perhitungan.',
] as const

/** Nomor perjanjian yang deterministik & mudah dirujuk admin. */
export function agreementNumber(role: VerificationRole, userId: string, signedAt: string) {
  const year = new Date(signedAt).getFullYear() || new Date().getFullYear()
  const digits = String(userId ?? '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || '000000'
  const code = role === 'agent' ? 'AGN' : 'OWN'
  return `HOMY/${code}/${year}/${digits}`
}
