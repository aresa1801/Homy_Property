import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbLd, fetchSeoListings, itemListLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Properti Disewakan di Indonesia',
  description:
    'Temukan rumah, apartemen, ruko, dan kamar kost yang disewakan di Indonesia. Bandingkan harga sewa, deposit, dan lokasi — lengkap dengan estimasi biaya di Homy Property.',
  path: '/rent',
  keywords: ['sewa rumah', 'sewa apartemen', 'kontrakan', 'kost', 'sewa ruko', 'properti disewakan'],
})

export default async function RentLayout({ children }: { children: React.ReactNode }) {
  const listings = await fetchSeoListings('rent', 50)
  const itemList = itemListLd({
    name: 'Properti disewakan di Homy Property',
    url: '/rent',
    items: listings.map((l) => ({
      name: l.title || 'Properti disewakan',
      url: `/property/${l.id}`,
    })),
  })

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Beranda', path: '/' }, { name: 'Sewa', path: '/rent' }])} />
      {listings.length ? <JsonLd data={itemList} /> : null}
      {children}
    </>
  )
}
