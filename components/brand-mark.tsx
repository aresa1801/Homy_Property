import Link from 'next/link'

/**
 * Logo resmi Homy Property (lockup horizontal: mark + wordmark "Homy Property").
 * tone="light"  -> teks krem, untuk latar gelap (headbar, sidebar dashboard, panel hijau).
 * tone="dark"   -> teks hijau, untuk latar terang (halaman auth, onboarding, perjanjian, form).
 */
export function BrandMark({ height = 40, href = '/', className = '', tone = 'dark' }: { height?: number; href?: string; className?: string; tone?: 'dark' | 'light' }) {
  const src = tone === 'light' ? '/logo-homy-light.png' : '/logo-homy.png'
  return (
    <Link href={href} className={'inline-flex items-center ' + className} aria-label="Homy Property">
      <img src={src} alt="Homy Property" height={height} style={{ height, width: 'auto' }} className="block" />
    </Link>
  )
}
