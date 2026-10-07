import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbLd, SITE_URL } from '@/lib/seo'
import { REGIONS_BY_PROVINCE, regionShortName, regionSlug, type ListingType } from '@/lib/location-seo'

export function LocationHub({ type }: { type: ListingType }) {
  const kw = type === 'sale' ? 'Dijual' : 'Disewa'
  const basePath = type === 'sale' ? '/jual' : '/sewa'
  const total = REGIONS_BY_PROVINCE.reduce((n, p) => n + p.regions.length, 0)
  const breadcrumb = breadcrumbLd([
    { name: 'Beranda', path: '/' },
    { name: kw, path: basePath },
  ])

  return (
    <>
      <JsonLd data={breadcrumb} />
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[#0b3d2e]/60">
          <ol className="flex items-center gap-1.5">
            <li><Link href="/" className="hover:text-[#0b3d2e]">Beranda</Link></li>
            <li aria-hidden>/</li>
            <li className="font-medium text-[#0b3d2e]">{kw}</li>
          </ol>
        </nav>
        <header className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-[#0b3d2e] sm:text-3xl">
            Properti {kw} di Seluruh Indonesia
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#0b3d2e]/75">
            Jelajahi properti {kw.toLowerCase()} berdasarkan kota dan kabupaten di {REGIONS_BY_PROVINCE.length} provinsi
            ({total} wilayah). Pilih wilayah untuk melihat listing, harga, dan spesifikasi terbaru dari pemilik
            maupun agen terverifikasi di Homy Property.
          </p>
        </header>

        <div className="mt-8 space-y-8">
          {REGIONS_BY_PROVINCE.map(({ province, regions }) => (
            <section key={province}>
              <h2 className="mb-3 text-base font-semibold text-[#0b3d2e]">{province}</h2>
              <div className="flex flex-wrap gap-2">
                {regions.map((r) => (
                  <Link
                    key={regionSlug(r)}
                    href={`${basePath}/${regionSlug(r)}`}
                    className="rounded-full border border-[#0b3d2e]/15 px-3.5 py-1.5 text-sm text-[#0b3d2e] transition hover:border-[#0b3d2e]/40 hover:bg-[#f6f8f6]"
                  >
                    {regionShortName(r)}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-10 text-xs text-[#0b3d2e]/50">
          Sumber data wilayah: BPS. Total {total} kabupaten/kota · {SITE_URL}
        </p>
      </main>
      <SiteFooter />
    </>
  )
}
