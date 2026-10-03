import type { Metadata } from 'next'
import { LegalPage, type LegalSection } from '@/components/legal-page'
import { BcaPaymentCard } from '@/components/bca-payment-card'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Syarat & Ketentuan',
  description:
    'Syarat & ketentuan Homy Property: peran akun, kewajiban mitra dan agen, skema komisi, rekening resmi pembayaran, moderasi listing, dan larangan penggunaan.',
  path: '/terms',
})

const sections: LegalSection[] = [
  { heading: 'Penerimaan Ketentuan', paragraphs: ['Dengan membuat akun, memasang listing, atau menggunakan layanan Homy Property, Anda menyetujui Syarat & Ketentuan ini beserta Kebijakan Privasi kami. Jika Anda tidak setuju, mohon tidak menggunakan layanan.'] },
  { heading: 'Akun & Peran Pengguna', paragraphs: ['Satu akun dapat memiliki beberapa peran sekaligus: pengguna (pencari properti) dan agen. Setiap peran wajib menggunakan data yang benar dan dapat diverifikasi.', 'Anda bertanggung jawab menjaga kerahasiaan kredensial akun dan atas semua aktivitas yang terjadi melalui akun Anda.'] },
  { heading: 'Kewajiban Mitra (Agen)', paragraphs: ['Untuk memasang properti, mitra wajib: (1) mengisi formulir pendaftaran mitra, (2) menandatangani Surat Perjanjian Kerja Sama, (3) menyetujui komisi penjualan sebesar 0,5% dari total nilai transaksi, dan (4) melaporkan setiap transaksi kepada Homy Property maksimal 3 hari kerja setelah kesepakatan.'] },
  { heading: 'Komisi & Pembayaran', paragraphs: ['Komisi dihitung dari harga transaksi final yang dilaporkan dan terverifikasi. Laporan transaksi yang tidak benar, tidak lengkap, atau disengaja untuk menghindari komisi dapat menyebabkan penangguhan akun serta penagihan sesuai perjanjian.', 'Pembayaran komisi dilakukan melalui rekening resmi Homy Property: Bank Central Asia (BCA) nomor 5211082705 atas nama Anastasia Evi Rahma Dewi. Komisi ditagihkan ketika properti berhasil terjual atau tersewa melalui platform. Homy tidak pernah meminta pembayaran ke rekening pribadi lain atas nama Homy.'] },
  { heading: 'Konten Listing & Moderasi', paragraphs: ['Semua listing melewati moderasi sebelum tayang. Kami dapat menolak, menyembunyikan, atau menghapus listing yang melanggar hukum, menyesatkan, mengandung diskriminasi, atau menggunakan foto/data milik pihak lain tanpa izin.', 'Mitra bertanggung jawab memastikan keabsahan kepemilikan atau kuasa pemasaran atas properti yang dipasang.'] },
  { heading: 'Larangan Penggunaan', paragraphs: ['Dilarang menggunakan Homy untuk pencucian uang, penipuan, menyebarkan malware, mengambil data secara otomatis tanpa izin, atau mengalihkan transaksi ke luar platform untuk menghindari kewajiban perjanjian mitra.'] },
  { heading: 'Layanan AI', paragraphs: ['Asisten AI Homy bersifat informatif dan hanya menjawab berdasarkan data listing yang tersimpan. Hasil AI bukan nasihat keuangan, hukum, atau penilaian profesional. Keputusan transaksi sepenuhnya tanggung jawab pengguna.'] },
  { heading: 'Batasan Tanggung Jawab & Perubahan', paragraphs: ['Homy Property menyediakan platform penghubung dan tidak menjadi pihak dalam transaksi jual-beli atau sewa antara pengguna. Kami tidak menjamin ketersediaan, keakuratan, atau kelayakan properti yang dipasang mitra.', 'Ketentuan ini dapat diperbarui sewaktu-waktu. Perubahan material akan diberitahukan melalui email atau notifikasi di platform.'] },
]

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Beranda', path: '/' },
          { name: 'Syarat & Ketentuan', path: '/terms' },
        ])}
      />
      <LegalPage
        eyebrow="Ketentuan"
        title="Syarat & Ketentuan"
        intro="Aturan yang mengatur penggunaan platform Homy Property, termasuk peran akun, kewajiban mitra, komisi, dan kebijakan moderasi listing."
        updated="15 September 2026"
        sections={sections}
        aside={<BcaPaymentCard subtitle="Rekening resmi untuk penagihan komisi properti yang terjual atau tersewa" />}
      />
    </>
  )
}
