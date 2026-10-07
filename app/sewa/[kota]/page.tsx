import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LocationPage } from '@/components/location-page'
import { slugToRegion, regionShortName } from '@/lib/location-seo'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 3600

type Props = { params: Promise<{ kota: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kota } = await params
  const region = slugToRegion(kota)
  if (!region) return { title: 'Lokasi tidak ditemukan', robots: { index: false, follow: true } }
  const city = regionShortName(region)
  return pageMetadata({
    title: `Rumah Disewa di ${city} — Listing & Harga Sewa`,
    description: `Cari rumah, kontrakan, atau apartemen disewa di ${region.city}, ${region.province}. Bandingkan listing sewa terbaru beserta harga dan lokasinya di Homy Property.`,
    path: `/sewa/${kota}`,
    keywords: [`sewa rumah ${city}`, `kontrakan ${city}`, `rumah disewa ${city}`, `sewa apartemen ${city}`],
  })
}

export default async function Page({ params }: Props) {
  const { kota } = await params
  const region = slugToRegion(kota)
  if (!region) notFound()
  return <LocationPage region={region} type="rent" />
}
