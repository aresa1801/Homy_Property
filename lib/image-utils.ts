// Client-side image utilities. Keeps uploads small and square (1:1).
// Canvas JPEG quality is 0..1 (unlike sharp's 1..100).

export const MAX_PHOTOS = 10
export const MAX_PHOTO_BYTES = 500 * 1024 // 500 KB

const TARGET_SIZES = [1200, 1000, 800, 640, 480, 320]
const QUALITIES = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42]

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Unable to read image'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      'image/jpeg',
      quality,
    )
  })
}

// Center-crops to a 1:1 square, then compresses down until <= MAX_PHOTO_BYTES.
export async function squareCompressPhoto(file: File): Promise<File> {
  const img = await loadImage(file)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = Math.floor((img.naturalWidth - side) / 2)
  const sy = Math.floor((img.naturalHeight - side) / 2)

  let bestBlob: Blob | null = null

  for (const target of TARGET_SIZES) {
    const canvas = document.createElement('canvas')
    const size = Math.min(target, side)
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)

    for (const quality of QUALITIES) {
      const blob = await canvasToBlob(canvas, quality)
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob
      if (blob.size <= MAX_PHOTO_BYTES) {
        return new File([blob], renameToJpg(file.name), { type: 'image/jpeg' })
      }
    }
  }

  const finalBlob = bestBlob ?? (await canvasToBlob(await squareCanvas(img, sx, sy, side, 320), 0.4))
  return new File([finalBlob], renameToJpg(file.name), { type: 'image/jpeg' })
}

async function squareCanvas(img: HTMLImageElement, sx: number, sy: number, side: number, size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
  return canvas
}

function renameToJpg(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  return `${base || 'photo'}.jpg`
}
