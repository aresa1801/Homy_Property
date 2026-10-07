import Link from 'next/link'
import { BedDouble, Bath, MapPin, Ruler, Building2 } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbLd, itemListLd, faqLd, SITE_URL } from '@/lib/seo'
import { PROPERTY_TYPE_LABEL } from '@/lib/property-format'
import {
  buildFaq,
  buildIntro,
  fetchPublishedLocationListings,
  formatIDR,
  listingsForRegion,
  priceStats,
  regionSlug,
  regionShortName,
  relatedRegions,
  type ListingType,
  type LocationListing,
  type Region,
} from '@/lib/location-seo'

function Card({ l, city }: { l: LocationListing; city: string }) {
  const typeLabel = l.property_type ? PROPERTY_TYPE_LABEL[l.property_type] ?? 'Properti' : 'Properti'
  const meta: string[] = []
  if (l.bedrooms) meta.push(`${l.bedrooms} KT`)
  if (l.bathrooms) meta.push(`${l.bathrooms} KM`)
  const area = l.building_area ?? l.land_area
  return (
    <Link
      href={`/property/${l.id}`}
      className="group overflow-hidden rounded-2xl border border-[#0b3d2e]/10 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#eef2ef]">
        {l.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.image}
            alt={l.title ?? `${typeLabel} ${city}`}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[#0b3d2e]/30">
            <Building2 className="size-10" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-[#0b3d2e] px-2.5 py-1 text-[11px] font-semibold text-white">
          {typeLabel}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold text-[#0b3d2e]">{l.title ?? `${typeLabel} di ${city}`}</h3>
        <p className="text-lg font-bold text-[#0b3d2e]">
          {l.price ? formatIDR(l.price) : 'Hubungi penjual'}
          {l.price && l.price_period === 'monthly' ? <span className="text-xs font-normal text-[#0b3d2e]/60"> /bulan</span> : null}
          {l.price && l.price_period === 'yearly' ? <span className="text-xs font-normal text-[#0b3d2e]/60"> /tahun</span> : null}
        </p>
        <div className="flex items-center gap-1.5 text-sm text-[#0b3d2e]/70">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{[l.district, l.city].filter(Boolean).join(', ')}</span>
        </div>
        {meta.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#0b3d2e]/60">
            {l.bedrooms ? (
              <span className="inline-flex items-center gap-1"><BedDouble className="size-3.5" />{l.bedrooms}</span>
            ) : null}
            {l.bathrooms ? (
              <span className="inline-flex items-center gap-1"><Bath className="size-3.5" />{l.bathrooms}</span>
            ) : null}
            {area ? (
              <span className="inline-flex items-center gap-1"><Ruler className="size-3.5" />{area} m²</span>
            ) : null}
          </div>
        )}
      </div>
    </Link>
  )
}

export async function LocationPage({ region, type }: { region: Region; type: ListingType }) {
  const all = await fetchPublishedLocationListings()
  const listings = listingsForRegion(all, region, type)
  const intro = buildIntro(region, type, listings)
  const faqs = buildFaq(region, type, listings)
  const related = relatedRegions(region)
  const stats = priceStats(listings)
  const city = regionShortName(region)
  const kw = type === 'sale' ? 'Dijual' : 'Disewa'
  const basePath = type === 'sale' ? '/jual' : '/sewa'
  const url = `${SITE_URL}${basePath}/${regionSlug(region)}`

  const itemList = itemListLd({
    name: `Properti ${kw.toLowerCase()} di ${city}`,
    url,
    items: listings.map((l) => ({
      name: l.title ?? `Properti di ${city}`,
      url: `/property/${l.id}`,
      image: l.image ?? undefined,
    })),
  })
  const breadcrumb = breadcrumbLd([
    { name: 'Beranda', path: '/' },
    { name: kw, path: basePath },
    { name: city, path: `${basePath}/${regionSlug(region)}` },
  ])

  return (
    <>
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqLd(faqs)} />
      {listings.length > 0 ? <JsonLd data={itemList} /> : null}
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[#0b3d2e]/60">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-[#0b3d2e]">Beranda</Link></li>
            <li aria-hidden>/</li>
            <li><Link href={basePath} className="hover:text-[#0b3d2e]">{kw}</Link></li>
            <li aria-hidden>/</li>
            <li className="font-medium text-[#0b3d2e]">{city}</li>
          </ol>
        </nav>

        <header className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-[#0b3d2e] sm:text-3xl">
            Rumah {kw} di {region.city}
          </h1>
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#0b3d2e]/75">
            {intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {stats ? (
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#0b3d2e]/10 bg-[#f6f8f6] p-3">
                <dt className="text-xs text-[#0b3d2e]/60">Listing</dt>
                <dd className="text-lg font-bold text-[#0b3d2e]">{listings.length}</dd>
              </div>
              <div className="rounded-xl border border-[#0b3d2e]/10 bg-[#f6f8f6] p-3">
                <dt className="text-xs text-[#0b3d2e]/60">Harga terendah</dt>
                <dd className="text-lg font-bold text-[#0b3d2e]">{formatIDR(stats.min)}</dd>
              </div>
              <div className="rounded-xl border border-[#0b3d2e]/10 bg-[#f6f8f6] p-3">
                <dt className="text-xs text-[#0b3d2e]/60">Harga median</dt>
                <dd className="text-lg font-bold text-[#0b3d2e]">{formatIDR(stats.median)}</dd>
              </div>
              <div className="rounded-xl border border-[#0b3d2e]/10 bg-[#f6f8f6] p-3">
                <dt className="text-xs text-[#0b3d2e]/60">Harga tertinggi</dt>
                <dd className="text-lg font-bold text-[#0b3d2e]">{formatIDR(stats.max)}</dd>
              </div>
            </dl>
          ) : null}
        </header>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-[#0b3d2e]">
            {listings.length > 0 ? `Listing ${kw} di ${city}` : `Belum ada listing di ${city}`}
          </h2>
          {listings.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <Card key={l.id} l={l} city={city} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#0b3d2e]/20 bg-[#f6f8f6] p-6 text-[#0b3d2e]/75">
              <p>
                Jadilah yang pertama memasarkan properti {kw.toLowerCase()} di {city}. Pasang iklan gratis,
                jangkau calon {type === 'sale' ? 'pembeli' : 'penyewa'} dari seluruh Indonesia.
              </p>
              <Link
                href="/list"
                className="mt-4 inline-flex rounded-full bg-[#0b3d2e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0e4d3a]"
              >
                Pasang Iklan Sekarang
              </Link>
            </div>
          )}
        </section>

        <section className="mt-10 max-w-3xl">
          <h2 className="mb-3 text-lg font-semibold text-[#0b3d2e]">Pertanyaan umum — {city}</h2>
          <div className="divide-y divide-[#0b3d2e]/10 rounded-2xl border border-[#0b3d2e]/10">
            {faqs.map((f, i) => (
              <details key={i} className="group p-4" open={i === 0}>
                <summary className="cursor-pointer list-none text-[15px] font-medium text-[#0b3d2e] marker:content-['']">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[#0b3d2e]/70">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {related.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold text-[#0b3d2e]">
              Properti {kw.toLowerCase()} di {region.province}
            </h2>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={regionSlug(r)}
                  href={`${basePath}/${regionSlug(r)}`}
                  className="rounded-full border border-[#0b3d2e]/15 px-3.5 py-1.5 text-sm text-[#0b3d2e] transition hover:border-[#0b3d2e]/40 hover:bg-[#f6f8f6]"
                >
                  {regionShortName(r)}
                </Link>
              ))}
              <Link
                href={basePath}
                className="rounded-full border border-[#0b3d2e]/15 px-3.5 py-1.5 text-sm font-medium text-[#0b3d2e] transition hover:bg-[#f6f8f6]"
              >
                Semua kota →
              </Link>
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  )
}
