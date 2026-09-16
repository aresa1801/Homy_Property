'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Galeri foto properti berupa carousel.
 *
 * - Foto berganti otomatis tiap 5 detik, berputar kembali ke foto pertama.
 * - Otomatis berhenti sebentar saat kursor di atas foto atau saat tab tidak aktif.
 * - Bisa digeser (swipe) di layar sentuh, atau pakai tombol panah & bulatan.
 */
export function PropertyGallery({
  photos,
  alt,
  intervalMs = 5000,
}: {
  photos: string[]
  alt: string
  intervalMs?: number
}) {
  const total = photos.length
  const [index, setIndex] = useState(0)
  const [hover, setHover] = useState(false)
  const [tabHidden, setTabHidden] = useState(false)
  const startX = useRef<number | null>(null)

  const go = useCallback(
    (next: number) => {
      setIndex((current) => {
        if (total < 1) return 0
        const target = typeof next === 'number' ? next : current + 1
        return ((target % total) + total) % total
      })
    },
    [total],
  )

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden)
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (total < 2 || hover || tabHidden) return
    const timer = setInterval(() => setIndex((current) => (current + 1) % total), intervalMs)
    return () => clearInterval(timer)
  }, [total, hover, tabHidden, intervalMs, index])

  if (!total) {
    return (
      <div className="grid aspect-[1.4] place-items-center rounded-2xl bg-white text-[#0b3d2e] shadow-[0_10px_35px_rgba(20,42,32,.07)]">
        Belum ada foto
      </div>
    )
  }

  const active = index % total

  return (
    <div
      className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.07)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="relative"
        onTouchStart={(event) => { startX.current = event.touches[0]?.clientX ?? null }}
        onTouchEnd={(event) => {
          const start = startX.current
          startX.current = null
          if (start == null) return
          const delta = (event.changedTouches[0]?.clientX ?? start) - start
          if (Math.abs(delta) < 40) return
          go(active + (delta < 0 ? 1 : -1))
        }}
      >
        <div className="aspect-[1.4] w-full overflow-hidden">
          <div
            className="flex h-full w-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${active * 100}%)` }}
          >
            {photos.map((url, position) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${url}-${position}`}
                src={url}
                alt={`${alt} — foto ${position + 1}`}
                loading={position === 0 ? 'eager' : 'lazy'}
                className="aspect-[1.4] w-full flex-shrink-0 object-cover"
              />
            ))}
          </div>
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto sebelumnya"
              onClick={() => go(active - 1)}
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#0b3d2e] shadow-md backdrop-blur transition hover:bg-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Foto berikutnya"
              onClick={() => go(active + 1)}
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#0b3d2e] shadow-md backdrop-blur transition hover:bg-white"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
              {active + 1} / {total}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-2 py-3">
          {photos.map((url, position) => (
            <button
              key={`dot-${url}-${position}`}
              type="button"
              aria-label={`Lihat foto ${position + 1}`}
              aria-current={position === active}
              onClick={() => go(position)}
              className={`h-2 rounded-full transition-all ${position === active ? 'w-6 bg-[#0b3d2e]' : 'w-2 bg-[#cfd8d3] hover:bg-[#9fb0a8]'}`}
            />
          ))}
        </div>
      )}

      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-3">
          {photos.map((url, position) => (
            <button
              key={`thumb-${url}-${position}`}
              type="button"
              onClick={() => go(position)}
              aria-label={`Buka foto ${position + 1}`}
              className={`h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${position === active ? 'border-[#0b3d2e]' : 'border-transparent opacity-70 hover:opacity-100'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${alt} — mini ${position + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
