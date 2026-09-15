import Link from 'next/link'
import { Home, Mail } from 'lucide-react'

const LINKS = [
  { label: 'Jual', href: '/buy' },
  { label: 'Sewa', href: '/rent' },
  { label: 'Pesan', href: '/message' },
  { label: 'Partnership', href: '/partnership' },
  { label: 'Privasi', href: '/privacy' },
  { label: 'Ketentuan', href: '/terms' },
  { label: 'Kontak', href: '/contact' },
]

/** Footer seragam: navigasi utama + tautan privasi/ketentuan/kontak + email dukungan. */
export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-[#071f18] py-10 text-white/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 text-sm lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-2 text-white">
            <span className="grid size-8 place-items-center rounded-lg bg-[#c9a961] text-[#0b3d2e]"><Home /></span>
            <span className="font-serif text-xl">Homy<span className="text-[#c9a961]">.</span></span>
          </Link>
          <p>© {year} Homy Property. Rumah, dengan cara yang lebih baik.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-6">
          {LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-white">{item.label}</Link>
          ))}
        </div>
        <a href="mailto:support@homyproperty.id" className="inline-flex items-center gap-2 text-[#c9a961] transition hover:text-[#e1c67e]">
          <Mail className="size-4" /> support@homyproperty.id
        </a>
      </div>
    </footer>
  )
}
