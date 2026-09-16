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
          description="Ceritakan kebutuhan dan rencana properti Anda. Homy Property akan membantu menemukan solusi terbaik — properti yang paling sesuai dengan anggaran dan kriteria Anda, pilihan pembiayaan, sampai langkah terbaik berikutnya."
        />
      </div>
      <InterestPanel mode="user" presetPropertyId={propertyId} />
    </DashboardShell>
  )
}
