import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Resolves a web+homy:// deep link to a same-origin path. Anything else falls back to home. */
export default async function OpenDeepLinkPage({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams }) {
  const params = ((await searchParams) ?? {}) as SearchParams
  const target = first(params.target) ?? ''

  const trimmed = target.trim()
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    redirect(trimmed)
  }

  try {
    const url = new URL(trimmed)
    if (url.hostname === 'homyproperty.id' || url.hostname.endsWith('.homyproperty.id')) {
      redirect(`${url.pathname}${url.search}${url.hash}`)
    }
  } catch {
    // Not a URL -> fall through to home.
  }

  redirect('/')
}
