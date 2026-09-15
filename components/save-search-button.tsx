'use client'

import { useState } from 'react'
import { BellRing, Check, Loader2 } from 'lucide-react'

type Props = {
  listingType: 'sale' | 'rent'
  city?: string
  district?: string
  minPrice?: number | null
  maxPrice?: number | null
  minBedrooms?: number | null
  keywords?: string
  className?: string
}

/**
 * Simpan kriteria pencarian → pengguna dapat notifikasi di ikon lonceng
 * begitu ada listing baru yang cocok.
 */
export function SaveSearchButton({ listingType, city, district, minPrice, maxPrice, minBedrooms, keywords, className = '' }: Props) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'empty'>('idle')
  const [note, setNote] = useState('')

  const hasFilter = Boolean(city || district || keywords) || minPrice != null || maxPrice != null || minBedrooms != null

  async function save() {
    if (!hasFilter) { setState('empty'); setNote('Isi minimal satu filter dulu (lokasi/harga) supaya notifikasi bisa cocok.'); return }
    setState('saving')
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingType, city, district, minPrice, maxPrice, minBedrooms, keywords }),
      })
      const payload = await response.json().catch(() => ({}))
      if (response.status === 401) { window.location.assign('/auth/login?next=' + encodeURIComponent(window.location.pathname)); return }
      if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan pencarian.')
      setState('saved')
      setNote('Kami akan memberi tahu Anda lewat lonceng begitu ada properti baru yang cocok.')
    } catch (error) {
      setState('error')
      setNote(error instanceof Error ? error.message : 'Gagal menyimpan pencarian.')
    }
  }

  return (
    <div className={'flex flex-col items-end gap-1 ' + className}>
      <button
        type="button"
        disabled={state === 'saving' || state === 'saved'}
        onClick={() => { void save() }}
        className={'inline-flex h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition sm:text-sm ' + (state === 'saved' ? 'border-[#c9a961] bg-[#fdf3dc] text-[#8a6d21]' : 'border-[#d8ccbb] bg-white text-[#0b3d2e] hover:border-[#c9a961]')}
      >
        {state === 'saving' ? <Loader2 className="size-4 animate-spin" /> : state === 'saved' ? <Check className="size-4" /> : <BellRing className="size-4" />}
        {state === 'saved' ? 'Pencarian disimpan' : 'Beri tahu saya'}
      </button>
      {note && <p className={'max-w-[22rem] text-right text-[11px] leading-4 ' + (state === 'saved' ? 'text-[#4e866d]' : 'text-[#a34438]')}>{note}</p>}
    </div>
  )
}
