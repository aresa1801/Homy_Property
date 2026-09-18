'use client'

/**
 * Penangan berkas (File Handlers) Homy Property.
 *
 * Ketika pengguna membuka berkas PDF dari pengelola berkas / sistem operasi dan memilih
 * "Buka dengan Homy Property", halaman ini menerima berkas tersebut lewat Launch Queue API
 * lalu mengarahkan ke halaman yang tepat:
 *   - Invoice-HOMY-*.pdf   → Dasbor → Penagihan (lapor transaksi & komisi)
 *   - Perjanjian-*.pdf     → halaman Perjanjian Kerja Sama (tanda tangan digital)
 * Ada juga pemilih berkas manual sebagai cadangan (dan untuk pengujian di desktop).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Loader2, ShieldCheck } from 'lucide-react'

declare global {
  interface Window {
    launchQueue?: { setConsumer: (consumer: (params: { files: FileSystemFileHandle[] }) => void) => void }
  }
}

type Picked = { name: string; size: number; type: string; target: string | null; label: string }

const RULES: { test: RegExp; target: string; label: string }[] = [
  { test: /^invoice[-_ ]?homy[-_ ]?([A-Za-z0-9-]+)\.pdf$/i, target: '/dashboard/agent/billing', label: 'Dasbor Penagihan & Komisi' },
  { test: /^invoice[-_ ]?([A-Za-z0-9-]+)\.pdf$/i, target: '/dashboard/agent/billing', label: 'Dasbor Penagihan & Komisi' },
  { test: /perjanjian/i, target: '/agreement', label: 'Perjanjian Kerja Sama' },
]

function match(name: string) {
  for (const rule of RULES) {
    if (rule.test.test(name)) return rule
  }
  return null
}

export default function OpenFilePage() {
  const [picked, setPicked] = useState<Picked | null>(null)
  const [waiting, setWaiting] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const queue = window.launchQueue
    if (!queue || typeof queue.setConsumer !== 'function') {
      setWaiting(false)
      return
    }
    queue.setConsumer(async (params) => {
      setWaiting(false)
      const handle = params?.files?.[0]
      if (!handle) return
      const file = await handle.getFile().catch(() => null)
      if (!file) return
      const rule = match(file.name)
      setPicked({ name: file.name, size: file.size, type: file.type || 'application/octet-stream', target: rule?.target ?? null, label: rule?.label ?? '' })
      if (rule) window.setTimeout(() => window.location.assign(rule.target), 900)
    })
  }, [])

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const rule = match(file.name)
    setPicked({ name: file.name, size: file.size, type: file.type || 'application/octet-stream', target: rule?.target ?? null, label: rule?.label ?? '' })
    if (rule) window.setTimeout(() => window.location.assign(rule.target), 900)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-5 py-16">
      <div className="rounded-2xl border border-[#e5dccd] bg-white p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-[#e2eee7] text-[#0b3d2e]">
          <FileText className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-[#0b3d2e]">Membuka dokumen Homy</h1>
        <p className="mt-2 text-sm leading-6 text-[#65706c]">
          Homy Property menerima berkas <strong>PDF</strong> (invoice komisi &amp; perjanjian kerja sama) dan mengarahkannya ke halaman yang tepat.
        </p>

        {waiting && (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#8a8f8b]">
            <Loader2 className="size-4 animate-spin" /> Menunggu berkas dari perangkat…
          </p>
        )}

        {picked && (
          <div className="mt-5 rounded-xl border border-[#efe7db] bg-[#faf7f1] p-4">
            <p className="text-sm font-semibold text-[#20332c] break-all">{picked.name}</p>
            <p className="mt-1 text-xs text-[#718078]">
              {(picked.size / 1024).toFixed(1)} KB · {picked.type}
            </p>
            {picked.target ? (
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]">
                <ShieldCheck className="size-4" /> Mengalihkan ke {picked.label}…
              </p>
            ) : (
              <p className="mt-3 text-sm text-[#8a6d21]">
                Nama berkas tidak dikenali. Buka dokumen dari dasbor Homy: menu <strong>Penagihan</strong> untuk invoice, atau <strong>Perjanjian Kerjasama</strong>.
              </p>
            )}
          </div>
        )}

        <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#d8ccbb] bg-white px-4 py-2 text-sm font-semibold text-[#0b3d2e]">
          Pilih berkas PDF
          <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPick} />
        </label>
      </div>

      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <Link className="rounded-lg bg-[#0b3d2e] px-4 py-2 text-white" href="/dashboard/agent/billing">Buka Penagihan</Link>
        <Link className="rounded-lg border border-[#d8ccbb] px-4 py-2 text-[#0b3d2e]" href="/agreement">Buka Perjanjian</Link>
      </div>
    </main>
  )
}
