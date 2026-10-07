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
    title: `Rumah Dijual di ${city} — Listing & Harga Terbaru`,
    description: `Cari rumah dijual di ${region.city}, ${region.province}. Lihat listing terbaru lengkap dengan foto, harga, dan spesifikasi dari pemilik maupun agen terverifikasi di Homy Property.`,
    path: `/jual/${kota}`,
    keywords: [`rumah dijual di ${city}`, `properti dijual ${city}`, `jual rumah ${city}`, `harga rumah ${city}`],
  })
}

export default async function Page({ params }: Props) {
  const { kota } = await params
  const region = slugToRegion(kota)
  if (!region) notFound()
  return <LocationPage region={region} type="sale" />
}
