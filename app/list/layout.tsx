import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Pasang Iklan Properti Gratis',
  description:
    'Pasang properti Anda — rumah, apartemen, ruko, atau tanah — untuk dijual maupun disewakan di Homy Property. Gratis, terverifikasi moderator, dan terhubung ke prospek berkualitas.',
  path: '/list',
  keywords: ['pasang iklan properti', 'jual properti online', 'listing properti gratis', 'iklan rumah'],
})

export default function ListLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Beranda', path: '/' },
          { name: 'Pasang Properti', path: '/list' },
        ])}
      />
      {children}
    </>
  )
}
