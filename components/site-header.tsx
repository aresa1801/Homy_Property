'use client'

import Link from 'next/link'
import { BrandMark } from '@/components/brand-mark'
import { usePathname } from 'next/navigation'
import { AccountMenu } from '@/components/account-menu'
import { useSessionProfile } from '@/lib/homy-session'

const NAV = [
  { label: 'Jual', href: '/buy' },
  { label: 'Sewa', href: '/rent' },
  { label: 'Pesan', href: '/message' },
  { label: 'Partnership', href: '/partnership' },
]

/**
 * Headbar seragam untuk seluruh halaman publik: Jual - Sewa - Pesan - Partnership.
 * Bila pengunjung sudah login, sisi kanan menampilkan akun Google (foto + nama + email)
 * dan tombol Keluar — jadi status login tetap terlihat saat berpindah halaman.
 */
export function SiteHeader({ cta }: { cta?: { label: string; href: string } }) {
  const pathname = usePathname()
  const { profile, loading } = useSessionProfile()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="border-b border-[#e8dfd3] bg-[#0b3d2e] text-white">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <BrandMark tone="light" height={40} />
        <nav className="hidden items-center gap-8 text-sm md:flex" aria-label="Navigasi utama">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? 'page' : undefined} className={isActive(item.href) ? 'font-semibold text-[#c9a961]' : 'text-white/75 transition hover:text-white'}>{item.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {cta && <Link href={cta.href} className="hidden text-sm text-white/70 transition hover:text-white sm:block">{cta.label}</Link>}
          {loading ? (
            <span className="size-9 animate-pulse rounded-full bg-white/20" aria-hidden="true" />
          ) : profile ? (
            <AccountMenu />
          ) : (
            <Link href="/auth/login" className="rounded-full bg-[#c9a961] px-5 py-2 text-sm font-semibold text-[#0b3d2e] transition hover:bg-[#e1c67e]">Masuk</Link>
          )}
        </div>
      </div>
      <nav className="flex items-center gap-6 overflow-x-auto border-t border-white/10 px-5 py-3 text-sm md:hidden" aria-label="Navigasi utama (mobile)">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item.href) ? 'shrink-0 font-semibold text-[#c9a961]' : 'shrink-0 text-white/75'}>{item.label}</Link>
        ))}
      </nav>
    </header>
  )
}
