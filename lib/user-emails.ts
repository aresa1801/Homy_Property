/**
 * Ambil email pengguna dalam SATU query (public.user_emails) sebagai ganti
 * memanggil Admin Auth API per-user (`auth.admin.getUserById`). Untuk daftar
 * besar (dashboard admin sampai ratusan id) ini memangkas ratusan round-trip
 * jaringan menjadi satu query DB.
 *
 * `user_emails` disinkronkan dari auth.users oleh trigger `trg_sync_user_email`
 * dan hanya bisa dibaca service_role (RLS aktif tanpa policy) → email tidak bocor.
 */
export async function emailsFor(
  admin: unknown,
  ids: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]))
  if (!admin || unique.length === 0) return map
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from('user_emails')
      .select('user_id,email')
      .in('user_id', unique)
    for (const row of (data ?? []) as Array<{ user_id: string; email: string | null }>) {
      if (row.email) map.set(row.user_id, row.email)
    }
  } catch {
    /* email opsional — jangan gagalkan seluruh permintaan */
  }
  return map
}
