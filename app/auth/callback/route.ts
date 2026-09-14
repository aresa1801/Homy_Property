import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const email = data.user.email?.trim().toLowerCase()
      const destination = next

      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
      const fullName = String(meta.full_name ?? meta.name ?? email?.split('@')[0] ?? 'Pengguna Homy')
      const avatarUrl = String(meta.avatar_url ?? meta.picture ?? '') || null
      const isSuperAdmin = email === 'rahadhyan@gmail.com'

      // Capture the Google name + avatar on the profile so every dashboard shows the right identity.
      await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          full_name: fullName,
          avatar_url: avatarUrl,
          role: isSuperAdmin ? 'super_admin' : 'user',
        },
        { onConflict: 'id' },
      )

      // Every account always holds the base "user" role; extra roles are added in onboarding.
      const roles: string[] = ['user']
      if (isSuperAdmin) roles.push('super_admin')
      await (supabase as any)
        .from('user_roles')
        .upsert(roles.map((role) => ({ user_id: data.user!.id, role, status: 'active' })), { onConflict: 'user_id,role' })

      return NextResponse.redirect(new URL(destination, requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL('/auth/error', requestUrl.origin))
}
