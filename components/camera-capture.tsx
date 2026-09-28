'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, Loader2, RefreshCw, X } from 'lucide-react'

type Props = {
  open: boolean
  title: string
  hint?: string
  /** 'card' = panduan bingkai persegi (KTP/SIM), 'face' = panduan oval (selfie). */
  guide?: 'card' | 'face'
  /** Kamera default: 'environment' (belakang) untuk memotret kartu, 'user' (depan) untuk selfie. */
  initialFacing?: 'user' | 'environment'
  onClose: () => void
  onCapture: (file: File) => void
}

/**
 * Kamera dalam-aplikasi (getUserMedia) untuk memotret KTP/SIM & selfie langsung
 * dari perangkat, tanpa memilih berkas dari penyimpanan. Komponen ini hanya
 * memotret lalu menyerahkan File ke pemanggil (upload ditangani pemanggil).
 */
export function CameraCapture({
  open,
  title,
  hint,
  guide = 'card',
  initialFacing = 'environment',
  onClose,
  onCapture,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>(initialFacing)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [canFlip, setCanFlip] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setReady(false)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setReady(false)

    async function start() {
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('unsupported')
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[])
        setCanFlip(devices.filter((device) => device.kind === 'videoinput').length > 1)
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => {})
        }
        if (!cancelled) setReady(true)
      } catch (failure) {
        if (cancelled) return
        const message = failure instanceof Error ? failure.message : ''
        if (/NotAllowed|Permission|denied/i.test(message)) {
          setError('Akses kamera ditolak. Izinkan kamera pada pengaturan browser, atau pakai opsi unggah berkas.')
        } else if (/NotFound|Requested device not found|no camera|Overconstrained/i.test(message) || message === 'unsupported') {
          setError('Kamera tidak tersedia di perangkat/browser ini. Silakan pakai opsi unggah berkas.')
        } else {
          setError('Tidak bisa membuka kamera. Coba lagi, atau pakai opsi unggah berkas.')
        }
      }
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [open, facing, stop])

  // Tutup dengan tombol Esc.
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth || busy) return
    setBusy(true)
    try {
      const maxWidth = 1440
      const scale = Math.min(1, maxWidth / video.videoWidth)
      const width = Math.round(video.videoWidth * scale)
      const height = Math.round(video.videoHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas tidak tersedia di browser ini.')
      // Foto disimpan apa adanya (tidak dicerminkan) agar teks pada KTP tetap terbaca.
      context.drawImage(video, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          setBusy(false)
          if (!blob) {
            setError('Gagal mengambil gambar. Coba lagi.')
            return
          }
          const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' })
          onCapture(file)
          onClose()
        },
        'image/jpeg',
        0.9,
      )
    } catch (failure) {
      setBusy(false)
      setError(failure instanceof Error ? failure.message : 'Gagal mengambil gambar. Coba lagi.')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          {hint && <p className="mt-0.5 truncate text-[11px] text-white/60">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup kamera"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-contain ${facing === 'user' ? '-scale-x-100' : ''}`}
        />

        {ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            {guide === 'face' ? (
              <div className="aspect-[3/4] h-[78%] max-h-[78%] rounded-[50%] border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            ) : (
              <div className="relative aspect-[85/54] w-[86%] max-w-md rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                <span className="absolute -left-px -top-px size-5 rounded-tl-2xl border-l-4 border-t-4 border-[#c9a961]" />
                <span className="absolute -right-px -top-px size-5 rounded-tr-2xl border-r-4 border-t-4 border-[#c9a961]" />
                <span className="absolute -bottom-px -left-px size-5 rounded-bl-2xl border-b-4 border-l-4 border-[#c9a961]" />
                <span className="absolute -bottom-px -right-px size-5 rounded-br-2xl border-b-4 border-r-4 border-[#c9a961]" />
              </div>
            )}
          </div>
        )}

        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center text-white">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Loader2 className="size-4 animate-spin" /> Menyiapkan kamera…
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="max-w-sm rounded-2xl bg-white/95 p-5 text-center">
              <AlertTriangle className="mx-auto size-8 text-[#b45c50]" />
              <p className="mt-3 text-sm text-[#33433d]">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-[#0b3d2e] px-5 py-2 text-sm font-semibold text-white hover:bg-[#14553f]"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          onClick={() => setFacing((current) => (current === 'user' ? 'environment' : 'user'))}
          disabled={!canFlip}
          aria-label="Ganti kamera"
          className="grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
        >
          <RefreshCw className="size-5" />
        </button>

        <button
          type="button"
          onClick={capture}
          disabled={!ready || busy || Boolean(error)}
          aria-label="Ambil foto"
          className="grid size-[68px] place-items-center rounded-full border-4 border-white bg-[#c9a961] text-[#0b3d2e] transition active:scale-95 disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
        </button>

        <span className="size-11" aria-hidden />
      </div>
    </div>
  )
}
