import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Halaman lama `/agreement` (form perjanjian versi v1) sudah dipindahkan ke
 * wizard verifikasi `/verify` yang menjadi satu-satunya alur resmi:
 * data diri → dokumen (KTP maks 1 MB) → ketersediaan → Perjanjian Kerja Sama.
 *
 * Route ini hanya meneruskan tautan lama agar tidak ada alur yang tertinggal:
 * `/agreement?role=agent&next=/list` → `/verify?role=agent&next=/list`
 */
export default async function LegacyAgreementPage({ searchParams }: { searchParams: SearchParams | Promise<SearchParams> }) {
  const params = (await searchParams) ?? {}
  const rawRole = String(first(params.role) ?? '').toLowerCase()
  const role = rawRole === 'property_owner' || rawRole === 'property-owner' || rawRole === 'owner' ? 'property_owner' : 'agent'
  const rawNext = first(params.next)
  const query = new URLSearchParams({ role })
  if (rawNext && rawNext.startsWith('/')) query.set('next', rawNext)
  redirect(`/verify?${query.toString()}`)
}
