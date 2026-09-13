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

      if (email === 'rahadhyan@gmail.com') {
        await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            full_name: data.user.user_metadata?.full_name ?? 'Rahadhyan',
            role: 'super_admin',
          },
          { onConflict: 'id' },
        )
      }

      return NextResponse.redirect(new URL(destination, requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL('/auth/error', requestUrl.origin))
}
