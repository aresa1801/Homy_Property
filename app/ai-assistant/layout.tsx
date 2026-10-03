import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Asisten Properti AI',
  description:
    'Bicara dengan asisten AI Homy Property: temukan properti sesuai kebutuhan, hitung estimasi KPR, dan dapatkan rekomendasi lokasi secara personal dan transparan.',
  path: '/ai-assistant',
  keywords: ['asisten properti AI', 'AI pencari rumah', 'rekomendasi properti AI', 'kalkulator KPR'],
})

export default function AiAssistantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Beranda', path: '/' },
          { name: 'Asisten AI', path: '/ai-assistant' },
        ])}
      />
      {children}
    </>
  )
}
