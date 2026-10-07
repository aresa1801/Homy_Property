import type { Metadata } from 'next'
import { LocationHub } from '@/components/location-hub'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: 'Properti Disewa di Seluruh Indonesia — Cari per Kota',
  description:
    'Jelajahi properti disewa berdasarkan kota/kabupaten di seluruh Indonesia. Rumah, kontrakan, apartemen, dan ruko beserta harga sewa terbaru di Homy Property.',
  path: '/sewa',
  keywords: ['properti disewa', 'sewa rumah', 'kontrakan', 'sewa apartemen indonesia'],
})

export default function Page() {
  return <LocationHub type="rent" />
}
