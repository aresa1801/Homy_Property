import { ArrowRight, BadgeCheck, CheckCircle2, FileSignature, Handshake, LayoutDashboard, LineChart, Megaphone, Network, Scale, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BcaPaymentCard } from '@/components/bca-payment-card'
import { PartnershipForm } from '@/components/partnership-form'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbLd, faqLd, pageMetadata } from '@/lib/seo'
import { PUBLIC_PARTNER_KIND_ORDER, PARTNER_KINDS } from '@/lib/partnership'
import type { Metadata } from 'next'

export const metadata: Metadata = pageMetadata({
  title: 'Open Partnership — Agensi, Institusi & Notaris',
  description:
    'Bergabung sebagai mitra Homy Property: agensi/broker properti, institusi korporat, hingga notaris/PPAT. Biaya bergabung Rp 0, verifikasi 1×24 jam, dashboard listing, prospek, dan komisi.',
  path: '/partnership',
  keywords: ['kemitraan agen properti', 'partner properti', 'kerja sama notaris PPAT', 'agensi properti Indonesia'],
})

type PublicPartnerKind = (typeof PUBLIC_PARTNER_KIND_ORDER)[number]

const KIND_ICON: Record<PublicPartnerKind, LucideIcon> = { agency: Network, institution: Handshake, notary: Scale }

const TYPES = PUBLIC_PARTNER_KIND_ORDER.map((kind) => ({ key: kind, icon: KIND_ICON[kind], ...PARTNER_KINDS[kind] }))

const NOTARY_POINTS = [
  'Prioritas penanganan AJB, PPAT, dan akta transaksi properti yang lahir dari platform Homy.',
  'Referensi klien timbal balik: Homy mengarahkan pembeli/penyewa yang butuh legalitas, Anda dapat mengarahkan klien yang mencari properti.',
  'Profil mitra legal resmi (nama kantor, wilayah kerja, layanan) tayang di direktori mitra Homy.',
  'Tanpa biaya bergabung — kolaborasi murni berbasis rujukan dan kualitas layanan.',
]

const STEPS = [
  { icon: FileSignature, title: '1. Daftar & verifikasi', body: 'Isi formulir kemitraan, tim Homy memverifikasi identitas dan legalitas usaha maksimal 1×24 jam kerja.' },
  { icon: BadgeCheck, title: '2. Tanda tangan perjanjian', body: 'Anda menandatangani Surat Perjanjian Kerja Sama digital: ruang lingkup, skema komisi sesuai jenis kemitraan, dan kewajiban pelaporan transaksi.' },
  { icon: Sparkles, title: '3. Unggah inventaris & profil', body: 'Lengkapi data properti pada form komprehensif yang terbaca AI, atau sambungkan inventaris lewat integrasi API/CSV untuk agensi dan institusi.' },
  { icon: LineChart, title: '4. Transaksi & lapor', body: 'Kelola prospek dan cabang dari dashboard, tutup transaksi, lalu laporkan maksimal 3 hari kerja untuk perhitungan komisi dan kepatuhan.' },
]

const INSTITUTIONS = ['Ray White', 'LJ Hooker', 'Century 21', 'ERA Indonesia', 'RE/MAX', 'Colliers']

const FEATURES = [
  { icon: LayoutDashboard, title: 'Dashboard multi-cabang', body: 'Setiap cabang punya halaman sendiri: listing, prospek, kunjungan, dan laporan komisi per agent.' },
  { icon: Megaphone, title: 'Feed & co-branding', body: 'Inventaris agensi tayang di Homy dengan atribusi brand Anda, plus halaman partner resmi.' },
  { icon: Users, title: 'Manajemen tim', body: 'Undang agent ke bawah satu payung agensi, atur peran, dan pantau produktivitas masing-masing.' },
  { icon: ShieldCheck, title: 'Kepatuhan & audit', body: 'Jejak audit lengkap untuk setiap moderasi listing, verifikasi komisi, dan perubahan data mitra.' },
]

const COMMISSION_ROWS: [string, string, string][] = [
  ['Agensi / Broker', 'Bertingkat', 'dibahas saat onboarding'],
  ['Institusi Korporat', 'Skema khusus', 'dibahas saat onboarding'],
  ['Notaris & PPAT', 'Referensi', 'tanpa biaya bergabung'],
]

const OBLIGATIONS = [
  'Menandatangani Surat Perjanjian Kerja Sama digital',
  'Menyajikan data properti & profil mitra yang benar, tidak menyesatkan',
  'Melaporkan setiap transaksi maksimal 3 hari kerja',
  'Menjaga kerahasiaan data calon pembeli/penyewa',
]

const FAQ = [
  { q: 'Apakah ada biaya bergabung?', a: 'Tidak. Pendaftaran mitra Homy Property gratis tanpa biaya langganan. Kemitraan notaris/PPAT murni berbasis rujukan timbal balik, sementara komisi platform hanya berlaku pada transaksi properti yang berhasil diselesaikan melalui platform.' },
  { q: 'Bagaimana skema komisi untuk agensi & institusi?', a: 'Skema dibahas saat onboarding dan dapat bertingkat sesuai volume transaksi serta cakupan cabang. Setiap mitra memperoleh laporan komisi per cabang dan dukungan account manager khusus.' },
  { q: 'Apakah Homy bekerja sama dengan notaris atau PPAT?', a: 'Ya. Kami membuka kemitraan dengan notaris, PPAT, dan kantor hukum properti. Transaksi yang berjalan di Homy dapat diarahkan ke mitra notaris untuk pengurusan AJB, PPAT, dan balik nama, dan sebaliknya klien notaris dapat mencari properti di Homy. Pilih jenis kemitraan "Notaris / PPAT & Mitra Legal" saat mengajukan.' },
  { q: 'Apakah inventaris bisa disambungkan otomatis?', a: 'Bisa. Untuk agensi dan institusi kami menyediakan integrasi API/CSV serta feed listing terpusat, termasuk dukungan co-branding berupa halaman partner resmi dan atribusi brand Anda di setiap listing.' },
  { q: 'Bagaimana jika listing saya ditolak moderator?', a: 'Catatan moderator tampil di dashboard Anda dan listing dapat diajukan ulang setelah diperbaiki. Kami hanya menolak listing yang tidak akurat, duplikat, atau melanggar ketentuan.' },
  { q: 'Apakah transaksi wajib dilaporkan?', a: 'Ya. Perjanjian kerja sama mewajibkan pelaporan setiap transaksi maksimal 3 hari kerja sebagai dasar perhitungan komisi dan kepatuhan platform.' },
  { q: 'Bisakah kemitraan dihentikan kapan saja?', a: 'Bisa, tanpa ikatan jangka waktu minimum. Mitra cukup menyelesaikan transaksi yang masih berjalan dan kewajiban pelaporan sebelum kerja sama ditutup.' },
  { q: 'Bisakah mengajukan lebih dari satu jenis kemitraan?', a: 'Bisa. Misalnya agensi yang punya unit legal in-house dapat mengajukan jalur agensi sekaligus notaris/PPAT. Tim partnership memverifikasi tiap jalur dan menyiapkan perjanjian sesuai kebutuhan.' },
  { q: 'Bagaimana memantau performa & status komisi?', a: 'Setiap mitra mendapat dashboard: listing, prospek, jadwal kunjungan, transaksi yang dilaporkan, hingga status verifikasi komisi per cabang — lengkap dengan riwayat audit.' },
]

export default function PartnershipPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1c1c1c]">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Beranda', path: '/' },
          { name: 'Open Partnership', path: '/partnership' },
        ])}
      />
      <JsonLd data={faqLd(FAQ)} />
      <SiteHeader />
      <section className="relative bg-[#0b3d2e] py-10 sm:py-16 text-white md:py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c9a961]">Open Partnership</p>
          <h1 className="mt-3 max-w-3xl font-serif text-2xl sm:text-4xl leading-tight md:text-6xl">Tumbuh bersama Homy Property.</h1>
          <p className="mt-5 max-w-2xl leading-8 text-white/75">Bergabung sebagai agensi/broker properti, institusi korporat, hingga notaris/PPAT. Satu platform untuk listing, prospek, komisi, legalitas, dan pelaporan — dengan biaya bergabung Rp 0.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#daftar" className="inline-flex items-center gap-2 rounded-full bg-[#c9a961] px-6 py-3 text-sm font-semibold text-[#0b3d2e] transition hover:bg-[#e1c67e]">Daftar sekarang <ArrowRight className="size-4" /></a>
            <a href="#institusi" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Kerjasama institusi</a>
            <a href="#notaris" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Kemitraan notaris</a>
          </div>
          <div className="mt-8 sm:mt-12 grid gap-4 border-t border-white/15 pt-8 sm:grid-cols-2 xl:grid-cols-4">
            {[['Rp 0', 'Biaya bergabung'], ['1×24 jam', 'Verifikasi mitra'], ['Bertingkat', 'Skema komisi mitra'], ['3 hari kerja', 'Batas lapor transaksi']].map(([value, text]) => (
              <div key={text}><p className="font-serif text-2xl sm:text-3xl text-[#c9a961]">{value}</p><p className="mt-1 text-sm text-white/70">{text}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-9 sm:py-14 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Jenis kemitraan</p>
          <h2 className="mt-2 font-serif text-2xl sm:text-4xl text-[#0b3d2e]">Pilih jalur yang paling sesuai.</h2>
          <p className="mt-4 leading-7 text-[#65706c]">Tiga jalur kemitraan untuk organisasi dan profesional properti: jaringan agensi/broker, institusi korporat, serta mitra legal notaris/PPAT.</p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {TYPES.map(({ icon: Icon, short, commission, blurb, highlights }) => (
            <article key={short} className="flex flex-col rounded-2xl bg-white p-5 shadow-[0_10px_35px_rgba(20,42,32,.06)] sm:p-7">
              <span className="grid size-12 place-items-center rounded-xl bg-[#edf2ed] text-[#0b3d2e]"><Icon /></span>
              <h3 className="mt-5 font-serif text-xl text-[#0b3d2e] sm:text-2xl">{short}</h3>
              <span className="mt-2 w-fit rounded-full bg-[#fff7e3] px-3 py-1 text-xs font-semibold text-[#9b762a]">{commission}</span>
              <p className="mt-3 text-sm leading-6 text-[#65706c]">{blurb}</p>
              <ul className="mt-4 space-y-2 border-t border-[#f0e9df] pt-4">
                {highlights.map((point) => <li key={point} className="flex gap-2 text-sm text-[#33433d]"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#4e866d]" />{point}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="institusi" className="border-y border-[#e8dfd3] bg-[#fbf8f3] py-9 sm:py-14">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-6 sm:gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Kerjasama institusi</p>
              <h2 className="mt-2 font-serif text-2xl sm:text-4xl text-[#0b3d2e]">Untuk agensi properti &amp; institusi.</h2>
              <p className="mt-4 leading-7 text-[#65706c]">Kami membuka kerja sama dengan jaringan agensi properti nasional maupun internasional — Ray White, LJ Hooker, Century 21, ERA, RE/MAX, dan sejenisnya — hingga institusi korporat seperti developer, bank, dan koperasi.</p>
              <p className="mt-4 leading-7 text-[#65706c]">Skema komisi institusi dibahas terpisah (bertingkat sesuai volume), dengan dukungan account manager khusus, onboarding tim, dan pelaporan komisi per cabang.</p>
              <div className="mt-5 sm:mt-7 flex flex-wrap gap-2">
                {INSTITUTIONS.map((name) => <span key={name} className="rounded-full border border-[#e5dccd] bg-white px-4 py-2 text-sm font-semibold text-[#0b3d2e]">{name}</span>)}
              </div>
              <p className="mt-4 text-xs text-[#8a928e]">Contoh jaringan yang umum beroperasi di Indonesia. Homy Property tidak berafiliasi dengan merek tersebut.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl bg-white p-4 sm:p-5 shadow-[0_10px_30px_rgba(20,42,32,.05)]">
                  <span className="grid size-10 place-items-center rounded-lg bg-[#edf2ed] text-[#0b3d2e]"><Icon /></span>
                  <p className="mt-4 font-semibold text-[#0b3d2e]">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#65706c]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="notaris" className="border-y border-[#e8dfd3] bg-[#0b3d2e] py-9 text-white sm:py-14">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 sm:gap-10 lg:grid-cols-[1fr_1fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c9a961]">Kemitraan notaris &amp; PPAT</p>
            <h2 className="mt-2 font-serif text-2xl leading-tight sm:text-4xl">Legalitas transaksi jadi lebih mudah.</h2>
            <p className="mt-4 leading-7 text-white/75">Homy Property membuka kemitraan dengan notaris, PPAT, dan kantor hukum properti. Setiap transaksi jual-beli yang berjalan di platform dapat diarahkan ke mitra notaris untuk pengurusan akta, PPAT, dan balik nama — begitu pula sebaliknya, klien notaris yang mencari properti dapat menemukannya di Homy.</p>
            <p className="mt-4 leading-7 text-white/75">Isi formulir kemitraan dengan memilih jenis <strong className="text-[#f6e2a8]">Notaris / PPAT &amp; Mitra Legal</strong>, lengkapi wilayah kerja dan layanan legal Anda (AJB, PPAT, legal review, sewa/PPJB, pendirian badan usaha, waris &amp; hibah).</p>
            <a href="#daftar" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#c9a961] px-6 py-3 text-sm font-semibold text-[#0b3d2e] transition hover:bg-[#e1c67e]">Ajukan kemitraan notaris <ArrowRight className="size-4" /></a>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 sm:p-6">
            <p className="font-serif text-xl text-[#f6e2a8] sm:text-2xl">Yang Anda dapatkan</p>
            <ul className="mt-4 space-y-3">
              {NOTARY_POINTS.map((point) => <li key={point} className="flex gap-3 text-sm leading-6 text-white/80"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#c9a961]" />{point}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-9 sm:py-14 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Alur kemitraan</p>
        <h2 className="mt-2 font-serif text-2xl sm:text-4xl text-[#0b3d2e]">Empat langkah, tanpa ribet.</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex h-full flex-col rounded-2xl bg-white p-4 sm:p-6 shadow-[0_10px_30px_rgba(20,42,32,.05)]">
              <span className="grid size-11 place-items-center rounded-full bg-[#0b3d2e] text-[#c9a961]"><Icon /></span>
              <h3 className="mt-4 font-semibold text-[#0b3d2e]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#65706c]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-16 sm:gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-stretch lg:px-8">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="rounded-2xl bg-[#0f2a44] p-4 sm:p-6 text-white md:p-8">
            <h3 className="font-serif text-xl sm:text-2xl">Skema komisi &amp; kewajiban</h3>
            <p className="mt-2 text-sm leading-6 text-white/65">Berlaku untuk agensi/broker, institusi korporat, dan mitra legal — tanpa biaya bergabung.</p>
            <div className="mt-5 space-y-3">
              {COMMISSION_ROWS.map(([role, rate, note]) => (
                <div key={role} className="flex items-center justify-between gap-4 rounded-xl bg-white/10 px-4 py-3">
                  <div><p className="font-semibold">{role}</p><p className="text-xs text-white/60">{note}</p></div>
                  <p className="font-serif text-xl sm:text-2xl text-[#f6e2a8]">{rate}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[.14em] text-[#c9a961]">Kewajiban mitra</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              {OBLIGATIONS.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#c9a961]" />{item}</li>)}
            </ul>
          </div>
          <BcaPaymentCard subtitle="Bayar komisi Homy setelah properti berhasil terjual atau tersewa" />
          <div className="flex flex-1 flex-col rounded-2xl bg-white p-4 sm:p-6 shadow-[0_10px_30px_rgba(20,42,32,.05)] md:p-8">
            <h3 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">Pertanyaan umum</h3>
            <div className="mt-5 flex flex-1 flex-col justify-between gap-4">
              {FAQ.map((item) => (
                <div key={item.q} className="border-b border-[#f0e9df] pb-4 last:border-0 last:pb-0">
                  <p className="font-semibold text-[#20332c]">{item.q}</p>
                  <p className="mt-1.5 text-sm leading-6 text-[#65706c]">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <PartnershipForm />
      </section>
      <SiteFooter />
    </main>
  )
}
