import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Only allow same-origin Homy links to be opened directly (prevents open redirects). */
function homyPath(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    if (url.hostname === 'homyproperty.id' || url.hostname.endsWith('.homyproperty.id')) {
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    return null
  }
  return null
}

/**
 * Web Share Target receiver: users can share a link/text from another app straight into Homy.
 * Homy links open directly; anything else lands on the sale listing browser.
 */
export default async function ShareTargetPage({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams }) {
  const params = ((await searchParams) ?? {}) as SearchParams
  const url = first(params.url)
  const text = first(params.text)
  const direct = homyPath(url) ?? homyPath(text)
  redirect(direct ?? '/buy')
}
