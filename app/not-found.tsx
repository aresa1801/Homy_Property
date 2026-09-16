import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">404</p>
      <h1 className="text-3xl font-bold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="text-muted-foreground">
        Properti atau halaman yang Anda cari tidak tersedia, sudah dihapus, atau tautannya salah.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Ke Beranda
        </Link>
        <Link href="/buy" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
          Properti Dijual
        </Link>
        <Link href="/rent" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
          Properti Disewa
        </Link>
      </div>
    </main>
  )
}
