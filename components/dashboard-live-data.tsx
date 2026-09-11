'use client'

import useSWR from 'swr'
import { Database, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then((response) => response.json())

export function DashboardLiveData({ role }: { role: 'User' | 'Agent' | 'Admin' | 'Super Admin' }) {
  const slug = role === 'Super Admin' ? 'super-admin' : role.toLowerCase()
  const { data, isLoading, error } = useSWR(`/api/dashboard/${slug}`, fetcher, { revalidateOnFocus: false })
  const metrics = data?.metrics ?? {}
  const entries = Object.entries(metrics).slice(0, 4)

  return <section className="mb-6 rounded-2xl border border-[#dfe8df] bg-[#edf5ee] p-4" aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white text-[#0b3d2e]"><Database /></span><div><p className="text-sm font-semibold text-[#0b3d2e]">Live Supabase data</p><p className="text-xs text-[#718078]">{error ? 'Connection unavailable' : isLoading ? 'Loading your workspace...' : data?.authenticated ? 'Synced with your account and RLS policies' : 'Sign in to load personalized records'}</p></div></div>
      {error && <RefreshCw className="text-[#b45c50]" />}
    </div>
    {!isLoading && entries.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{entries.map(([key, value]) => <span key={key} className={cn('rounded-full bg-white px-3 py-1 text-xs text-[#486257]')}><strong>{String(value)}</strong> {key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>)}</div>}
  </section>
}
