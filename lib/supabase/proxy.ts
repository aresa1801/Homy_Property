import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  // Tanpa cookie sesi Supabase, tidak ada yang perlu disegarkan → hindari
  // round-trip ke Supabase Auth di setiap request anonim (mayoritas trafik).
  const hasSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && /-auth-token(\.\d+)?$/.test(cookie.name))
  if (!hasSession) return response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30,
      },
      cookies: { getAll: () => request.cookies.getAll(), setAll: (cookies) => cookies.forEach(({ name, value, options }) => { request.cookies.set(name, value); response.cookies.set(name, value, options) }) } },
  )
  await supabase.auth.getUser()
  return response
}
