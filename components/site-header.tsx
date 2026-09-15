'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home } from 'lucide-react'

const NAV = [
  { label: 'Jual', href: '/buy' },
  { label: 'Sewa', href: '/rent' },
  { label: 'Pesan', href: '/message' },
  { label: 'Partnership', href: '/partnership' },
]

/** Headbar seragam untuk seluruh halaman publik: Jual - Sewa - Pesan - Partnership. */
export function SiteHeader({ cta }: { cta?: { label: string; href: string } }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="border-b border-[#e8dfd3] bg-[#0b3d2e] text-white">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Homy Property">
          <span className="grid size-10 place-items-center rounded-xl bg-[#c9a961] text-[#0b3d2e]"><Home /></span>
          <span className="font-serif text-2xl font-bold">Homy<span className="text-[#c9a961]">.</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm md:flex" aria-label="Navigasi utama">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? 'page' : undefined} className={isActive(item.href) ? 'font-semibold text-[#c9a961]' : 'text-white/75 transition hover:text-white'}>{item.label}</Link>
          ))}
        </nav>
        {cta ? (
          <Link href={cta.href} className="text-sm text-white/70 transition hover:text-white">{cta.label}</Link>
        ) : (
          <Link href="/auth/login" className="rounded-full bg-[#c9a961] px-5 py-2 text-sm font-semibold text-[#0b3d2e] transition hover:bg-[#e1c67e]">Masuk</Link>
        )}
      </div>
      <nav className="flex items-center gap-6 overflow-x-auto border-t border-white/10 px-5 py-3 text-sm md:hidden" aria-label="Navigasi utama (mobile)">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item.href) ? 'shrink-0 font-semibold text-[#c9a961]' : 'shrink-0 text-white/75'}>{item.label}</Link>
        ))}
      </nav>
    </header>
  )
}
