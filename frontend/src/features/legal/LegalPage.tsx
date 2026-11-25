/**
 * PAGES LÉGALES (maquette validée le 25 novembre 2026) : mentions légales, conditions de vente, confidentialité.
 * Le texte vit dans src/content/legal.ts. Les « [À COMPLÉTER : …] » sont surlignés en jaune tant qu'ils ne sont
 * pas remplis : impossible de les oublier avant le lancement.
 */
import { Link, useLocation } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { type LegalPage as Page, legalPages } from '@/content/legal'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { cn } from '@/lib/utils'

/** Le texte, avec les cases à compléter surlignées */
function Text({ value }: { value: string }) {
  const parts = value.split(/(\[À COMPLÉTER : [^\]]+\])/)
  return <>{parts.map((p, i) => p.startsWith('[À COMPLÉTER') ? <mark key={i} className="rounded bg-[#fde68a] px-1 text-[#78350f]">{p}</mark> : p)}</>
}

/** Paragraphes : les lignes « • … » consécutives deviennent une liste */
function Paragraphs({ items }: { items: string[] }) {
  const blocks: (string | string[])[] = []
  for (const t of items) {
    if (t.startsWith('• ')) {
      const last = blocks.at(-1)
      if (Array.isArray(last)) last.push(t.slice(2))
      else blocks.push([t.slice(2)])
    } else blocks.push(t)
  }
  return <>{blocks.map((b, i) => Array.isArray(b)
    ? <ul key={i} className="flex list-disc flex-col gap-1 pl-5">{b.map((li) => <li key={li}><Text value={li} /></li>)}</ul>
    : <p key={i}><Text value={b} /></p>)}</>
}

export function LegalPage() {
  const slug = useLocation().pathname.replace(/^\//, '')
  const page: Page | undefined = legalPages.find((p) => p.slug === slug)
  if (!page) return <NotFoundPage />
  return (
    <div className="px-4 pt-10 pb-24 sm:px-6">
      <Seo title={page.title} description={page.intro} />
      <article className="mx-auto flex max-w-3xl flex-col gap-5 text-[15px] leading-relaxed text-[#e6e1d6]">
        <nav aria-label="Pages légales" className="flex flex-wrap gap-2">
          {legalPages.map((p) => (
            <Link key={p.slug} to={`/${p.slug}`} aria-current={p.slug === slug ? 'page' : undefined}
              className={cn('min-h-10 rounded-full px-4 py-2 text-sm', p.slug === slug ? 'bg-gold font-semibold text-ink' : 'border border-[#3a3a3a] hover:border-gold')}>
              {p.title}
            </Link>
          ))}
        </nav>
        <h1 className="font-display text-4xl font-semibold text-ivory">{page.title}</h1>
        <p className="text-sm text-muted">Mise à jour le {page.updated}</p>
        <p>{page.intro}</p>
        {page.sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-2.5">
            <h2 className="text-lg font-semibold text-ivory">{s.title}</h2>
            <Paragraphs items={s.paragraphs} />
          </section>
        ))}
      </article>
    </div>
  )
}
