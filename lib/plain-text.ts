/**
 * Homy — perapi teks jawaban AI.
 *
 * Tujuan: jawaban Homy AI tampil seperti ditulis manusia (bahasa sehari-hari yang
 * profesional) di aplikasi, tanpa sintaks markdown mentah yang bocor ke layar
 * (terutama tanda bintang `*` untuk bold/italic dan bullet).
 *
 * UI chat merender teks apa adanya (whitespace-pre-wrap), jadi markdown tidak
 * dirender sebagai format — kalau tidak dibersihkan, pengguna melihat `**teks**`.
 *
 * Dipakai otomatis di `lib/ai.ts` (semua output teks AI) + sebagai jaring
 * pengaman di komponen chat. Fungsi murni (aman dipakai di server & client).
 */

const FENCE = /```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g

export function plainify(input: string): string {
  let text = String(input ?? '')

  // blok kode & kode inline
  text = text.replace(FENCE, '$1')
  text = text.replace(/`([^`]+)`/g, '$1')

  // bold/italic markdown
  text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '$1')
  text = text.replace(/(^|[\s(])__([^_\n]+)__(?=[\s).,!?:;]|$)/g, '$1$2')
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1$2')
  text = text.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1$2')

  // heading, bullet, blockquote
  text = text.replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
  text = text.replace(/^[ \t]*[-*+][ \t]+/gm, '- ')
  text = text.replace(/^[ \t]*>[ \t]?/gm, '')

  // sisa penekanan tak berpasangan (mis. "*Judul*:" atau "**teks"),
  // TAPI jangan sentuh bintang yang berdiri sendiri sebagai operator (mis. "3 * 5").
  text = text.replace(/(^|[\s(])\*(\S)/gm, '$1$2')
  text = text.replace(/(^|[\s(])\*(\S)/gm, '$1$2')
  text = text.replace(/(\S)\*(?=[\s).,!?:;]|$)/g, '$1')

  // rapikan spasi & baris
  text = text.replace(/[ \t]+$/gm, '')
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/[ \t]{2,}/g, ' ')

  return text.trim()
}

/** Apakah teks masih memuat sintaks markdown yang sebaiknya tidak tampil ke pengguna. */
export function hasMarkdownNoise(input: string): boolean {
  return /(\*\*|__|\*[^*\n]+\*|^[ \t]*#{1,6}[ \t])/m.test(String(input ?? ''))
}
