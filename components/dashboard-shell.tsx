'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, ChevronDown, ChevronRight, FileSignature, Home, LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, Sparkles, Users, WalletCards, X } from 'lucide-react'
import { DashboardDataSummary, type DashboardRole } from '@/components/dashboard-data-summary'
import { createClient } from '@/lib/supabase/client'
import { firstName, initialsFrom, ROLE_META, useSessionProfile, type AppRole } from '@/lib/homy-session'

type Role = 'User' | 'Agent' | 'Property Owner' | 'Admin' | 'Super Admin'

const roleToAppRole: Record<Role, AppRole> = {
  User: 'user',
  Agent: 'agent',
  'Property Owner': 'property_owner',
  Admin: 'admin',
  'Super Admin': 'super_admin',
}

const roleLinks: Record<Role, { label: string; href: string; icon: typeof LayoutDashboard }[]> = {
  User: [{ label: 'Overview', href: '/dashboard/user', icon: LayoutDashboard }, { label: 'Favorites', href: '/dashboard/user/favorites', icon: Home }, { label: 'Inquiries & Chats', href: '/dashboard/user/inquiries', icon: Users }, { label: 'Visits', href: '/dashboard/user/visits', icon: Search }, { label: 'Become an Agent / Owner', href: '/dashboard/user/apply', icon: Sparkles }],
  Agent: [{ label: 'Overview', href: '/dashboard/agent', icon: LayoutDashboard }, { label: 'My Listings', href: '/dashboard/agent/listings', icon: Home }, { label: 'Leads CRM', href: '/dashboard/agent/leads', icon: Users }, { label: 'Analytics', href: '/dashboard/agent/analytics', icon: Search }, { label: 'Billing', href: '/dashboard/agent/billing', icon: WalletCards }, { label: 'List Property', href: '/dashboard/agent/list', icon: Sparkles }, { label: 'Agreement', href: '/dashboard/agent/agreement', icon: FileSignature }],
  'Property Owner': [{ label: 'Overview', href: '/dashboard/property-owner', icon: LayoutDashboard }, { label: 'My Properties', href: '/dashboard/property-owner/properties', icon: Home }, { label: 'Inquiries', href: '/dashboard/property-owner/inquiries', icon: Users }, { label: 'Calendar', href: '/dashboard/property-owner/calendar', icon: Search }, { label: 'List Property', href: '/dashboard/property-owner/list', icon: Sparkles }, { label: 'Agreement', href: '/dashboard/property-owner/agreement', icon: FileSignature }],
  Admin: [{ label: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard }, { label: 'Moderate Listings', href: '/dashboard/admin/manage#moderation', icon: ShieldCheck }, { label: 'Users & Agents', href: '/dashboard/admin/manage#users', icon: Users }, { label: 'Reports & Fraud', href: '/dashboard/admin/manage#reports', icon: Search }, { label: 'AI Monitoring', href: '/dashboard/admin/manage#ai', icon: Sparkles }],
  'Super Admin': [{ label: 'Overview', href: '/dashboard/super-admin', icon: LayoutDashboard }, { label: 'Roles & Permissions', href: '/dashboard/super-admin/manage#roles', icon: ShieldCheck }, { label: 'System Config', href: '/dashboard/super-admin/manage#system', icon: Settings }, { label: 'Audit Log', href: '/dashboard/super-admin/manage#audit', icon: Search }, { label: 'Feature Flags', href: '/dashboard/super-admin/manage#flags', icon: Sparkles }],
}

/** Avatar that uses the Google profile picture and falls back to initials. */
export function UserAvatar({ name, email, avatarUrl, size = 40, className = '' }: { name: string; email: string; avatarUrl: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (avatarUrl && !failed) {
    return <img src={avatarUrl} alt={name} width={size} height={size} referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`rounded-full object-cover ${className}`} style={{ width: size, height: size }} />
  }
  return <span className={`grid place-items-center rounded-full bg-[#0b3d2e] text-sm font-semibold text-[#f6e2a8] ${className}`} style={{ width: size, height: size }}>{initialsFrom(name, email)}</span>
}

export function DashboardShell({ role, children, showSummary = true }: { role: Role; children: React.ReactNode; showSummary?: boolean }) {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { profile } = useSessionProfile()
  const links = roleLinks[role]
  const displayName = profile?.name ?? 'Memuat…'
  const displayEmail = profile?.email ?? ''
  const avatarUrl = profile?.avatarUrl ?? ''

  const ownedRoles: AppRole[] = profile?.roles?.length ? profile.roles : [roleToAppRole[role]]
  const currentAppRole = roleToAppRole[role]
  const switchRoles = Array.from(new Set<AppRole>([currentAppRole, ...ownedRoles]))

  async function signOut() {
    try {
      await createClient().auth.signOut()
    } finally {
      window.location.assign('/auth/login')
    }
  }

  const translated = (label: string) => ({ Overview: 'Ringkasan', Favorites: 'Favorit', 'Inquiries & Chats': 'Pertanyaan & Pesan', Visits: 'Jadwal Kunjungan', 'Become an Agent / Owner': 'Daftar sebagai Agen atau Pemilik', Agent: 'Agen', 'Property Owner': 'Pemilik Properti', User: 'Pengguna', Settings: 'Pengaturan', 'List Property': 'Pasang Properti', Agreement: 'Perjanjian Kerjasama', 'My Listings': 'Listing Saya', 'Leads CRM': 'CRM Prospek', Analytics: 'Analitik', Billing: 'Penagihan', 'My Properties': 'Properti Saya', Inquiries: 'Pertanyaan', Calendar: 'Kalender', 'Moderate Listings': 'Moderasi Listing', 'Users & Agents': 'Pengguna & Agen', 'Reports & Fraud': 'Laporan & Penipuan', 'AI Monitoring': 'Pemantauan AI', 'Roles & Permissions': 'Peran & Izin', 'System Config': 'Konfigurasi Sistem', 'Audit Log': 'Log Audit', 'Feature Flags': 'Feature Flag', 'Super Admin': 'Super Admin', Admin: 'Admin' }[label] ?? label)
  return <div className="min-h-screen bg-[#f7f3ec] text-[#20332c]">
    <aside className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-[#e5dccd] bg-[#0b3d2e] p-6 text-white transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between"><Link href="/" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#c9a961] text-[#0b3d2e]"><Home /></span><span className="font-serif text-2xl font-bold">Homy<span className="text-[#c9a961]">.</span></span></Link><button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu"><X /></button></div>
      <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} size={44} />
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{displayName}</p><p className="truncate text-xs text-white/55">{displayEmail || '—'}</p></div>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[.18em] text-[#c9a961]">Ruang Kerja</p><p className="mt-2 font-semibold">Dasbor {translated(role)}</p><p className="mt-1 text-xs text-white/55">Kelola aktivitas Homy Anda</p></div>
      <nav className="mt-6 flex flex-col gap-2">{links.map(({ label, href, icon: Icon }, index) => <Link key={label} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${index === 0 ? 'bg-[#c9a961] font-semibold text-[#0b3d2e]' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><Icon />{translated(label)}</Link>)}</nav>
      <div className="absolute inset-x-6 bottom-6 flex flex-col gap-2 border-t border-white/10 pt-5"><Link href="/ai-assistant" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#f6e2a8] hover:bg-white/10"><Sparkles />Asisten AI</Link><Link href="/" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/65 hover:bg-white/10"><Home />Kembali ke marketplace</Link></div>
    </aside>
    <div className="lg:pl-72"><header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#e5dccd] bg-[#f7f3ec]/90 px-5 backdrop-blur-md lg:px-10"><div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu"><Menu /></button><div><p className="text-xs uppercase tracking-[.16em] text-[#a18a61]">Ruang kerja Homy</p><h1 className="font-serif text-2xl text-[#0b3d2e]">Dasbor {translated(role)}</h1></div></div><div className="flex items-center gap-3"><button className="grid size-10 place-items-center rounded-full border border-[#e5dccd] bg-white" aria-label="Cari"><Search /></button><button className="relative grid size-10 place-items-center rounded-full border border-[#e5dccd] bg-white" aria-label="Notifikasi"><Bell /><span className="absolute right-2 top-2 size-2 rounded-full bg-[#b45c50]" /></button><div className="relative"><button type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-haspopup="menu" className="flex items-center gap-2 rounded-full border border-[#e5dccd] bg-white p-1 pr-2"><UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} size={36} /><span className="hidden max-w-[9rem] truncate text-sm font-semibold text-[#0b3d2e] sm:block">{displayName}</span><ChevronDown className="size-4 text-[#0b3d2e]" /></button>{profileOpen && <div role="menu" className="absolute right-0 top-14 z-30 w-72 rounded-2xl border border-[#e5dccd] bg-white p-2 shadow-xl"><div className="flex items-center gap-3 border-b border-[#eee7dc] px-3 pb-3 pt-2"><UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} size={44} /><div className="min-w-0"><p className="truncate font-semibold text-[#20332c]">{displayName}</p><p className="truncate text-xs text-[#718078]">{displayEmail || '—'}</p></div></div><p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-[#a18a61]">Pilihan Dasbor</p>{switchRoles.map((appRole) => { const meta = ROLE_META[appRole]; return <Link key={appRole} href={meta.dashboard} role="menuitem" onClick={() => setProfileOpen(false)} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-[#f7f3ec] ${appRole === currentAppRole ? 'font-semibold text-[#0b3d2e]' : 'text-[#20332c]'}`}>{meta.label}{appRole === currentAppRole && <span className="text-xs text-[#4e866d]">aktif</span>}</Link> })}<Link href="/onboarding" role="menuitem" onClick={() => setProfileOpen(false)} className="mt-1 block rounded-xl px-3 py-2 text-sm text-[#20332c] hover:bg-[#f7f3ec]">Tambah peran lain</Link><button type="button" role="menuitem" onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#b45c50] hover:bg-[#fbeeec]"><LogOut className="size-4" />Keluar</button></div>}</div></div></header><main className="px-5 py-8 lg:px-10">{showSummary && <DashboardDataSummary role={({ User: 'user', Agent: 'agent', 'Property Owner': 'property-owner', Admin: 'admin', 'Super Admin': 'super-admin' } as Record<Role, DashboardRole>)[role]} />}{children}</main></div>
  </div>
}

export function MetricCard({ label, value, change, icon }: { label: string; value: string; change: string; icon: 'home' | 'users' | 'search' | 'sparkles' | 'shield' | 'wallet' | 'calendar' | 'message' | 'file' | 'chart' | 'megaphone' | 'bot' | 'flag' | 'activity' | 'database' | 'key' | 'settings' | 'sliders' }) { const icons = { home: Home, users: Users, search: Search, sparkles: Sparkles, shield: ShieldCheck, wallet: LayoutDashboard, calendar: Bell, message: Users, file: Home, chart: Search, megaphone: Sparkles, bot: Sparkles, flag: ShieldCheck, activity: LayoutDashboard, database: Home, key: ShieldCheck, settings: Settings, sliders: Sparkles }; const Icon = icons[icon]; return <div className="rounded-2xl border border-[#e5dccd] bg-white p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]"><div className="flex items-start justify-between"><div><p className="text-sm text-[#718078]">{label}</p><p className="mt-3 font-serif text-3xl text-[#0b3d2e]">{value}</p><p className="mt-2 text-xs font-semibold text-[#4e866d]">{change}</p></div><span className="grid size-11 place-items-center rounded-xl bg-[#edf2ed] text-[#0b3d2e]"><Icon /></span></div></div> }

export function SectionCard({ title, action, children, id }: { title: string; action?: string; children: React.ReactNode; id?: string }) { return <section id={id} className="rounded-2xl border border-[#e5dccd] bg-white p-6 shadow-[0_10px_30px_rgba(20,42,32,.04)]"><div className="mb-5 flex items-center justify-between"><h2 className="font-serif text-2xl text-[#0b3d2e]">{title}</h2>{action && <button className="flex items-center gap-1 text-sm font-semibold text-[#0b3d2e]">{action}<ChevronRight /></button>}</div>{children}</section> }

export function DashboardGreeting({ welcome, headline, description }: { welcome: string; headline: string; description: string }) {
  const { profile } = useSessionProfile()
  const name = profile?.name ?? ''
  const email = profile?.email ?? ''
  return <div><p className="text-sm text-[#718078]">{welcome.replace('{name}', firstName(name, email))}</p><h2 className="mt-1 font-serif text-4xl text-[#0b3d2e]">{headline}</h2><p className="mt-2 text-[#718078]">{description}</p></div>
}
