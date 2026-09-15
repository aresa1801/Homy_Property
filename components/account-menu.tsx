'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LayoutDashboard, LogOut, PlusCircle, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { firstName, ROLE_META, useSessionProfile, type AppRole } from '@/lib/homy-session'
import { UserAvatar } from '@/components/user-avatar'

const PRIORITY: AppRole[] = ['super_admin', 'admin', 'agent', 'property_owner', 'user']

/** Dasbor utama = peran tertinggi yang dimiliki akun. */
export function primaryDashboard(roles: AppRole[]) {
  for (const role of PRIORITY) if (roles.includes(role)) return ROLE_META[role].dashboard
  return '/dashboard/user'
}

/**
 * Menu akun di headbar publik: menampilkan foto + nama + email Google,
 * tautan ke semua dasbor yang dimiliki, dan tombol Keluar (logout).
 */
export function AccountMenu() {
  const { profile } = useSessionProfile()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function signOut() {
    if (busy) return
    setBusy(true)
    try {
      await createClient().auth.signOut()
    } catch {
      /* tetap lanjut ke halaman utama */
    } finally {
      setOpen(false)
      window.location.assign('/')
    }
  }

  if (!profile) {
    return <span className="size-9 animate-pulse rounded-full bg-white/20" aria-hidden="true" />
  }

  const roles: AppRole[] = profile.roles.length ? profile.roles : ['user']
  const dashboards = PRIORITY.filter((role) => roles.includes(role))

  return (
    <div className="relative" ref={wrapRef}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 p-1 pr-2 text-white transition hover:bg-white/20">
        <UserAvatar name={profile.name} email={profile.email} avatarUrl={profile.avatarUrl} size={32} />
        <span className="hidden max-w-[8rem] truncate text-sm font-semibold sm:block">{firstName(profile.name, profile.email)}</span>
        <ChevronDown className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-[#e5dccd] bg-white p-2 text-[#20332c] shadow-xl">
          <div className="flex items-center gap-3 border-b border-[#eee7dc] px-3 pb-3 pt-2">
            <UserAvatar name={profile.name} email={profile.email} avatarUrl={profile.avatarUrl} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#20332c]">{profile.name}</p>
              <p className="truncate text-xs text-[#718078]">{profile.email || '-'}</p>
            </div>
          </div>
          <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-[#a18a61]">Dasbor saya</p>
          {dashboards.map((role) => (
            <Link key={role} href={ROLE_META[role].dashboard} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[#f7f3ec]">
              <LayoutDashboard className="size-4 text-[#4e866d]" /> {ROLE_META[role].label}
            </Link>
          ))}
          <Link href="/onboarding" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[#f7f3ec]">
            <PlusCircle className="size-4 text-[#4e866d]" /> Tambah peran lain
          </Link>
          <Link href="/dashboard/user" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[#f7f3ec]">
            <UserRound className="size-4 text-[#4e866d]" /> Profil & aktivitas
          </Link>
          <button type="button" role="menuitem" disabled={busy} onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#b45c50] hover:bg-[#fbeeec] disabled:opacity-60">
            <LogOut className="size-4" /> {busy ? 'Keluar...' : 'Keluar'}
          </button>
        </div>
      )}
    </div>
  )
}
