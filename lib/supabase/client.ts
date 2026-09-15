import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/types'

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        // Sesi disimpan di cookie selama 30 hari supaya status login tetap
        // terbaca walau berpindah halaman atau menutup lalu membuka browser.
        cookieOptions: {
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 30,
        },
      },
    )
  }
  return client
}
