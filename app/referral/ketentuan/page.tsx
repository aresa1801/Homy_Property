import type { Metadata } from 'next'
import { LegalPage, type LegalSection } from '@/components/legal-page'
import { referralTerms } from '@/lib/referral'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Ketentuan Program Bonus Referral',
  description:
    'Ketentuan program bonus referral Homy Property: bonus 0,1% dari nilai transaksi untuk Agen yang mengajak Agen lain, maksimal Rp 2 juta per transaksi, dibayarkan setelah transaksi diverifikasi.',
  path: '/referral/ketentuan',
})

const terms = referralTerms()

const sections: LegalSection[] = [
  {
    heading: 'Ringkasan Program',
    paragraphs: [
      'Program Bonus Referral Homy adalah insentif untuk Agen terverifikasi yang mengajak Agen lain bergabung ke Homy Property (agent to agent). Bonus dihitung dari nilai transaksi agen yang direferensikan dan baru dibayarkan setelah transaksi tersebut diverifikasi oleh Homy.',
      'Tarif bonus saat ini 0,10% dari nilai transaksi dengan batas maksimal Rp 2.000.000 per transaksi, dan masa tahan 30 hari setelah verifikasi transaksi.',
    ],
  },
  { heading: 'Peserta & Kode Referral', paragraphs: [terms.points[0], 'Kode referral bersifat pribadi, tidak untuk diperjualbelikan, dan dapat dinonaktifkan bila terbukti disalahgunakan.'] },
  { heading: 'Perhitungan Bonus', paragraphs: [terms.points[1]] },
  { heading: 'Pemicu Pembayaran & Masa Tahan', paragraphs: [terms.points[2], terms.points[3]] },
  { heading: 'Pembayaran', paragraphs: [terms.points[4]] },
  { heading: 'Satu Level (Tidak Berjenjang)', paragraphs: [terms.points[5]] },
  { heading: 'Anti-Fraud & Verifikasi', paragraphs: [terms.points[6], 'Atribusi hanya sah bila calon agen membuka tautan resmi /r/<kode> sehingga kode tersimpan pada perangkat (cookie 30 hari). Homy berhak menolak atau membatalkan bonus yang berasal dari pola tidak wajar.'] },
  { heading: 'Perubahan Ketentuan', paragraphs: [terms.points[7]] },
]

export default function ReferralTermsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Beranda', path: '/' },
          { name: 'Program Referral', path: '/referral/ketentuan' },
        ])}
      />
      <LegalPage
        eyebrow="Program Mitra"
        title="Ketentuan Program Bonus Referral"
        intro="Bonus 0,1% dari nilai transaksi untuk Agen yang mengajak Agen lain (agent to agent), maksimal Rp 2 juta per transaksi, dibayarkan setelah transaksi diverifikasi Homy dengan masa tahan 30 hari."
        updated="27 September 2026"
        sections={sections}
      />
    </>
  )
}
