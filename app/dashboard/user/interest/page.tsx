'use client'

import { useEffect, useState } from 'react'
import { DashboardGreeting, DashboardShell } from '@/components/dashboard-shell'
import { InterestPanel } from '@/components/interest-panel'

/**
 * Dashboard Pengguna → Konfirmasi Ketertarikan.
 * Menggantikan kartu "Pembayaran/Pembayaran tertunda" dengan pernyataan minat
 * yang dianalisis Homy AI (akan membeli / masih membandingkan / cari opsi lain).
 */
export default function UserInterestPage() {
  const [propertyId, setPropertyId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setPropertyId(params.get('property'))
  }, [])

  return (
    <DashboardShell role="User">
      <div className="mb-5 sm:mb-8">
        <DashboardGreeting
          welcome="Halo, {name}"
          headline="Konfirmasi Ketertarikan Anda."
          description="Nyatakan seberapa serius Anda pada sebuah properti. Sistem dan Homy AI akan menilai apakah Anda siap bertransaksi atau masih membandingkan — dan hasilnya terhubung ke agen, pemilik, serta admin untuk memantau negosiasi."
        />
      </div>
      <InterestPanel mode="user" presetPropertyId={propertyId} />
    </DashboardShell>
  )
}
