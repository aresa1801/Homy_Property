import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * Klien Supabase server-side (service role). Dipakai HANYA di route server setelah
 * identitas pengguna diverifikasi lewat cookie (createClient().auth.getUser()).
 * Tujuannya: memanggil RPC/kolom yang sengaja tidak dibuka ke anon/authenticated
 * (mis. `partner_sanction_state`) tanpa melemahkan least-privilege di database.
 */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
