'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type AppRole = 'user' | 'agent' | 'property_owner' | 'admin' | 'super_admin'

export const ROLE_META: Record<AppRole, { label: string; dashboard: string }> = {
  user: { label: 'Pengguna', dashboard: '/dashboard/user' },
  agent: { label: 'Agen', dashboard: '/dashboard/agent' },
  property_owner: { label: 'Pemilik Properti', dashboard: '/dashboard/property-owner' },
  admin: { label: 'Admin', dashboard: '/dashboard/admin' },
  super_admin: { label: 'Super Admin', dashboard: '/dashboard/super-admin' },
}

export type SessionProfile = {
  userId: string
  email: string
  name: string
  avatarUrl: string
  roles: AppRole[]
}

export function initialsFrom(name: string, email: string) {
  const source = (name || email || 'H').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function firstName(name: string, email: string) {
  const source = (name || '').trim()
  if (source) return source.split(/\s+/)[0]
  return (email || 'Pengguna').split('@')[0]
}

/** Reads the signed-in Google account (avatar + name + email) and the roles granted in user_roles. */
export function useSessionProfile() {
  const [profile, setProfile] = useState<SessionProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const supabase = createClient() as any
    supabase.auth
      .getUser()
      .then(async ({ data }: any) => {
        if (!active) return
        const user = data?.user
        if (!user) {
          setLoading(false)
          return
        }
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>
        const email = user.email ?? ''
        const name = String(meta.full_name ?? meta.name ?? email.split('@')[0] ?? 'Pengguna Homy')
        const avatarUrl = String(meta.avatar_url ?? meta.picture ?? '')
        let roles: AppRole[] = []
        try {
          const { data: rows } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
          if (Array.isArray(rows)) roles = rows.map((row: { role: AppRole }) => row.role)
        } catch {
          /* table may be unavailable in older environments */
        }
        if (!roles.includes('user')) roles = [...roles, 'user']
        if (active) {
          setProfile({ userId: user.id, email, name, avatarUrl, roles })
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { profile, loading }
}
