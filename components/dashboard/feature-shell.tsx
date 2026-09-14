'use client'

import { DashboardShell } from '@/components/dashboard-shell'

type ShellRole = 'User' | 'Agent' | 'Property Owner' | 'Admin' | 'Super Admin'

/** Kerangka halaman fitur dashboard: shell (tanpa ringkasan) + judul halaman dedicated. */
export function FeatureShell({ role, eyebrow, title, description, actions, children }: { role: ShellRole; eyebrow: string; title: string; description: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <DashboardShell role={role} showSummary={false}>
      <div className="mb-7 flex flex-col gap-4 border-b border-[#e5dccd] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#a18a61]">{eyebrow}</p>
          <h2 className="mt-1 font-serif text-3xl text-[#0b3d2e] lg:text-4xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#718078]">{description}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </DashboardShell>
  )
}
