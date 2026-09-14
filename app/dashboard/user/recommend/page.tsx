'use client'

import { CurateBoard } from '@/components/dashboard/boards-ai'
import { FeatureShell } from '@/components/dashboard/feature-shell'
import { useDashboard } from '@/lib/dashboard-client'

export default function UserRecommendPage() {
  const { data, loading, reload } = useDashboard('user')
  return (
    <FeatureShell
      role="User"
      eyebrow="Kecerdasan Buatan"
      title="Rekomendasi AI"
      description="Ceritakan kebutuhan Anda (budget, area, jumlah kamar, prioritas lain) dan Homy AI akan memilih listing paling cocok dari seluruh properti terbit di Homy, lengkap dengan alasan dan hal yang perlu dicek."
      actions={<a href="/ai-assistant" className="inline-flex rounded-lg bg-[#0b3d2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14553f]">Buka Homy AI</a>}
    >
      <CurateBoard data={data} loading={loading} reload={reload} type="user" />
    </FeatureShell>
  )
}
