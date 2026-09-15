import Link from 'next/link'

/**
 * Logo resmi Homy Property: mark (aset brand) + wordmark "Homy." dengan titik emas.
 * Dipakai seragam di headbar publik, footer, sidebar dashboard, dan halaman auth.
 */
export function BrandMark({ size = 40, href = '/', className = '', textClassName = 'text-2xl' }: { size?: number; href?: string; className?: string; textClassName?: string }) {
  const src = size > 32 ? '/icon-192.png' : '/icon-light-32x32.png'
  const radius = size > 32 ? 'rounded-xl' : 'rounded-lg'
  return (
    <Link href={href} className={'flex items-center gap-3 ' + className} aria-label="Homy Property">
      <img src={src} alt="Logo Homy Property" width={size} height={size} className={radius} style={{ width: size, height: size }} />
      <span className={'font-serif font-bold ' + textClassName}>Homy<span className="text-[#c9a961]">.</span></span>
    </Link>
  )
}
