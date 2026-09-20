/**
 * Homy — penulis PDF minimalis tanpa dependensi eksternal.
 *
 * Dipakai `lib/agreement-pdf.ts` untuk membuat dokumen Perjanjian Kerja Sama yang
 * dapat diunduh mitra & diarsipkan admin. Mendukung:
 *  - font standar PDF (Helvetica / Helvetica-Bold / Helvetica-Oblique, WinAnsi)
 *  - judul, subjudul, pasal, paragraf, daftar butir, pasangan label-nilai, catatan,
 *    garis pemisah, dan blok tanda tangan
 *  - pemenggalan kata otomatis (word wrap), paginasi multi-halaman, nomor halaman
 *  - warna brand Homy (hijau tua + emas) dan footer
 *
 * Semua teks dinormalisasi ke ASCII agar aman dienkode latin-1 (WinAnsiEncoding).
 */

const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = { top: 62, right: 56, bottom: 62, left: 56 }
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right
const LINE_GAP = 24
const FOOTER_HEIGHT = 26

const INK = '0.109 0.109 0.109'
const BRAND = '0.043 0.239 0.180'
const GOLD = '0.604 0.470 0.235'
const MUTED = '0.443 0.502 0.471'
const RULE = '0.855 0.827 0.780'

const WIDTHS_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]

const WIDTHS_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]

const REPLACEMENTS: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201a': "'", '\u201b': "'",
  '\u201c': '"', '\u201d': '"', '\u201e': '"',
  '\u2013': '-', '\u2014': '-', '\u2015': '-',
  '\u2022': '-', '\u2023': '-', '\u25cf': '-', '\u00b7': '-',
  '\u2026': '...', '\u00a0': ' ',
  '\u2192': '->', '\u2190': '<-', '\u21d2': '=>',
  '\u00d7': 'x', '\u00f7': '/', '\u2265': '>=', '\u2264': '<=', '\u2260': '!=',
  '\u00ab': '"', '\u00bb': '"', '\u2039': "'", '\u203a': "'",
  '\u00b0': ' derajat', '\u20ac': 'EUR', '\u00a9': '(c)', '\u00ae': '(R)', '\u2122': '(TM)',
}

export function pdfSanitize(value: unknown): string {
  const text = String(value ?? '')
  let out = ''
  for (const char of text) {
    const mapped = REPLACEMENTS[char]
    if (mapped !== undefined) {
      out += mapped
      continue
    }
    const code = char.codePointAt(0) ?? 63
    if (code === 9) { out += '    '; continue }
    if (code < 32) { out += ' '; continue }
    if (code > 126 && code <= 255) { out += char; continue }
    if (code > 255) { out += '?'; continue }
    out += char
  }
  return out
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function unitWidth(char: string, bold: boolean) {
  const code = char.charCodeAt(0)
  const table = bold ? WIDTHS_BOLD : WIDTHS_REGULAR
  if (code >= 32 && code <= 126) return table[code - 32]
  if (code >= 160 && code <= 255) return bold ? 556 : 556
  return bold ? 611 : 556
}

export function pdfTextWidth(text: string, size: number, bold = false) {
  const safe = pdfSanitize(text)
  let total = 0
  for (const char of safe) total += unitWidth(char, bold)
  return (total / 1000) * size
}

export function pdfWrap(text: string, size: number, bold: boolean, maxWidth: number): string[] {
  const safe = pdfSanitize(text).replace(/\s+/g, ' ').trim()
  if (!safe) return ['']
  const words = safe.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word
    if (pdfTextWidth(candidate, size, bold) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      if (pdfTextWidth(word, size, bold) > maxWidth) {
        // potong kata yang sangat panjang
        let chunk = ''
        for (const char of word) {
          if (pdfTextWidth(chunk + char, size, bold) > maxWidth && chunk) {
            lines.push(chunk)
            chunk = char
          } else {
            chunk += char
          }
        }
        current = chunk
      } else {
        current = word
      }
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

export type PdfBlock =
  | { type: 'title'; text: string; sub?: string; badge?: string }
  | { type: 'meta'; lines: string[] }
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'keyvalues'; rows: { label: string; value: string }[] }
  | { type: 'note'; text: string; label?: string }
  | { type: 'divider' }
  | { type: 'space'; size?: number }
  | {
      type: 'signature'
      columns: { label: string; name: string; role?: string; meta?: string[] }[]
    }

export type PdfDocument = {
  title: string
  subtitle?: string
  badge?: string
  metaLines?: string[]
  blocks: PdfBlock[]
  footerNote?: string
}

export function buildPdf(document: PdfDocument): Uint8Array {
  const pages: string[][] = []
  let ops: string[] = []
  let y = PAGE.height - MARGIN.top

  const newPage = () => {
    pages.push(ops)
    ops = []
    y = PAGE.height - MARGIN.top
  }

  const ensure = (height: number) => {
    if (y - height < MARGIN.bottom + FOOTER_HEIGHT) newPage()
  }

  const text = (x: number, baseline: number, size: number, font: 'F1' | 'F2' | 'F3', color: string, value: string) => {
    ops.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${escapePdfText(pdfSanitize(value))}) Tj ET`)
  }

  const rule = (x1: number, x2: number, baseline: number, color = RULE, weight = 0.7) => {
    ops.push(`${weight} w ${color} RG ${x1.toFixed(2)} ${baseline.toFixed(2)} m ${x2.toFixed(2)} ${baseline.toFixed(2)} l S`)
  }

  const rect = (x: number, baseline: number, w: number, h: number, color: string) => {
    ops.push(`${color} rg ${x.toFixed(2)} ${baseline.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`)
  }

  const paragraph = (value: string, opts: { size?: number; bold?: boolean; italic?: boolean; color?: string; indent?: number; width?: number } = {}) => {
    const size = opts.size ?? 10.4
    const indent = opts.indent ?? 0
    const width = opts.width ?? CONTENT_WIDTH - indent
    const lines = pdfWrap(value, size, Boolean(opts.bold), width)
    const lineHeight = size * 1.46
    const font = opts.bold ? 'F2' : opts.italic ? 'F3' : 'F1'
    const color = opts.color ?? INK
    for (const line of lines) {
      ensure(lineHeight)
      y -= lineHeight
      text(MARGIN.left + indent, y, size, font, color, line)
    }
  }

  for (const block of document.blocks) {
    switch (block.type) {
      case 'title': {
        ensure(74)
        y -= 22
        text(MARGIN.left, y, 19.5, 'F2', BRAND, block.text)
        if (block.badge) {
          const badgeWidth = pdfTextWidth(block.badge, 9, true) + 20
          rect(PAGE.width - MARGIN.right - badgeWidth, y - 5, badgeWidth, 18, GOLD)
          text(PAGE.width - MARGIN.right - badgeWidth + 10, y, 9, 'F2', '1 1 1', block.badge)
        }
        y -= 8
        rule(MARGIN.left, PAGE.width - MARGIN.right, y, GOLD, 1.1)
        y -= 6
        if (block.sub) paragraph(block.sub, { size: 10.6, italic: true, color: MUTED })
        break
      }
      case 'meta': {
        ensure(block.lines.length * 13 + 10)
        y -= 6
        for (const line of block.lines) {
          y -= 13
          text(MARGIN.left, y, 9.2, 'F1', MUTED, line)
        }
        y -= 6
        break
      }
      case 'heading': {
        ensure(46)
        y -= 20
        const lines = pdfWrap(block.text, 11.6, true, CONTENT_WIDTH)
        for (const line of lines) {
          y -= 15
          text(MARGIN.left, y, 11.6, 'F2', BRAND, line)
        }
        y -= 3
        break
      }
      case 'paragraph': {
        paragraph(block.text)
        y -= 3
        break
      }
      case 'bullets': {
        for (const item of block.items) {
          const size = 10.4
          const indent = 15
          const lines = pdfWrap(item, size, false, CONTENT_WIDTH - indent)
          const lineHeight = size * 1.46
          ensure(lineHeight * lines.length + 2)
          y -= lineHeight
          rect(MARGIN.left + 4.4, y + 2.6, 2.8, 2.8, GOLD)
          text(MARGIN.left + indent, y, size, 'F1', INK, lines[0])
          for (const extra of lines.slice(1)) {
            y -= lineHeight
            text(MARGIN.left + indent, y, size, 'F1', INK, extra)
          }
        }
        y -= 3
        break
      }
      case 'keyvalues': {
        const labelWidth = 150
        for (const row of block.rows) {
          const valueLines = pdfWrap(row.value || '-', 10.2, false, CONTENT_WIDTH - labelWidth)
          const height = Math.max(valueLines.length, 1) * 14.6 + 2
          ensure(height)
          const startY = y
          y -= 14.6
          text(MARGIN.left, y, 10.2, 'F2', MUTED, row.label)
          text(MARGIN.left + labelWidth, y, 10.2, 'F1', INK, valueLines[0])
          for (const extra of valueLines.slice(1)) {
            y -= 14.6
            text(MARGIN.left + labelWidth, y, 10.2, 'F1', INK, extra)
          }
          rule(MARGIN.left, PAGE.width - MARGIN.right, startY - height + 6, RULE, 0.5)
        }
        y -= 4
        break
      }
      case 'note': {
        const lines = pdfWrap(block.text, 9.8, false, CONTENT_WIDTH - 24)
        const height = lines.length * 13.6 + (block.label ? 15 : 0) + 14
        ensure(height + 6)
        const top = y
        rect(MARGIN.left, top - height, CONTENT_WIDTH, height, '0.965 0.949 0.925')
        rect(MARGIN.left, top - height, 2.6, height, GOLD)
        y -= 12
        if (block.label) {
          y -= 12
          text(MARGIN.left + 12, y, 9.6, 'F2', BRAND, block.label)
        }
        for (const line of lines) {
          y -= 13.6
          text(MARGIN.left + 12, y, 9.8, 'F1', INK, line)
        }
        y -= 6
        break
      }
      case 'divider': {
        ensure(14)
        y -= 10
        rule(MARGIN.left, PAGE.width - MARGIN.right, y, RULE, 0.7)
        y -= 4
        break
      }
      case 'space': {
        y -= block.size ?? 10
        break
      }
      case 'signature': {
        const needed = 108
        ensure(needed)
        y -= 16
        const columnWidth = (CONTENT_WIDTH - 24) / 2
        block.columns.slice(0, 2).forEach((column, index) => {
          const x = MARGIN.left + index * (columnWidth + 24)
          let cursor = y
          text(x, cursor, 9.4, 'F1', MUTED, column.label)
          cursor -= 34
          text(x + 4, cursor, 12, 'F3', BRAND, column.name)
          cursor -= 8
          rule(x, x + columnWidth - 8, cursor, BRAND, 0.8)
          cursor -= 13
          text(x, cursor, 9.6, 'F2', INK, column.name)
          if (column.role) {
            cursor -= 12
            text(x, cursor, 9, 'F1', MUTED, column.role)
          }
          for (const meta of column.meta ?? []) {
            cursor -= 11.5
            text(x, cursor, 8.8, 'F1', MUTED, meta)
          }
        })
        y -= 92
        break
      }
      default:
        break
    }
  }

  pages.push(ops)

  const totalPages = pages.length
  const footerNote = pdfSanitize(document.footerNote ?? '')
  pages.forEach((pageOps, index) => {
    const baseline = MARGIN.bottom - 26
    pageOps.push(`0.7 w ${RULE} RG ${MARGIN.left.toFixed(2)} ${(baseline + 12).toFixed(2)} m ${(PAGE.width - MARGIN.right).toFixed(2)} ${(baseline + 12).toFixed(2)} l S`)
    pageOps.push(`BT /F1 8.4 Tf ${MUTED} rg 1 0 0 1 ${MARGIN.left.toFixed(2)} ${baseline.toFixed(2)} Tm (${escapePdfText(footerNote.slice(0, 120))}) Tj ET`)
    const label = `Halaman ${index + 1} dari ${totalPages}`
    const width = pdfTextWidth(label, 8.4, false)
    pageOps.push(`BT /F1 8.4 Tf ${MUTED} rg 1 0 0 1 ${(PAGE.width - MARGIN.right - width).toFixed(2)} ${baseline.toFixed(2)} Tm (${escapePdfText(label)}) Tj ET`)
    pageOps.push(`BT /F1 8.4 Tf ${GOLD} rg 1 0 0 1 ${MARGIN.left.toFixed(2)} ${(baseline + 22).toFixed(2)} Tm (${escapePdfText(pdfSanitize(document.title).slice(0, 90))}) Tj ET`)
  })

  return assemble(document, pages)
}

function assemble(document: PdfDocument, pages: string[][]): Uint8Array {
  const objects: string[] = []
  const pageCount = pages.length
  // 1 catalog, 2 pages, 3-5 fonts, lalu tiap halaman: page + stream
  const firstPageObject = 6
  const kids = pages.map((_, index) => `${firstPageObject + index * 2} 0 R`).join(' ')

  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`)
  objects.push(`<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`)
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`)
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`)
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>`)

  pages.forEach((pageOps) => {
    const pageObjectNumber = firstPageObject + (objects.length - 5)
    const streamObjectNumber = pageObjectNumber + 1
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width.toFixed(2)} ${PAGE.height.toFixed(2)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${streamObjectNumber} 0 R >>`,
    )
    const stream = pageOps.join('\n')
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
  })

  const infoTitle = `<< /Title (${escapePdfText(pdfSanitize(document.title))}) /Producer (Homy Property) /Creator (Homy Property - ${escapePdfText(pdfSanitize(document.badge ?? 'Digital'))}) >>`
  objects.push(infoTitle)
  const infoObjectNumber = objects.length

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoObjectNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return new Uint8Array(Buffer.from(pdf, 'latin1'))
}
