import { LegalPage, type LegalSection } from '@/components/legal-page'

export const metadata = { title: 'Kebijakan Privasi — Homy Property' }

const sections: LegalSection[] = [
  { heading: 'Data yang Kami Kumpulkan', paragraphs: ['Kami mengumpulkan data yang Anda berikan langsung saat mendaftar, memasang listing, mengirim pertanyaan, atau menghubungi tim Homy — seperti nama, alamat email, nomor telepon, domisili, dan nomor identitas untuk verifikasi mitra.', 'Kami juga mencatat data teknis terbatas: alamat IP, jenis perangkat, dan halaman yang Anda buka, untuk keamanan serta peningkatan layanan. Foto dan dokumen properti yang Anda unggah disimpan pada penyimpanan objek terenkripsi.'] },
  { heading: 'Bagaimana Data Digunakan', paragraphs: ['Data dipakai untuk menjalankan marketplace: menampilkan listing, menghubungkan pembeli/penyewa dengan agen atau pemilik, memverifikasi mitra, memproses komisi, dan mencegah penipuan.', 'Asisten AI Homy menjawab pertanyaan calon pembeli hanya berdasarkan data listing yang tersimpan di basis data kami. Kami tidak menggunakan data pribadi Anda untuk melatih model pihak ketiga.'] },
  { heading: 'Dasar Hukum & Persetujuan', paragraphs: ['Pemrosesan dilakukan atas dasar pelaksanaan perjanjian (Akun dan Perjanjian Kerja Sama Mitra), kewajiban hukum, serta kepentingan sah yang wajar. Untuk komunikasi pemasaran, kami meminta persetujuan terpisah yang dapat Anda tarik kapan saja.'] },
  { heading: 'Berbagi Data dengan Pihak Ketiga', paragraphs: ['Kami hanya membagikan data kepada pihak yang diperlukan untuk mengoperasikan layanan: penyedia basis data dan hosting, penyedia layanan email transaksional, serta penyedia otentikasi (misalnya login Google).', 'Kami tidak menjual data pribadi Anda. Data hanya diungkapkan kepada otoritas jika diwajibkan hukum yang berlaku.'] },
  { heading: 'Penyimpanan & Keamanan', paragraphs: ['Data disimpan selama akun aktif dan selama diperlukan untuk kewajiban hukum serta pembukuan komisi. Kami memakai kontrol akses berbasis peran, kunci layanan server-side, serta enkripsi saat transit.', 'Kendati demikian, tidak ada sistem yang sepenuhnya bebas risiko. Jika terjadi insiden keamanan yang berdampak pada data pribadi, kami akan memberitahukan Anda sesuai ketentuan yang berlaku.'] },
  { heading: 'Hak Anda', paragraphs: ['Anda berhak mengakses, memperbaiki, dan menghapus data pribadi Anda, membatasi atau menolak pemrosesan tertentu, serta meminta salinan data dalam format yang dapat dibaca.', 'Permintaan dapat diajukan ke support@homyproperty.id. Kami akan menindaklanjuti dalam waktu wajar sesuai peraturan perlindungan data pribadi yang berlaku di Indonesia.'] },
  { heading: 'Cookie & Teknologi Serupa', paragraphs: ['Kami memakai cookie esensial untuk menjaga sesi login dan preferensi bahasa. Cookie analitik hanya dipasang bila diperlukan untuk mengukur performa halaman dan dapat Anda tolak melalui pengaturan peramban.'] },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privasi"
      title="Kebijakan Privasi"
      intro="Kami menghargai kepercayaan Anda. Dokumen ini menjelaskan data apa yang kami kumpulkan, bagaimana data digunakan, dan hak yang Anda miliki sebagai pengguna Homy Property."
      updated="15 September 2026"
      sections={sections}
    />
  )
}
