import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { MessagesInbox } from '@/components/messages-inbox'

/**
 * Halaman "Pesan".
 *
 * Tidak ada lagi data contoh. Seluruh isi halaman berasal dari tabel
 * `ai_conversations` (percakapan pengguna dengan Homy AI per objek properti).
 * Untuk akun agen/pemilik, halaman ini menjadi rekap percakapan calon pembeli
 * dengan Homy AI tentang listing mereka.
 */
export default function MessagePage() {
  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1c1c1c]">
      <SiteHeader />
      <MessagesInbox />
      <SiteFooter />
    </main>
  )
}
