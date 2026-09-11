'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, CheckCircle2, Home, Plus, WalletCards } from 'lucide-react'
import { DashboardShell, MetricCard, SectionCard } from '@/components/dashboard-shell'
import { createClient } from '@/lib/supabase/client'

export default function PropertyOwnerDashboard() {
  const [name, setName] = useState('Property Owner')
  const [propertyCount, setPropertyCount] = useState('0')
  const [inquiries, setInquiries] = useState('0')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      setName(userData.user.user_metadata?.full_name ?? userData.user.email?.split('@')[0] ?? 'Property Owner')
      const [{ count: properties }, { count: inquiryCount }] = await Promise.all([
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('owner_id', userData.user.id),
        supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('agent_id', userData.user.id),
      ])
      setPropertyCount(String(properties ?? 0))
      setInquiries(String(inquiryCount ?? 0))
    }
    load()
  }, [])

  return <DashboardShell role="Property Owner"><div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm text-[#718078]">Good morning, {name}</p><h2 className="mt-1 font-serif text-4xl text-[#0b3d2e]">Your property portfolio.</h2><p className="mt-2 text-[#718078]">Manage listings, leads, and the next step for every property.</p></div><a href="/list" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0b3d2e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#14543f]">List a property <ArrowRight /></a></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="My properties" value={propertyCount} change="Live from Supabase" icon="home" /><MetricCard label="Active inquiries" value={inquiries} change="Keep conversations moving" icon="message" /><MetricCard label="Upcoming visits" value="0" change="No visits scheduled" icon="calendar" /><MetricCard label="Pending payouts" value="Rp 0" change="No pending balance" icon="wallet" /></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><SectionCard title="Listing checklist" action="Open listing flow" id="properties"><div className="flex flex-col gap-4"><div className="flex items-start gap-3 rounded-xl bg-[#f7f3ec] p-4"><CheckCircle2 className="mt-0.5 text-[#4e866d]" /><div><p className="font-semibold text-[#20332c]">Add your first property</p><p className="mt-1 text-sm text-[#718078]">Publish complete details, media, pricing, and availability.</p></div><a href="/list" className="ml-auto text-sm font-semibold text-[#0b3d2e]">Start</a></div><div className="flex items-start gap-3 rounded-xl border border-dashed border-[#d8ccbb] p-4"><Plus className="mt-0.5 text-[#a18a61]" /><div><p className="font-semibold text-[#20332c]">Connect your calendar</p><p className="mt-1 text-sm text-[#718078]">Share availability so prospects can request a visit.</p></div></div></div></SectionCard><SectionCard title="Owner tools" id="inquiries"><div className="grid gap-3 sm:grid-cols-2"><a href="/list" className="rounded-xl border border-[#eee7dc] p-4 hover:border-[#c9a961]"><Home className="text-[#0b3d2e]" /><p className="mt-3 font-semibold">List property</p><p className="mt-1 text-sm text-[#718078]">Create a new sale or rental listing.</p></a><a href="/message" className="rounded-xl border border-[#eee7dc] p-4 hover:border-[#c9a961]"><CalendarDays className="text-[#0b3d2e]" /><p className="mt-3 font-semibold">Review inquiries</p><p className="mt-1 text-sm text-[#718078]">Respond to people interested in your property.</p></a></div></SectionCard></div></DashboardShell>
}
