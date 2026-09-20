/**
 * Homy — penulis PDF minimalis tanpa dependensi eksternal.
 *
 * Dipakai `lib/agreement-pdf.ts` untuk membuat dokumen Perjanjian Kerja Sama yang
 * dapat diunduh mitra & diarsipkan admin. Mendukung:
 *  - font standar PDF (Helvetica / Helvetica-Bold / Helvetica-Oblique, WinAnsi)
 *  - judul, subjudul, pasal, paragraf, daftar butir, pasangan label-nilai, catatan,
 *    garis pemisah, blok tanda tangan, dan sertifikat penandatanganan
 *  - paginasi multi-halaman dengan kontrol tata letak: blok "group" bersifat atomic
 *    (satu pasal/section tidak terpotong antar halaman), heading tidak pernah
 *    tertinggal sendiri di dasar halaman, dan paragraf terhindar dari baris yatim
 *  - warna brand Homy (hijau tua + emas) dan footer
 *
 * Semua teks dinormalisasi ke ASCII agar aman dienkode latin-1 (WinAnsiEncoding).
 */

const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = { top: 62, right: 56, bottom: 62, left: 56 }
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right
const FOOTER_HEIGHT = 26
/** Sisa ruang yang boleh dipakai isi halaman (tanpa margin & footer). */
const CONTENT_HEIGHT = PAGE.height - MARGIN.top - MARGIN.bottom - FOOTER_HEIGHT
/** Batas aman blok atomic: kalau lebih tinggi dari ini, biarkan mengalir (pasal kepanjangan). */
const MAX_ATOMIC_HEIGHT = CONTENT_HEIGHT - 24

const INK = '0.109 0.109 0.109'
const BRAND = '0.043 0.239 0.180'
const GOLD = '0.604 0.470 0.235'
const MUTED = '0.443 0.502 0.471'
const RULE = '0.855 0.827 0.780'
const PANEL = '0.984 0.980 0.969'
const PANEL_EDGE = '0.898 0.878 0.839'

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

/* ------------------------------------------------------------------ */
/* Ukuran & tata letak blok (dipakai untuk keputusan pindah halaman)  */
/* ------------------------------------------------------------------ */

const PARAGRAPH_SIZE = 10.4
const PARAGRAPH_LEAD = PARAGRAPH_SIZE * 1.46
const BULLET_SIZE = 10.4
const BULLET_LEAD = BULLET_SIZE * 1.46
const HEADING_SIZE = 11.6
const HEADING_LEAD = 15
const HEADING_TOP_GAP = 20
const KEYVALUE_LEAD = 14.6
const KEYVALUE_LABEL_WIDTH = 150
const NOTE_SIZE = 9.8
const NOTE_LEAD = 13.6
const SIGN_COLUMN_GAP = 18

export type SignColumn = {
  label: string
  name: string
  role?: string
  /** baris label-nilai di dalam kotak tanda tangan */
  fields?: { label: string; value: string }[]
}

export type PdfImage = {
  /** Byte gambar JPEG (dipasang apa adanya memakai filter DCTDecode). */
  data: Uint8Array
  /** Lebar piksel asli. */
  width: number
  /** Tinggi piksel asli. */
  height: number
  /** Keterangan di bawah gambar. */
  caption?: string
  /** Tinggi tampil maksimum (default 300 pt). */
  maxHeight?: number
  /** Tampilkan bingkai tipis (default true). */
  frame?: boolean
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
  | { type: 'signature'; columns: SignColumn[]; note?: string }
  | { type: 'certificate'; title?: string; rows: { label: string; value: string }[]; note?: string }
  | { type: 'image'; image: PdfImage }
  /** Blok atomic: semua isinya diusahakan tetap dalam satu halaman. */
  | { type: 'group'; blocks: PdfBlock[]; atomic?: boolean }

export type PdfDocument = {
  title: string
  subtitle?: string
  badge?: string
  metaLines?: string[]
  blocks: PdfBlock[]
  footerNote?: string
  /** Teks tanda air diagonal yang dicetak di setiap halaman (mis. "DRAFT"). */
  watermark?: string
}

/** Hitung ukuran tampil gambar agar muat lebar konten & tinggi maksimum. */
function imageDisplay(image: PdfImage) {
  const width = Math.max(1, Number(image.width) || 1)
  const height = Math.max(1, Number(image.height) || 1)
  const maxHeight = image.maxHeight ?? 300
  const scale = Math.min(1, CONTENT_WIDTH / width, maxHeight / height)
  return { width: width * scale, height: height * scale }
}

function measureBlock(block: PdfBlock): number {
  switch (block.type) {
    case 'title': {
      const sub = block.sub ? pdfWrap(block.sub, 10.6, false, CONTENT_WIDTH).length : 0
      return 22 + 11 + 8 + 6 + sub * 15.5 + 8
    }
    case 'meta':
      return 6 + block.lines.length * 13 + 8
    case 'heading':
      return HEADING_TOP_GAP + pdfWrap(block.text, HEADING_SIZE, true, CONTENT_WIDTH).length * HEADING_LEAD + 6
    case 'paragraph':
      return pdfWrap(block.text, PARAGRAPH_SIZE, false, CONTENT_WIDTH).length * PARAGRAPH_LEAD + 5
    case 'bullets':
      return (
        block.items.reduce(
          (total, item) => total + Math.max(1, pdfWrap(item, BULLET_SIZE, false, CONTENT_WIDTH - 15).length) * BULLET_LEAD + 2,
          0,
        ) + 4
      )
    case 'keyvalues':
      return (
        block.rows.reduce(
          (total, row) => total + Math.max(1, pdfWrap(row.value || '-', 10.2, false, CONTENT_WIDTH - KEYVALUE_LABEL_WIDTH).length) * KEYVALUE_LEAD + 2,
          0,
        ) + 6
      )
    case 'note': {
      const lines = pdfWrap(block.text, NOTE_SIZE, false, CONTENT_WIDTH - 24).length
      return lines * NOTE_LEAD + (block.label ? 15 : 0) + 22
    }
    case 'divider':
      return 16
    case 'space':
      return block.size ?? 10
    case 'signature': {
      const columns = block.columns.slice(0, 2)
      const rows = Math.max(...columns.map((column) => (column.fields ?? []).length), 1)
      const height = 14 + 14 + 46 + 10 + rows * 12.6 + 12
      return height + (block.note ? 14 : 0) + 12
    }
    case 'certificate': {
      const lines = block.rows.reduce(
        (total, row) => total + Math.max(1, pdfWrap(row.value || '-', 9.4, false, CONTENT_WIDTH - KEYVALUE_LABEL_WIDTH - 30).length) * 13.4,
        0,
      )
      const note = block.note ? pdfWrap(block.note, 8.8, false, CONTENT_WIDTH - 30).length * 12.4 + 10 : 0
      return 26 + 10 + lines + note + 16
    }
    case 'group':
      return block.blocks.reduce((total, child) => total + measureBlock(child), 0)
    case 'image': {
      const display = imageDisplay(block.image)
      const caption = block.image.caption ? pdfWrap(block.image.caption, 8.6, false, CONTENT_WIDTH).length * 11.6 + 6 : 0
      return display.height + caption + 14
    }
    default:
      return 0
  }
}

/** Tinggi perkiraan sekumpulan blok (dipakai untuk keputusan tata letak & pengujian). */
export function measureBlocks(blocks: PdfBlock[]): number {
  return blocks.reduce((total, block) => total + measureBlock(block), 0)
}

type Entry = { block: PdfBlock; groupStart: boolean; groupHeight: number; atomic: boolean }

function flatten(blocks: PdfBlock[]): Entry[] {
  const entries: Entry[] = []
  for (const block of blocks) {
    if (block.type === 'group') {
      const inner = block.blocks
      const total = inner.reduce((sum, child) => sum + measureBlock(child), 0)
      const atomic = block.atomic !== false
      inner.forEach((child, index) => {
        entries.push({
          block: child,
          groupStart: index === 0,
          groupHeight: total,
          atomic: atomic && child.type !== 'space',
        })
      })
      continue
    }
    const atomic = block.type === 'signature' || block.type === 'certificate' || block.type === 'image'
    entries.push({ block, groupStart: true, groupHeight: measureBlock(block), atomic })
  }
  return entries
}

/* ------------------------------------------------------------------ */
/* Penulis PDF                                                        */
/* ------------------------------------------------------------------ */

export function buildPdf(document: PdfDocument): Uint8Array {
  const pages: string[][] = []
  const images: PdfImage[] = []
  let ops: string[] = []
  let y = PAGE.height - MARGIN.top

  const bottomLimit = () => MARGIN.bottom + FOOTER_HEIGHT

  const newPage = () => {
    pages.push(ops)
    ops = []
    y = PAGE.height - MARGIN.top
  }

  const ensure = (height: number) => {
    if (y - height < bottomLimit()) newPage()
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

  const strokeRect = (x: number, baseline: number, w: number, h: number, color: string, weight = 0.8) => {
    ops.push(`${weight} w ${color} RG ${x.toFixed(2)} ${baseline.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`)
  }

  const paragraph = (
    value: string,
    opts: { size?: number; bold?: boolean; italic?: boolean; color?: string; indent?: number; width?: number } = {},
  ) => {
    const size = opts.size ?? PARAGRAPH_SIZE
    const indent = opts.indent ?? 0
    const width = opts.width ?? CONTENT_WIDTH - indent
    const lines = pdfWrap(value, size, Boolean(opts.bold), width)
    const lineHeight = size * 1.46
    const font = opts.bold ? 'F2' : opts.italic ? 'F3' : 'F1'
    const color = opts.color ?? INK
    // hindari baris yatim: kalau hanya 1 baris yang muat padahal ada >1 baris, pindah halaman
    if (lines.length > 1) {
      const fits = Math.floor((y - bottomLimit()) / lineHeight)
      if (fits < 2) newPage()
    }
    for (const line of lines) {
      ensure(lineHeight)
      y -= lineHeight
      text(MARGIN.left + indent, y, size, font, color, line)
    }
  }

  const drawSignature = (block: Extract<PdfBlock, { type: 'signature' }>) => {
    const columns = block.columns.slice(0, 2)
    if (!columns.length) return
    const columnWidth = (CONTENT_WIDTH - SIGN_COLUMN_GAP) / 2
    const padX = 12
    const height = 14 + 14 + 46 + 10 + Math.max(...columns.map((column) => (column.fields ?? []).length), 1) * 12.6 + 12
    ensure(height + (block.note ? 16 : 0) + 14)
    const top = y
    columns.forEach((column, index) => {
      const x = MARGIN.left + index * (columnWidth + SIGN_COLUMN_GAP)
      const boxBottom = top - height
      rect(x, boxBottom, columnWidth, height, PANEL)
      strokeRect(x, boxBottom, columnWidth, height, PANEL_EDGE, 0.8)
      rect(x, top - 4, columnWidth, 4, GOLD)

      text(x + padX, top - 20, 8.6, 'F2', GOLD, column.label.toUpperCase())
      // baris tanda tangan (gaya surat: nama dalam huruf miring besar + garis)
      text(x + padX, top - 50, 15.5, 'F3', BRAND, column.name)
      rule(x + padX, x + columnWidth - padX, top - 56, BRAND, 0.8)
      text(x + padX, top - 68, 8, 'F1', MUTED, 'Ditandatangani secara elektronik')

      let cursor = top - 68 - 14
      for (const field of column.fields ?? []) {
        const valueLines = pdfWrap(field.value || '-', 8.9, false, columnWidth - padX * 2 - 78)
        cursor -= 12.6
        text(x + padX, cursor, 8.4, 'F1', MUTED, field.label)
        text(x + padX + 78, cursor, 8.9, 'F1', INK, valueLines[0])
        for (const extra of valueLines.slice(1)) {
          cursor -= 12.6
          text(x + padX + 78, cursor, 8.9, 'F1', INK, extra)
        }
      }
    })
    y = top - height
    if (block.note) {
      y -= 4
      paragraph(block.note, { size: 8.8, italic: true, color: MUTED })
    }
    y -= 6
  }

  const drawCertificate = (block: Extract<PdfBlock, { type: 'certificate' }>) => {
    const title = block.title ?? 'Sertifikat Penandatanganan Elektronik'
    const labelWidth = KEYVALUE_LABEL_WIDTH
    const prepared = block.rows.map((row) => ({
      label: row.label,
      lines: pdfWrap(row.value || '-', 9.4, false, CONTENT_WIDTH - labelWidth - 30),
    }))
    const rowsHeight = prepared.reduce((total, row) => total + Math.max(1, row.lines.length) * 13.4, 0)
    const noteLines = block.note ? pdfWrap(block.note, 8.8, false, CONTENT_WIDTH - 30) : []
    const height = 26 + 12 + rowsHeight + (noteLines.length ? noteLines.length * 12.4 + 10 : 0) + 14

    ensure(height + 14)
    const top = y
    const boxBottom = top - height
    rect(MARGIN.left, boxBottom, CONTENT_WIDTH, height, PANEL)
    strokeRect(MARGIN.left, boxBottom, CONTENT_WIDTH, height, PANEL_EDGE, 0.8)
    rect(MARGIN.left, top - 26, CONTENT_WIDTH, 26, BRAND)
    text(MARGIN.left + 12, top - 17, 10, 'F2', '1 1 1', title)

    let cursor = top - 26 - 6
    for (const row of prepared) {
      cursor -= 13.4
      text(MARGIN.left + 14, cursor, 8.5, 'F1', MUTED, row.label)
      text(MARGIN.left + 14 + labelWidth, cursor, 9.4, 'F1', INK, row.lines[0])
      for (const extra of row.lines.slice(1)) {
        cursor -= 13.4
        text(MARGIN.left + 14 + labelWidth, cursor, 9.4, 'F1', INK, extra)
      }
    }
    if (noteLines.length) {
      cursor -= 10
      for (const line of noteLines) {
        cursor -= 12.4
        text(MARGIN.left + 14, cursor, 8.8, 'F3', MUTED, line)
      }
    }
    y = boxBottom - 10
  }

  const entries = flatten(document.blocks)

  entries.forEach((entry, index) => {
    const block = entry.block

    // Blok atomic (satu pasal / tanda tangan / sertifikat) tidak dipotong halaman.
    if (entry.groupStart && entry.atomic) {
      const fits = y - entry.groupHeight - 2 >= bottomLimit()
      const alreadyEmpty = PAGE.height - MARGIN.top - y < 40
      if (!fits && entry.groupHeight + 6 <= MAX_ATOMIC_HEIGHT && !alreadyEmpty) newPage()
    }

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
        const lines = pdfWrap(block.text, HEADING_SIZE, true, CONTENT_WIDTH)
        const headingHeight = HEADING_TOP_GAP + lines.length * HEADING_LEAD + 4
        // heading tidak boleh tertinggal sendiri di dasar halaman:
        // sisakan ruang untuk heading + 2 baris blok berikutnya.
        const next = entries[index + 1]?.block
        let reserve = 30
        if (next && next.type === 'paragraph') reserve = Math.min(2, pdfWrap(next.text, PARAGRAPH_SIZE, false, CONTENT_WIDTH).length) * PARAGRAPH_LEAD
        else if (next && next.type === 'bullets' && next.items[0]) reserve = Math.min(2, pdfWrap(next.items[0], BULLET_SIZE, false, CONTENT_WIDTH - 15).length) * BULLET_LEAD
        else if (next && next.type === 'keyvalues' && next.rows[0]) reserve = 2 * KEYVALUE_LEAD
        ensure(headingHeight + reserve)
        y -= HEADING_TOP_GAP
        for (const line of lines) {
          y -= HEADING_LEAD
          text(MARGIN.left, y, HEADING_SIZE, 'F2', BRAND, line)
        }
        y -= 4
        break
      }
      case 'paragraph': {
        paragraph(block.text)
        y -= 2
        break
      }
      case 'bullets': {
        for (const item of block.items) {
          const lines = pdfWrap(item, BULLET_SIZE, false, CONTENT_WIDTH - 15)
          const blockHeight = Math.max(1, lines.length) * BULLET_LEAD + 2
          // butir tidak terbelah di dasar halaman
          if (lines.length > 1) {
            const fits = Math.floor((y - bottomLimit()) / BULLET_LEAD)
            if (fits < Math.min(2, lines.length)) newPage()
          }
          ensure(blockHeight)
          y -= BULLET_LEAD
          rect(MARGIN.left + 4.4, y + 2.6, 2.8, 2.8, GOLD)
          text(MARGIN.left + 15, y, BULLET_SIZE, 'F1', INK, lines[0])
          for (const extra of lines.slice(1)) {
            y -= BULLET_LEAD
            text(MARGIN.left + 15, y, BULLET_SIZE, 'F1', INK, extra)
          }
        }
        y -= 4
        break
      }
      case 'keyvalues': {
        for (const row of block.rows) {
          const valueLines = pdfWrap(row.value || '-', 10.2, false, CONTENT_WIDTH - KEYVALUE_LABEL_WIDTH)
          const height = Math.max(valueLines.length, 1) * KEYVALUE_LEAD + 2
          ensure(height)
          const startY = y
          y -= KEYVALUE_LEAD
          text(MARGIN.left, y, 10.2, 'F2', MUTED, row.label)
          text(MARGIN.left + KEYVALUE_LABEL_WIDTH, y, 10.2, 'F1', INK, valueLines[0])
          for (const extra of valueLines.slice(1)) {
            y -= KEYVALUE_LEAD
            text(MARGIN.left + KEYVALUE_LABEL_WIDTH, y, 10.2, 'F1', INK, extra)
          }
          rule(MARGIN.left, PAGE.width - MARGIN.right, startY - height + 6, RULE, 0.5)
        }
        y -= 4
        break
      }
      case 'note': {
        const lines = pdfWrap(block.text, NOTE_SIZE, false, CONTENT_WIDTH - 24)
        const height = lines.length * NOTE_LEAD + (block.label ? 15 : 0) + 22
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
          y -= NOTE_LEAD
          text(MARGIN.left + 12, y, NOTE_SIZE, 'F1', INK, line)
        }
        y -= 6
        break
      }
      case 'divider': {
        ensure(16)
        y -= 12
        rule(MARGIN.left, PAGE.width - MARGIN.right, y, RULE, 0.7)
        y -= 4
        break
      }
      case 'space': {
        y -= block.size ?? 10
        break
      }
      case 'signature': {
        drawSignature(block)
        break
      }
      case 'image': {
        const display = imageDisplay(block.image)
        const captionLines = block.image.caption ? pdfWrap(block.image.caption, 8.6, false, CONTENT_WIDTH) : []
        const captionHeight = captionLines.length ? captionLines.length * 11.6 + 6 : 0
        ensure(display.height + captionHeight + 12)
        const name = `Im${images.length + 1}`
        images.push(block.image)
        const x = MARGIN.left + (CONTENT_WIDTH - display.width) / 2
        const bottom = y - display.height
        if (block.image.frame !== false) strokeRect(x, bottom, display.width, display.height, PANEL_EDGE, 0.8)
        ops.push(
          `q ${display.width.toFixed(2)} 0 0 ${display.height.toFixed(2)} ${x.toFixed(2)} ${bottom.toFixed(2)} cm /${name} Do Q`,
        )
        y = bottom
        if (captionLines.length) {
          y -= 6
          for (const line of captionLines) {
            y -= 11.6
            text(MARGIN.left, y, 8.6, 'F3', MUTED, line)
          }
        }
        y -= 8
        break
      }
      case 'certificate': {
        drawCertificate(block)
        break
      }
      default:
        break
    }
  })

  pages.push(ops)

  const totalPages = pages.length
  const footerNote = pdfSanitize(document.footerNote ?? '')
  pages.forEach((pageOps, index) => {
    const baseline = MARGIN.bottom - 26
    if (document.watermark) {
      const label = pdfSanitize(document.watermark)
      const size = 58
      const width = pdfTextWidth(label, size, true)
      const cos = Math.SQRT1_2
      const sin = Math.SQRT1_2
      const x0 = PAGE.width / 2 - (width * cos) / 2 + (size * sin) / 2
      const y0 = PAGE.height / 2 - (width * sin) / 2 - (size * cos) / 2
      pageOps.unshift(
        `q 0.93 0.91 0.87 rg BT /F2 ${size} Tf ${cos.toFixed(4)} ${sin.toFixed(4)} ${(-sin).toFixed(4)} ${cos.toFixed(4)} ${x0.toFixed(2)} ${y0.toFixed(2)} Tm (${escapePdfText(label)}) Tj ET Q`,
      )
    }
    pageOps.push(`0.7 w ${RULE} RG ${MARGIN.left.toFixed(2)} ${(baseline + 12).toFixed(2)} m ${(PAGE.width - MARGIN.right).toFixed(2)} ${(baseline + 12).toFixed(2)} l S`)
    pageOps.push(`BT /F1 8.4 Tf ${MUTED} rg 1 0 0 1 ${MARGIN.left.toFixed(2)} ${baseline.toFixed(2)} Tm (${escapePdfText(footerNote.slice(0, 120))}) Tj ET`)
    const label = `Halaman ${index + 1} dari ${totalPages}`
    const width = pdfTextWidth(label, 8.4, false)
    pageOps.push(`BT /F1 8.4 Tf ${MUTED} rg 1 0 0 1 ${(PAGE.width - MARGIN.right - width).toFixed(2)} ${baseline.toFixed(2)} Tm (${escapePdfText(label)}) Tj ET`)
    pageOps.push(`BT /F1 8.4 Tf ${GOLD} rg 1 0 0 1 ${MARGIN.left.toFixed(2)} ${(baseline + 22).toFixed(2)} Tm (${escapePdfText(pdfSanitize(document.title).slice(0, 90))}) Tj ET`)
  })

  return assemble(document, pages, images)
}

function assemble(document: PdfDocument, pages: string[][], images: PdfImage[]): Uint8Array {
  const objects: string[] = []
  const pageCount = pages.length
  // 1 catalog, 2 pages, 3-5 fonts, lalu tiap halaman: page + stream, lalu objek gambar
  const firstPageObject = 6
  const imageStart = firstPageObject + pageCount * 2
  const xobject = images.length
    ? ` /XObject << ${images.map((_, index) => `/Im${index + 1} ${imageStart + index} 0 R`).join(' ')} >>`
    : ''
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
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xobject} >> /Contents ${streamObjectNumber} 0 R >>`,
    )
    const stream = pageOps.join('\n')
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
  })

  for (const image of images) {
    const bytes = Buffer.from(image.data)
    objects.push(
      `<< /Type /XObject /Subtype /Image /Width ${Math.round(image.width)} /Height ${Math.round(image.height)} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n${bytes.toString('latin1')}\nendstream`,
    )
  }

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
