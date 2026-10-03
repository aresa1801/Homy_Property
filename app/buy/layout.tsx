import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbLd, fetchSeoListings, itemListLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Properti Dijual di Indonesia',
  description:
    'Jelajahi ribuan rumah, apartemen, ruko, dan tanah dijual di Indonesia. Filter lokasi, tipe properti, dan anggaran — dilengkapi rekomendasi AI di Homy Property.',
  path: '/buy',
  keywords: ['rumah dijual', 'apartemen dijual', 'tanah dijual', 'ruko dijual', 'properti dijual Indonesia'],
})

export default async function BuyLayout({ children }: { children: React.ReactNode }) {
  const listings = await fetchSeoListings('sale', 50)
  const itemList = itemListLd({
    name: 'Properti dijual di Homy Property',
    url: '/buy',
    items: listings.map((l) => ({
      name: l.title || 'Properti dijual',
      url: `/property/${l.id}`,
    })),
  })

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Beranda', path: '/' }, { name: 'Beli', path: '/buy' }])} />
      {listings.length ? <JsonLd data={itemList} /> : null}
      {children}
    </>
  )
}
