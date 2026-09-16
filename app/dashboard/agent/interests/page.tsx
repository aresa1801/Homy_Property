'use client'

import { DashboardGreeting, DashboardShell } from '@/components/dashboard-shell'
import { InterestPanel } from '@/components/interest-panel'
import { useDashboard } from '@/lib/dashboard-client'

/**
 * Agen → Konfirmasi Ketertarikan.
 * Memantau keseriusan calon pembeli/penyewa atas listing milik agen, lengkap dengan
 * kesimpulan Homy AI dan kendali tahap negosiasi.
 */
export default function AgentInterestPage() {
  const { data } = useDashboard('agent')
  const metrics = data.metrics ?? {}
  return (
    <DashboardShell role="Agent">
      <div className="mb-5 sm:mb-8">
        <DashboardGreeting
          welcome="Halo, {name}"
          headline="Konfirmasi Ketertarikan Calon Pembeli."
          description="Setiap calon pembeli/penyewa yang menyatakan minat pada listing Anda muncul di sini. Homy AI menyimpulkan peluangnya, Anda yang memutuskan langkah negosiasinya."
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          { label: 'Konfirmasi aktif', value: metrics.interests ?? 0, hint: 'Total pernyataan minat' },
          { label: 'Siap bertransaksi', value: metrics.interestReady ?? 0, hint: 'Kesiapan ready/komit' },
          { label: 'Sedang negosiasi', value: metrics.interestNegotiation ?? 0, hint: 'Tahap nego/penawaran' },
          { label: 'Kesepakatan', value: metrics.interestDeal ?? 0, hint: 'Sudah deal' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#e5dccd] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#a18a61]">{item.label}</p>
            <p className="mt-2 font-serif text-2xl text-[#0b3d2e]">{item.value}</p>
            <p className="mt-1 text-xs text-[#718078]">{item.hint}</p>
          </div>
        ))}
      </div>

      <InterestPanel mode="agent" />
    </DashboardShell>
  )
}
