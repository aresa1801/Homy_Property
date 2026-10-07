import type { Metadata } from 'next'
import { LocationHub } from '@/components/location-hub'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: 'Properti Dijual di Seluruh Indonesia — Cari per Kota',
  description:
    'Jelajahi properti dijual berdasarkan kota/kabupaten di seluruh Indonesia. Rumah, apartemen, tanah, ruko, dan vila dengan harga & spesifikasi terbaru di Homy Property.',
  path: '/jual',
  keywords: ['properti dijual', 'rumah dijual', 'jual properti indonesia', 'cari rumah dijual'],
})

export default function Page() {
  return <LocationHub type="sale" />
}
