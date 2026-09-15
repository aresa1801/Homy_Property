'use client'

import { useEffect, useState } from 'react'
import { BrandMark } from '@/components/brand-mark'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Bell, Bot, CalendarDays, ChevronDown, ChevronRight, Clock, FileSignature, Flag, Handshake, Home, LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, Sparkles, Users, WalletCards, X } from 'lucide-react'
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
  User: [{ label: 'Overview', href: '/dashboard/user', icon: LayoutDashboard }, { label: 'Favorites', href: '/dashboard/user/favorites', icon: Home }, { label: 'Inquiries & Chats', href: '/dashboard/user/inquiries', icon: Users }, { label: 'Visits', href: '/dashboard/user/visits', icon: CalendarDays }, { label: 'AI Recommendations', href: '/dashboard/user/recommend', icon: Sparkles }, { label: 'Become an Agent / Owner', href: '/dashboard/user/apply', icon: Sparkles }],
  Agent: [{ label: 'Overview', href: '/dashboard/agent', icon: LayoutDashboard }, { label: 'My Listings', href: '/dashboard/agent/listings', icon: Home }, { label: 'Leads CRM', href: '/dashboard/agent/leads', icon: Users }, { label: 'Analytics', href: '/dashboard/agent/analytics', icon: BarChart3 }, { label: 'Billing', href: '/dashboard/agent/billing', icon: WalletCards }, { label: 'Calendar', href: '/dashboard/agent/calendar', icon: CalendarDays }, { label: 'Ketersediaan', href: '/dashboard/agent/availability', icon: Clock }, { label: 'List Property', href: '/dashboard/agent/list', icon: Sparkles }, { label: 'Agreement', href: '/dashboard/agent/agreement', icon: FileSignature }, { label: 'AI Assistant', href: '/dashboard/agent/ai', icon: Sparkles }],
  'Property Owner': [{ label: 'Overview', href: '/dashboard/property-owner', icon: LayoutDashboard }, { label: 'My Properties', href: '/dashboard/property-owner/properties', icon: Home }, { label: 'Inquiries', href: '/dashboard/property-owner/inquiries', icon: Users }, { label: 'Calendar', href: '/dashboard/property-owner/calendar', icon: CalendarDays }, { label: 'Ketersediaan', href: '/dashboard/property-owner/availability', icon: Clock }, { label: 'List Property', href: '/dashboard/property-owner/list', icon: Sparkles }, { label: 'Agreement', href: '/dashboard/property-owner/agreement', icon: FileSignature }, { label: 'AI Assistant', href: '/dashboard/property-owner/ai', icon: Sparkles }],
  Admin: [{ label: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard }, { label: 'Moderate Listings', href: '/dashboard/admin/moderation', icon: ShieldCheck }, { label: 'Users & Agents', href: '/dashboard/admin/users', icon: Users }, { label: 'Billing & Commission', href: '/dashboard/admin/billing', icon: WalletCards }, { label: 'Reports & Fraud', href: '/dashboard/admin/reports', icon: Flag }, { label: 'AI Monitoring', href: '/dashboard/admin/ai', icon: Bot }],
  'Super Admin': [{ label: 'Overview', href: '/dashboard/super-admin', icon: LayoutDashboard }, { label: 'Partnership', href: '/dashboard/super-admin/partnership', icon: Handshake }, { label: 'Roles & Permissions', href: '/dashboard/super-admin/roles', icon: ShieldCheck }, { label: 'Platform Billing', href: '/dashboard/super-admin/billing', icon: WalletCards }, { label: 'Audit Log', href: '/dashboard/super-admin/audit', icon: Flag }, { label: 'System Config', href: '/dashboard/super-admin/system', icon: Settings }, { label: 'Feature Flags', href: '/dashboard/super-admin/flags', icon: Sparkles }],
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
  const [hash, setHash] = useState('')
  const pathname = usePathname()
  const { profile } = useSessionProfile()
  const links = roleLinks[role]

  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    sync()
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [pathname])

  const currentPath = (pathname ?? '').replace(/\/+$/, '') || '/'
  const samePathLinks = links.filter((link) => (link.href.split('#')[0].replace(/\/+$/, '') || '/') === currentPath)
  const activeHref = samePathLinks.length
    ? (samePathLinks.find((link) => link.href.includes('#') && `#${link.href.split('#')[1]}` === hash) ?? samePathLinks[0]).href
    : ''
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

  const handleNav = (href: string) => { setOpen(false); setHash(href.includes('#') ? '#' + href.split('#')[1] : '') }
  const navItemClass = (active: boolean) => 'group flex shrink-0 items-center gap-3 rounded-xl px-4 py-2 text-sm transition ' + (active ? 'bg-[#c9a961] font-semibold text-[#0b3d2e] shadow-[0_8px_20px_rgba(201,169,97,.22)]' : 'text-white/70 hover:bg-white/10 hover:text-white')
  const navIconClass = (active: boolean) => 'size-[18px] shrink-0 ' + (active ? 'text-[#0b3d2e]' : 'text-white/55 group-hover:text-white')
  const translated = (label: string) => ({ Overview: 'Ringkasan', Favorites: 'Favorit', 'Inquiries & Chats': 'Pertanyaan & Pesan', Visits: 'Jadwal Kunjungan', 'Become an Agent / Owner': 'Daftar sebagai Agen atau Pemilik', Agent: 'Agen', 'Property Owner': 'Pemilik Properti', User: 'Pengguna', Settings: 'Pengaturan', 'List Property': 'Pasang Properti', Agreement: 'Perjanjian Kerjasama', 'My Listings': 'Listing Saya', 'Leads CRM': 'CRM Prospek', Analytics: 'Analitik', Billing: 'Penagihan', 'Billing & Commission': 'Penagihan & Komisi', 'Platform Billing': 'Penagihan Platform', 'My Properties': 'Properti Saya', Inquiries: 'Pertanyaan', Calendar: 'Kalender', 'Moderate Listings': 'Moderasi Listing', 'Users & Agents': 'Pengguna & Agen', 'Reports & Fraud': 'Laporan & Penipuan', 'AI Monitoring': 'Pemantauan AI', 'AI Assistant': 'Asisten AI', 'AI Recommendations': 'Rekomendasi AI', 'Roles & Permissions': 'Peran & Izin', 'System Config': 'Konfigurasi Sistem', 'Audit Log': 'Log Audit', 'Feature Flags': 'Feature Flag', 'Super Admin': 'Super Admin', Admin: 'Admin' }[label] ?? label)
  return <div className="min-h-screen bg-[#f7f3ec] text-[#20332c]">
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-[#e5dccd] bg-[#0b3d2e] p-4 sm:p-6 text-white transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between"><BrandMark tone="light" height={40} /><button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu"><X /></button></div>
      <div className="mt-6 flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} size={44} />
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{displayName}</p><p className="truncate text-xs text-white/55">{displayEmail || '—'}</p></div>
      </div>
      <div className="mt-3 hidden shrink-0 rounded-xl border border-white/10 bg-white/5 p-4 [@media(min-height:761px)]:block"><p className="text-xs uppercase tracking-[.18em] text-[#c9a961]">Ruang Kerja</p><p className="mt-2 font-semibold"><span className="hidden sm:inline">Dasbor </span>{translated(role)}</p><p className="mt-1 text-xs text-white/55">Kelola aktivitas Homy Anda</p></div>
      <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">{links.map(({ label, href, icon: Icon }) => { const active = href === activeHref; return <Link key={label} href={href} aria-current={active ? 'page' : undefined} onClick={() => handleNav(href)} className={navItemClass(active)}><Icon className={navIconClass(active)} /><span className="truncate">{translated(label)}</span></Link> })}</nav>
      <div className="mt-4 flex shrink-0 flex-col gap-1 border-t border-white/10 pt-4"><Link href="/ai-assistant" className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-[#f6e2a8] hover:bg-white/10"><Sparkles className="size-[18px] shrink-0" />Asisten AI</Link><Link href="/" className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white/65 hover:bg-white/10"><Home className="size-[18px] shrink-0" />Kembali ke marketplace</Link></div>
    </aside>
    <div className="lg:pl-72"><header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-[#e5dccd] bg-[#f7f3ec]/90 px-4 backdrop-blur-md sm:h-20 sm:px-5 lg:px-10"><div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu"><Menu /></button><div><p className="text-xs uppercase tracking-[.16em] text-[#a18a61]">Ruang kerja Homy</p><h1 className="font-serif text-lg sm:text-2xl text-[#0b3d2e]"><span className="hidden sm:inline">Dasbor </span>{translated(role)}</h1></div></div><div className="flex items-center gap-3"><button className="hidden size-10 place-items-center rounded-full border border-[#e5dccd] bg-white sm:grid" aria-label="Cari"><Search /></button><button className="relative grid size-9 place-items-center rounded-full border border-[#e5dccd] bg-white sm:size-10" aria-label="Notifikasi"><Bell /><span className="absolute right-2 top-2 size-2 rounded-full bg-[#b45c50]" /></button><div className="relative"><button type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-haspopup="menu" className="flex items-center gap-2 rounded-full border border-[#e5dccd] bg-white p-1 pr-2"><UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} size={36} /><span className="hidden max-w-[9rem] truncate text-sm font-semibold text-[#0b3d2e] sm:block">{displayName}</span><ChevronDown className="size-4 text-[#0b3d2e]" /></button>{profileOpen && <div role="menu" className="absolute right-0 top-14 z-30 w-72 rounded-2xl border border-[#e5dccd] bg-white p-2 shadow-xl"><div className="flex items-center gap-3 border-b border-[#eee7dc] px-3 pb-3 pt-2"><UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} size={44} /><div className="min-w-0"><p className="truncate font-semibold text-[#20332c]">{displayName}</p><p className="truncate text-xs text-[#718078]">{displayEmail || '—'}</p></div></div><p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-[#a18a61]">Pilihan Dasbor</p>{switchRoles.map((appRole) => { const meta = ROLE_META[appRole]; return <Link key={appRole} href={meta.dashboard} role="menuitem" onClick={() => setProfileOpen(false)} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-[#f7f3ec] ${appRole === currentAppRole ? 'font-semibold text-[#0b3d2e]' : 'text-[#20332c]'}`}>{meta.label}{appRole === currentAppRole && <span className="text-xs text-[#4e866d]">aktif</span>}</Link> })}<Link href="/onboarding" role="menuitem" onClick={() => setProfileOpen(false)} className="mt-1 block rounded-xl px-3 py-2 text-sm text-[#20332c] hover:bg-[#f7f3ec]">Tambah peran lain</Link><button type="button" role="menuitem" onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#b45c50] hover:bg-[#fbeeec]"><LogOut className="size-4" />Keluar</button></div>}</div></div></header><main className="px-4 py-5 sm:px-5 sm:py-8 lg:px-10">{showSummary && <DashboardDataSummary role={({ User: 'user', Agent: 'agent', 'Property Owner': 'property-owner', Admin: 'admin', 'Super Admin': 'super-admin' } as Record<Role, DashboardRole>)[role]} />}{children}</main></div>
  </div>
}

export function MetricCard({ label, value, change, icon }: { label: string; value: string; change: string; icon: 'home' | 'users' | 'search' | 'sparkles' | 'shield' | 'wallet' | 'calendar' | 'message' | 'file' | 'chart' | 'megaphone' | 'bot' | 'flag' | 'activity' | 'database' | 'key' | 'settings' | 'sliders' }) { const icons = { home: Home, users: Users, search: Search, sparkles: Sparkles, shield: ShieldCheck, wallet: LayoutDashboard, calendar: CalendarDays, message: Users, file: Home, chart: BarChart3, megaphone: Sparkles, bot: Sparkles, flag: Flag, activity: LayoutDashboard, database: Home, key: ShieldCheck, settings: Settings, sliders: Sparkles }; const Icon = icons[icon]; return <div className="rounded-2xl border border-[#e5dccd] bg-white p-3 sm:p-5 shadow-[0_10px_30px_rgba(20,42,32,.04)]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs leading-snug text-[#718078] sm:text-sm">{label}</p><p className="mt-1.5 break-words font-serif text-base leading-tight text-[#0b3d2e] sm:mt-3 sm:text-3xl">{value}</p><p className="mt-1 truncate text-[11px] font-semibold text-[#4e866d] sm:mt-2 sm:text-xs">{change}</p></div><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf2ed] text-[#0b3d2e] sm:size-11 sm:rounded-xl"><Icon className="size-4 sm:size-5" /></span></div></div> }

export function SectionCard({ title, action, children, id }: { title: string; action?: string; children: React.ReactNode; id?: string }) { return <section id={id} className="rounded-2xl border border-[#e5dccd] bg-white p-4 sm:p-6 shadow-[0_10px_30px_rgba(20,42,32,.04)]"><div className="mb-5 flex items-center justify-between"><h2 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">{title}</h2>{action && <button className="flex items-center gap-1 text-sm font-semibold text-[#0b3d2e]">{action}<ChevronRight /></button>}</div>{children}</section> }

export function DashboardGreeting({ welcome, headline, description }: { welcome: string; headline: string; description: string }) {
  const { profile } = useSessionProfile()
  const name = profile?.name ?? ''
  const email = profile?.email ?? ''
  return <div><p className="text-sm text-[#718078]">{welcome.replace('{name}', firstName(name, email))}</p><h2 className="mt-1 font-serif text-2xl sm:text-4xl text-[#0b3d2e]">{headline}</h2><p className="mt-2 text-[#718078]">{description}</p></div>
}
