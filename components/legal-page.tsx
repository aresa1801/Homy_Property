import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export type LegalSection = { heading: string; paragraphs: string[] }

/** Kerangka halaman statis (Privasi, Ketentuan) dengan headbar & footer seragam. */
export function LegalPage({ eyebrow, title, intro, updated, sections, aside }: { eyebrow: string; title: string; intro: string; updated: string; sections: LegalSection[]; aside?: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1c1c1c]">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-5 pb-6 pt-12 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-5xl text-[#0b3d2e]">{title}</h1>
        <p className="mt-4 max-w-3xl leading-7 text-[#65706c]">{intro}</p>
        <p className="mt-3 text-xs text-[#8a928e]">Terakhir diperbarui: {updated}</p>
      </section>
      <section className="mx-auto max-w-4xl px-5 pb-16 lg:px-8">
        <div className="space-y-5 rounded-2xl bg-white p-4 sm:p-6 shadow-[0_10px_35px_rgba(20,42,32,.06)] lg:p-9">
          {sections.map((section, index) => (
            <article key={section.heading} className="border-b border-[#f0e9df] pb-5 last:border-0 last:pb-0">
              <h2 className="font-serif text-xl sm:text-2xl text-[#0b3d2e]">{index + 1}. {section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="mt-3 leading-7 text-[#33433d]">{paragraph}</p>
              ))}
            </article>
          ))}
          <p className="rounded-xl bg-[#f7f3ec] p-4 text-sm leading-6 text-[#33433d]">
            Pertanyaan tentang dokumen ini? Hubungi kami di <a className="font-semibold text-[#0b3d2e] underline" href="mailto:support@homyproperty.id">support@homyproperty.id</a> atau melalui halaman <a className="font-semibold text-[#0b3d2e] underline" href="/contact">Kontak</a>.
          </p>
          {aside ? <div className="mt-5">{aside}</div> : null}
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
