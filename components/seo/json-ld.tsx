/**
 * Menyisipkan JSON-LD sebagai script server-rendered.
 * `<` di-escape supaya aman dan tetap HTML-valid (mencegah tag palsu di dalam JSON).
 */
export function JsonLd({ data }: { data: unknown }) {
  const html = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: html }} />
}
