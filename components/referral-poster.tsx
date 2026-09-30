'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, ImageDown, Share2, X } from 'lucide-react'
import qrcode from '@/lib/vendor/qrcode-gen'

/**
 * Poster promosi referral agen Homy Property.
 *
 * Dibuat sepenuhnya di sisi klien memakai Canvas 2D (tanpa dependency tambahan)
 * sehingga bisa diunduh sebagai PNG dan dibagikan ke WhatsApp/Instagram.
 * QR di-encode lokal lewat `qrcode-generator` yang di-vendor di lib/vendor.
 */

const W = 1080
const H = 1350

const CREAM = '#f7f3ec'
const GREEN = '#0b3d2e'
const GREEN_2 = '#14553f'
const GOLD = '#c9a961'
const GOLD_SOFT = '#a18a61'
const LINE = '#e5dccd'
const MUTED = '#718078'

const SERIF = 'Georgia, "Times New Roman", serif'
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export type ReferralPosterProps = {
  open: boolean
  onClose: () => void
  link: string
  code?: string | null
  agentName?: string | null
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || ctx.measureText(candidate).width <= maxWidth) current = candidate
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Kecilkan ukuran font sampai teks muat dalam lebar maksimum. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, weight: string, family: string) {
  let size = start
  while (size > 16) {
    ctx.font = `${weight} ${size}px ${family}`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 2
  }
  return size
}

function drawQr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  const cell = Math.max(2, Math.floor(size / count))
  const actual = cell * count
  const left = Math.round(x + (size - actual) / 2)
  const top = Math.round(y + (size - actual) / 2)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(left - 10, top - 10, actual + 20, actual + 20)

  ctx.fillStyle = GREEN
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) ctx.fillRect(left + col * cell, top + row * cell, cell, cell)
    }
  }
}

function drawPoster(canvas: HTMLCanvasElement, logo: HTMLImageElement | null, input: { link: string; code?: string | null; agentName?: string | null }) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = W
  canvas.height = H
  ctx.clearRect(0, 0, W, H)

  // Latar krem hangat (warna platform).
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, W, H)

  // Panel hijau (header).
  const grad = ctx.createLinearGradient(0, 0, W, 940)
  grad.addColorStop(0, GREEN)
  grad.addColorStop(1, GREEN_2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, 940)

  // Aksen emas lembut di kanan atas.
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.arc(W - 70, 40, 340, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 0.1
  ctx.beginPath()
  ctx.arc(40, 900, 260, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Logo resmi (tone terang untuk latar gelap).
  if (logo) {
    const lw = 330
    const lh = lw * (logo.naturalHeight / logo.naturalWidth || 0.29)
    ctx.drawImage(logo, 88, 80, lw, lh)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 58px ${SERIF}`
    ctx.fillText('Homy Property', 88, 150)
  }

  // Eyebrow.
  ctx.fillStyle = GOLD
  ctx.font = `700 26px ${SANS}`
  ctx.fillText('PROGRAM KEMITRAAN AGEN PROPERTI', 88, 330)

  // Headline.
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 76px ${SERIF}`
  const head = wrapText(ctx, 'Gabung Jadi Agen Properti Homy', W - 176)
  head.forEach((line, index) => ctx.fillText(line, 88, 430 + index * 88))

  // Subheadline.
  ctx.fillStyle = 'rgba(255,255,255,.84)'
  ctx.font = `400 29px ${SANS}`
  const sub = wrapText(
    ctx,
    'Listing gratis, prospek pembeli dibantu Homy AI, komisi penjualan transparan, plus bonus referral.',
    W - 176,
  )
  const subTop = 430 + head.length * 88 + 20
  sub.slice(0, 3).forEach((line, index) => ctx.fillText(line, 88, subTop + index * 40))

  // Poin manfaat.
  const benefits = [
    'Listing properti gratis & mudah diatur',
    'Prospek & follow-up dibantu Homy AI',
    'Komisi jelas + bonus referral agen',
  ]
  benefits.forEach((text, index) => {
    const y = 748 + index * 62
    ctx.fillStyle = GOLD
    ctx.beginPath()
    ctx.arc(104, y - 11, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#eaf1ec'
    ctx.font = `500 34px ${SANS}`
    ctx.fillText(text, 140, y)
  })

  // Kartu putih: QR + CTA.
  ctx.save()
  ctx.shadowColor = 'rgba(20,42,32,.12)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 10
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 88, 976, W - 176, 250, 34)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = LINE
  ctx.lineWidth = 2
  roundRect(ctx, 88, 976, W - 176, 250, 34)
  ctx.stroke()

  drawQr(ctx, input.link, 124, 1002, 198)

  const textLeft = 372
  const textWidth = W - 176 - (textLeft - 88) - 40

  ctx.fillStyle = GREEN
  ctx.font = `700 44px ${SERIF}`
  ctx.fillText('Daftar jadi Agen', textLeft, 1062)

  ctx.fillStyle = MUTED
  ctx.font = `400 29px ${SANS}`
  ctx.fillText('Scan QR atau buka tautan berikut:', textLeft, 1106)

  const displayLink = input.link.replace(/^https?:\/\//, '')
  const linkSize = fitFont(ctx, displayLink, textWidth, 34, '700', SANS)
  ctx.fillStyle = GREEN
  ctx.font = `700 ${linkSize}px ${SANS}`
  ctx.fillText(displayLink, textLeft, 1170)

  if (input.code) {
    ctx.fillStyle = GOLD_SOFT
    ctx.font = `600 27px ${SANS}`
    ctx.fillText(`Kode referral: ${input.code}`, textLeft, 1212)
  }

  // Footer.
  ctx.textAlign = 'center'
  ctx.fillStyle = GREEN
  ctx.font = `700 36px ${SERIF}`
  ctx.fillText('homyproperty.id', W / 2, 1294)

  ctx.fillStyle = MUTED
  ctx.font = `400 27px ${SANS}`
  ctx.fillText(input.agentName ? `Direferensikan oleh ${input.agentName}` : 'Platform properti mitra agen terpercaya', W / 2, 1338)
  ctx.textAlign = 'left'
}

export function ReferralPosterDialog({ open, onClose, link, code, agentName }: ReferralPosterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !link) return
    setReady(false)
    const logo = new Image()
    const draw = (image: HTMLImageElement | null) => {
      drawPoster(canvas, image, { link, code, agentName })
      setReady(true)
    }
    logo.onload = () => draw(logo)
    logo.onerror = () => draw(null)
    logo.src = '/logo-homy-light.png'
  }, [link, code, agentName])

  useEffect(() => {
    if (open) render()
  }, [open, render])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const toBlob = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const canvas = canvasRef.current
        if (!canvas) return resolve(null)
        canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95)
      }),
    [],
  )

  const filename = `poster-referral-homy-${(code || 'agen').toLowerCase()}.png`

  async function download() {
    setBusy(true)
    setNotice(null)
    try {
      const blob = await toBlob()
      if (!blob) throw new Error('Gagal membuat gambar poster')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      setNotice('Poster terunduh — siap dibagikan ke WhatsApp / Instagram.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal mengunduh poster')
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    setBusy(true)
    setNotice(null)
    try {
      const blob = await toBlob()
      if (!blob) throw new Error('Gagal membuat gambar poster')
      const file = new File([blob], filename, { type: 'image/png' })
      const { canShare, share: doShare } = navigator
      if (canShare && canShare({ files: [file] }) && doShare) {
        await doShare({ files: [file], title: 'Homy Property', text: `Daftar jadi agen properti Homy: ${link}` })
      } else {
        await navigator.clipboard?.writeText(link).catch(() => undefined)
        setNotice('Browser ini belum mendukung bagikan gambar — poster diunduh & tautan disalin.')
        await download()
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal membagikan poster')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl sm:max-w-md" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-serif text-lg text-[#0b3d2e] sm:text-xl">
              <ImageDown className="size-5" /> Poster promosi
            </h3>
            <p className="mt-1 text-xs text-[#718078]">Bagikan poster ini ke calon agen — tautan referral Anda sudah tertanam di QR.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-[#718078] hover:bg-[#f7f3ec]">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-[#e5dccd] bg-[#f7f3ec]">
          <canvas ref={canvasRef} className={`block w-full transition-opacity ${ready ? 'opacity-100' : 'opacity-0'}`} />
          {!ready && <p className="py-16 text-center text-sm text-[#718078]">Menyiapkan poster…</p>}
        </div>

        {notice && <p className="mt-3 rounded-lg bg-[#edf2ed] px-3 py-2 text-xs text-[#0b3d2e]">{notice}</p>}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={busy || !ready} onClick={download} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0b3d2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14553f] disabled:opacity-60">
            <Download className="size-4" /> Unduh PNG
          </button>
          <button type="button" disabled={busy || !ready} onClick={share} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#d8ccbb] px-4 py-2.5 text-sm font-semibold text-[#33433d] hover:bg-[#f7f3ec] disabled:opacity-60">
            <Share2 className="size-4" /> Bagikan
          </button>
        </div>
      </div>
    </div>
  )
}
