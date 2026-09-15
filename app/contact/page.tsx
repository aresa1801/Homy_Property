import { Clock, Mail, MapPin, MessageSquare, Phone, ShieldCheck } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ContactForm } from '@/components/contact-form'

export const metadata = { title: 'Kontak — Homy Property' }

const channels = [
  { icon: Mail, title: 'Email dukungan', value: 'support@homyproperty.id', hint: 'Balasan maksimal 1×24 jam kerja', href: 'mailto:support@homyproperty.id' },
  { icon: MessageSquare, title: 'WhatsApp', value: '+62 811-0000-000', hint: 'Senin–Jumat, 09.00–18.00 WIB', href: 'https://wa.me/628110000000' },
  { icon: Phone, title: 'Telepon kantor', value: '+62 21-5000-0000', hint: 'Senin–Jumat, 09.00–17.00 WIB', href: 'tel:+622150000000' },
  { icon: MapPin, title: 'Kantor', value: 'Jakarta Selatan, Indonesia', hint: 'Kunjungan dengan perjanjian', href: '/contact' },
]

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1c1c1c]">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-5 pb-8 pt-12 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Kontak</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-5xl text-[#0b3d2e]">Kami siap membantu.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#65706c]">Ada pertanyaan tentang akun, listing, komisi, atau kerja sama institusi? Pilih kanal yang paling nyaman untuk Anda — tim Homy Property akan merespons dengan cepat.</p>
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {channels.map(({ icon: Icon, title, value, hint, href }) => (
            <a key={title} href={href} className="rounded-2xl bg-white p-4 sm:p-5 shadow-[0_10px_30px_rgba(20,42,32,.05)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(20,42,32,.1)]">
              <span className="grid size-11 place-items-center rounded-xl bg-[#edf2ed] text-[#0b3d2e]"><Icon /></span>
              <p className="mt-4 text-sm font-semibold text-[#0b3d2e]">{title}</p>
              <p className="mt-1 text-sm text-[#33433d]">{value}</p>
              <p className="mt-1 text-xs text-[#8a928e]">{hint}</p>
            </a>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 sm:gap-6 px-5 pb-16 lg:grid-cols-[1.4fr_1fr] lg:px-8">
        <ContactForm />
        <aside className="space-y-4">
          <div className="rounded-2xl bg-[#0f2a44] p-4 sm:p-6 text-white">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#c9a961] text-[#0f2a44]"><Clock /></span><p className="font-semibold">Jam operasional</p></div>
            <ul className="mt-5 space-y-2 text-sm text-white/80">
              <li>Senin–Jumat: 09.00–18.00 WIB</li>
              <li>Sabtu: 09.00–13.00 WIB</li>
              <li>Minggu & libur nasional: tutup</li>
              <li>Pelaporan fraud: 24 jam via email</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-[0_10px_30px_rgba(20,42,32,.05)]">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#edf2ed] text-[#0b3d2e]"><ShieldCheck /></span><p className="font-semibold text-[#0b3d2e]">Sebelum menghubungi</p></div>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[#33433d]">
              <li>• Cek dulu halaman <a className="underline" href="/terms">Ketentuan</a> dan <a className="underline" href="/privacy">Privasi</a>.</li>
              <li>• Soal listing yang ditolak: catatan moderator tampil di dashboard Anda.</li>
              <li>• Soal komisi: status verifikasi tampil di menu Penagihan dashboard mitra.</li>
              <li>• Untuk kerja sama agensi/institusi, gunakan halaman <a className="underline" href="/partnership">Partnership</a>.</li>
            </ul>
          </div>
        </aside>
      </section>
      <SiteFooter />
    </main>
  )
}
