'use client'

import { useState } from 'react'
import { BadgeCheck, Check, Copy } from 'lucide-react'

/**
 * Rekening resmi HOMY Property untuk penagihan komisi.
 *
 * Dipakai di: dashboard Penagihan (agen, pemilik, admin/super admin),
 * halaman kemitraan publik, Syarat & Ketentuan, serta ringkasan Perjanjian
 * Kerja Sama. Komisi wajib ditransfer ke rekening ini ketika properti
 * berhasil TERJUAL atau TERSEWA melalui platform Homy.
 */
export const HOMY_PAYMENT_ACCOUNT = {
  bankCode: 'BCA',
  bankName: 'Bank Central Asia (BCA)',
  accountNumber: '5211082705',
  accountHolder: 'Anastasia Evi Rahma Dewi',
  logoSrc: '/bca-logo.svg',
  logoWhiteSrc: '/bca-logo-white.svg',
} as const

export const HOMY_PAYMENT_NOTE =
  'Transfer komisi Homy hanya ke rekening resmi di atas setelah properti berhasil terjual atau tersewa. Homy tidak pernah meminta pembayaran ke rekening pribadi lain.'

/** Kartu rekening pembayaran komisi dengan logo BCA yang jelas & nomor rekening tebal. */
export function BcaPaymentCard({
  variant = 'light',
  note = HOMY_PAYMENT_NOTE,
  className = '',
  title = 'Rekening Penagihan Komisi Homy',
  subtitle = 'Pembayaran komisi properti yang terjual atau tersewa',
}: {
  variant?: 'light' | 'dark'
  note?: string | null
  className?: string
  title?: string
  subtitle?: string
}) {
  const [copied, setCopied] = useState(false)
  const dark = variant === 'dark'

  async function copy() {
    try {
      await navigator.clipboard.writeText(HOMY_PAYMENT_ACCOUNT.accountNumber)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const shell = dark
    ? 'border-white/15 bg-[#0b3d2e] text-white'
    : 'border-[#e8dfd3] bg-white text-[#1c1c1c]'
  const label = dark ? 'text-white/70' : 'text-[#718078]'
  const numberColor = dark ? 'text-white' : 'text-[#0b3d2e]'
  const divider = dark ? 'border-white/15' : 'border-[#f0e9df]'

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${shell} p-5 shadow-[0_12px_35px_rgba(20,42,32,.08)] sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${dark ? 'bg-[#c9a961] text-[#0b3d2e]' : 'bg-[#edf2ed] text-[#0b3d2e]'}`}>
            <BadgeCheck className="size-3.5" /> Rekening Resmi
          </span>
          <h3 className={`mt-3 font-serif text-lg sm:text-xl ${dark ? 'text-white' : 'text-[#0b3d2e]'}`}>{title}</h3>
          <p className={`mt-1 text-xs sm:text-sm ${label}`}>{subtitle}</p>
        </div>
        {/* Logo BCA — versi biru resmi di kartu terang, di atas chip putih di kartu gelap */}
        {dark ? (
          <span className="shrink-0 rounded-xl bg-white px-3 py-2 shadow-sm">
            <img src={HOMY_PAYMENT_ACCOUNT.logoSrc} alt="Logo Bank Central Asia (BCA)" className="h-7 w-auto sm:h-8" width={1000} height={313} />
          </span>
        ) : (
          <img src={HOMY_PAYMENT_ACCOUNT.logoSrc} alt="Logo Bank Central Asia (BCA)" className="h-8 w-auto shrink-0 sm:h-9" width={1000} height={313} />
        )}
      </div>

      <div className={`mt-5 border-t ${divider} pt-4`}>
        <p className={`text-[11px] font-semibold uppercase tracking-[.18em] ${label}`}>Nomor rekening BCA</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <p className={`font-mono text-2xl font-extrabold tracking-[0.16em] sm:text-3xl ${numberColor}`}>{HOMY_PAYMENT_ACCOUNT.accountNumber}</p>
          <button
            type="button"
            onClick={copy}
            aria-label="Salin nomor rekening"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${dark ? 'border-white/25 text-white hover:bg-white/10' : 'border-[#d8ccbb] text-[#33433d] hover:border-[#0b3d2e]'}`}
          >
            {copied ? <><Check className="size-3.5" /> Tersalin</> : <><Copy className="size-3.5" /> Salin</>}
          </button>
        </div>
        <p className={`mt-2 text-sm font-semibold ${dark ? 'text-white' : 'text-[#20332c]'}`}>
          a.n. <span className="font-extrabold">{HOMY_PAYMENT_ACCOUNT.accountHolder}</span>
        </p>
        <p className={`mt-0.5 text-xs font-semibold uppercase tracking-wider ${label}`}>{HOMY_PAYMENT_ACCOUNT.bankName}</p>
      </div>

      {note ? (
        <p className={`mt-4 rounded-xl px-4 py-3 text-xs leading-6 sm:text-sm ${dark ? 'bg-white/10 text-white/80' : 'bg-[#f7f3ec] text-[#65706c]'}`}>{note}</p>
      ) : null}
    </div>
  )
}
