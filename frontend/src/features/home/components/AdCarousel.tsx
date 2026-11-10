/**
 * PUBLICITÉS de l'accueil (maquette validée le 10 novembre 2026). Contenu : src/content/home.ts → ads.
 *
 * - Le texte n'est JAMAIS posé sur la photo : il reste lisible quelle que soit l'image.
 * - <picture> : le navigateur télécharge la photo verticale sur téléphone, l'horizontale sur ordinateur.
 * - Pas de défilement automatique : une publicité qui change pendant la lecture gêne tout le monde,
 *   et surtout les personnes qui lisent lentement ou utilisent un lecteur d'écran (WCAG 2.2.2).
 *   La visiteuse change de publicité avec les flèches ou les points (de vrais boutons : accessibles au clavier).
 */
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { homeContent } from '@/content/home'
import { cn } from '@/lib/utils'

export type Ad = (typeof homeContent.ads)[number]

export function AdCarousel({ ads }: { ads: readonly Ad[] }) {
  const [index, setIndex] = useState(0)
  const count = ads.length
  const ad = ads[Math.min(index, count - 1)]
  if (!ad) return null
  const go = (i: number) => setIndex((i + count) % count)

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Offres du moment"
      className="px-4 pt-4 pb-14 sm:px-6 sm:pt-10"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div
          role="group"
          aria-roledescription="publicité"
          aria-label={`${index + 1} sur ${count} : ${ad.title}`}
          className="flex flex-col-reverse gap-4 sm:gap-6 lg:grid lg:grid-cols-[5fr_7fr] lg:items-stretch lg:gap-12"
        >
          <div className="flex flex-col justify-center gap-3.5 motion-safe:animate-fade-up sm:gap-5">
            <span className="self-start rounded-full border border-gold px-3.5 py-1.5 text-xs font-semibold tracking-[0.12em] text-gold uppercase">{ad.eyebrow}</span>
            <h1 className="font-display text-[30px] leading-[1.08] font-semibold sm:text-5xl xl:text-[54px]">{ad.title}</h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-[#c9c4b8] sm:text-[17px]">{ad.text}</p>
            {ad.tags.length > 0 && (
              <ul aria-label="Produits de la gamme" className="hidden flex-wrap gap-2 sm:flex">
                {ad.tags.map((t) => <li key={t} className="rounded-full border border-[#333] px-3 py-1.5 text-sm text-[#e6e1d6]">{t}</li>)}
              </ul>
            )}
            {ad.price && <p className="text-[30px] font-bold text-gold sm:text-[34px]">{ad.price}</p>}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="min-h-[52px]"><Link to={ad.primary.to}>{ad.primary.label} <ArrowRight aria-hidden="true" /></Link></Button>
              {ad.secondary && <Button asChild variant="outline" className="hidden min-h-[52px] sm:inline-flex"><Link to={ad.secondary.to}>{ad.secondary.label}</Link></Button>}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[26px] border border-[#2b2516]">
            {/* Image la plus visible de la page : chargée en priorité, jamais en différé.
                width/height réservent la place avant le chargement : la page ne « saute » pas. */}
            <picture>
              <source media="(max-width: 1023px)" srcSet={ad.imageTall} width={1200} height={1600} />
              <img src={ad.imageWide} alt={ad.imageAlt} width={1600} height={1200} fetchPriority={index === 0 ? 'high' : 'auto'}
                className="aspect-[4/5] max-h-[330px] w-full object-cover sm:max-h-[460px] object-[center_64%] sm:aspect-[4/3] lg:aspect-auto lg:h-full lg:max-h-[600px] lg:object-[55%_58%]" />
            </picture>
            {ad.badge && <span className="absolute bottom-4 left-4 rounded-[10px] bg-ink/85 px-3 py-2 text-[13px]">{ad.badge}</span>}
          </div>
        </div>

        {count > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted" aria-live="polite">{index + 1} / {count}</span>
            <div className="flex items-center gap-1">
              {ads.map((a, i) => (
                <button key={a.title} type="button" onClick={() => go(i)} aria-label={`Publicité ${i + 1} : ${a.title}`} aria-current={i === index}
                  className="flex h-11 w-9 items-center justify-center">
                  <span className={cn('block h-2 rounded-full transition-all', i === index ? 'w-7 bg-gold' : 'w-2 bg-[#4a4335]')} />
                </button>
              ))}
            </div>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => go(index - 1)} aria-label="Publicité précédente" className="flex size-11 items-center justify-center rounded-full border border-[#333] hover:border-gold"><ChevronLeft className="size-5" aria-hidden="true" /></button>
              <button type="button" onClick={() => go(index + 1)} aria-label="Publicité suivante" className="flex size-11 items-center justify-center rounded-full border border-[#333] hover:border-gold"><ChevronRight className="size-5" aria-hidden="true" /></button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
