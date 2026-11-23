/**
 * PUBLICITÉS de l'accueil : UN seul carrousel en haut de page (maquette validée le 24 novembre 2026).
 * Contenu : src/content/home.ts → ads ; la gamme du lancement (prix membre) passe en premier si elle est active.
 *
 * - Une publicité toutes les 10 s, en fondu ; la photo zoome très lentement.
 * - La barre dorée sous le point actif se remplit en 10 s : c'est la minuterie (voir src/index.css).
 * - Accessibilité (WCAG 2.2.2) : bouton Pause toujours visible ; arrêt quand la souris est dessus, quand on
 *   navigue au clavier dedans et quand l'onglet est caché ; aucun défilement si « réduire les animations ».
 * - Toutes les publicités sont empilées au même endroit : le bloc garde la hauteur de la plus haute,
 *   la page ne « saute » pas. Les publicités cachées sont inertes (ni clic, ni clavier, ni lecteur d'écran).
 * - Le texte n'est JAMAIS posé sur la photo ; <picture> : photo verticale sur téléphone, horizontale sur ordinateur.
 * - Promotion : compteur « Plus que N » seulement s'il vient du vrai stock (une fausse urgence fait perdre la confiance).
 */
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import type { Ad } from '@/content/home'
import { currentAds } from '@/features/home/currentAds'
import { cn } from '@/lib/utils'

/** Une publicité « spéciale » placée en tête, construite ailleurs (ex. la gamme au prix membre) */
export interface LeadSlide {
  label: string
  render: (first: boolean) => ReactNode
}

/** Durée d'affichage de chaque publicité, en secondes */
export const SLIDE_SECONDS = 10

const reducedMotionQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null)
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => { const q = reducedMotionQuery(); q?.addEventListener('change', cb); return () => q?.removeEventListener('change', cb) },
    () => reducedMotionQuery()?.matches ?? false,
    () => false,
  )
}
function usePageHidden(): boolean {
  return useSyncExternalStore(
    (cb) => { document.addEventListener('visibilitychange', cb); return () => document.removeEventListener('visibilitychange', cb) },
    () => document.hidden,
    () => false,
  )
}

export function AdCarousel({ ads: allAds, lead = null }: { ads: readonly Ad[]; lead?: LeadSlide | null }) {
  // Pendant l'offre membre, la publicité « classique » de la même gamme laisse la place (pas de doublon)
  const ads = currentAds(allAds).filter((a) => !(lead && a.hiddenDuringMemberOffer))
  const slides: { label: string; render: (first: boolean) => ReactNode }[] = [
    ...(lead ? [lead] : []),
    ...ads.map((ad) => ({ label: ad.eyebrow, render: (first: boolean) => <AdSlide ad={ad} first={first} /> })),
  ]
  const count = slides.length

  const [index, setIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focusInside, setFocusInside] = useState(false)
  const reduced = usePrefersReducedMotion()
  const hidden = usePageHidden()
  const touchX = useRef<number | null>(null)

  // Une publicité disparue (date passée, offre épuisée) : on revient dans les limites
  useEffect(() => { if (index >= count && count > 0) setIndex(0) }, [index, count])
  if (count === 0) return null
  const current = Math.min(index, count - 1)
  const go = (i: number) => setIndex((i + count) % count)
  const auto = count > 1 && !reduced
  const playing = auto && !userPaused && !hovered && !focusInside && !hidden

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Offres du moment"
      data-paused={!playing}
      className="px-4 pt-4 pb-14 sm:px-6 sm:pt-10"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusInside(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusInside(false) }}
      onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null }}
      onTouchEnd={(e) => {
        const start = touchX.current
        const end = e.changedTouches[0]?.clientX
        touchX.current = null
        if (start == null || end == null || count < 2 || Math.abs(end - start) < 50) return
        go(end < start ? current + 1 : current - 1) // glisser vers la gauche = suivante
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Toutes empilées dans la même case de grille : hauteur stable, fondu par l'opacité */}
        <div className="grid">
          {slides.map((s, i) => {
            const active = i === current
            return (
              <div
                key={i}
                role="group"
                aria-roledescription="publicité"
                aria-label={`${i + 1} sur ${count} : ${s.label}`}
                aria-hidden={!active}
                inert={!active}
                data-active={active}
                className={cn('[grid-area:1/1] transition-[opacity,visibility] duration-700 ease-out',
                  active ? 'visible opacity-100' : 'invisible opacity-0')}
              >
                {s.render(i === 0)}
              </div>
            )
          })}
        </div>

        {count > 1 && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {auto && (
                <button type="button" onClick={() => setUserPaused((p) => !p)}
                  aria-label={userPaused ? 'Reprendre le défilement' : 'Mettre en pause le défilement'}
                  className="flex size-11 items-center justify-center rounded-full border border-[#444] hover:border-gold">
                  {userPaused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
                </button>
              )}
              {/* Annonce le changement seulement quand c'est la visiteuse qui le provoque (pas toutes les 10 s) */}
              <span className="text-sm text-muted" aria-live={playing ? 'off' : 'polite'}>{current + 1} / {count}</span>
            </div>
            <div className="flex items-center gap-1">
              {slides.map((s, i) => (
                <button key={i} type="button" onClick={() => go(i)} aria-label={`Publicité ${i + 1} : ${s.label}`} aria-current={i === current}
                  className="flex h-11 items-center justify-center px-1">
                  {i === current ? (
                    <span className="block h-1.5 w-11 overflow-hidden rounded-full bg-[#4a4335]">
                      {auto ? (
                        // key : la barre repart de zéro à chaque publicité ; sa fin déclenche la suivante
                        <span key={current} data-testid="carousel-progress" className="carousel-progress block h-full w-full bg-gold"
                          style={{ '--carousel-delay': `${SLIDE_SECONDS}s` } as React.CSSProperties}
                          onAnimationEnd={() => go(current + 1)} />
                      ) : <span className="block h-full w-full bg-gold" />}
                    </span>
                  ) : <span className="block size-2 rounded-full bg-[#4a4335]" />}
                </button>
              ))}
            </div>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => go(current - 1)} aria-label="Publicité précédente" className="flex size-11 items-center justify-center rounded-full border border-[#333] hover:border-gold"><ChevronLeft className="size-5" aria-hidden="true" /></button>
              <button type="button" onClick={() => go(current + 1)} aria-label="Publicité suivante" className="flex size-11 items-center justify-center rounded-full border border-[#333] hover:border-gold"><ChevronRight className="size-5" aria-hidden="true" /></button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/** Une publicité du fichier de contenu : texte à gauche, photo à droite (photo en haut sur téléphone) */
function AdSlide({ ad, first }: { ad: Ad; first: boolean }) {
  const Heading = first ? 'h1' : 'h2' // un seul titre principal par page
  return (
    <div className="flex flex-col-reverse gap-4 sm:gap-6 lg:grid lg:grid-cols-[5fr_7fr] lg:items-stretch lg:gap-12">
      <div className="flex flex-col justify-center gap-3.5 sm:gap-5">
        <span className="self-start rounded-full border border-gold px-3.5 py-1.5 text-xs font-semibold tracking-[0.12em] text-gold uppercase">{ad.eyebrow}</span>
        <Heading className="font-display text-[30px] leading-[1.08] font-semibold sm:text-5xl xl:text-[54px]">{ad.title}</Heading>
        <p className="max-w-xl text-[15px] leading-relaxed text-[#c9c4b8] sm:text-[17px]">{ad.text}</p>
        {ad.tags.length > 0 && (
          <ul aria-label="Produits de la gamme" className="hidden flex-wrap gap-2 sm:flex">
            {ad.tags.map((t) => <li key={t} className="rounded-full border border-[#333] px-3 py-1.5 text-sm text-[#e6e1d6]">{t}</li>)}
          </ul>
        )}
        {ad.price && (
          <div className="flex flex-col gap-2.5">
            <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
              <span className={cn('font-bold text-gold', ad.promo ? 'text-[28px] sm:text-[40px]' : 'text-[30px] sm:text-[34px]')}>{ad.price}</span>
              {ad.promo && (
                <>
                  {/* <s> n'est pas lu par les lecteurs d'écran : on dit « au lieu de » en texte masqué */}
                  <s className="text-base text-[#8a857b] sm:text-xl"><span className="sr-only">au lieu de </span>{ad.promo.oldPrice}</s>
                  <span className="rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-ink sm:text-[13px]">{ad.promo.saving}</span>
                </>
              )}
            </p>
            {ad.promo && ad.promo.remaining !== null && (
              <div className="flex max-w-[420px] flex-col gap-1.5">
                <p className="text-[13px] font-semibold text-[#e6e1d6] sm:text-sm">Plus que {ad.promo.remaining} gammes sur {ad.promo.limit}</p>
                <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-[#2b2516]">
                  <div className="h-full bg-gold" style={{ width: `${Math.min(100, (ad.promo.remaining / ad.promo.limit) * 100)}%` }} />
                </div>
              </div>
            )}
            {ad.note && <p className="hidden text-sm text-[#c9c4b8] sm:block">{ad.note}</p>}
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="min-h-[52px]"><Link to={ad.primary.to}>{ad.primary.label} <ArrowRight aria-hidden="true" /></Link></Button>
          {ad.secondary && <Button asChild variant="outline" className="hidden min-h-[52px] sm:inline-flex"><Link to={ad.secondary.to}>{ad.secondary.label}</Link></Button>}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[26px] border border-[#2b2516]">
        {/* La 1re photo est la plus visible de la page : chargée en priorité.
            width/height réservent la place avant le chargement : la page ne « saute » pas. */}
        <picture>
          <source media="(max-width: 1023px)" srcSet={ad.imageTall} width={1200} height={1600} />
          <img src={ad.imageWide} alt={ad.imageAlt} width={1600} height={1200} fetchPriority={first ? 'high' : 'auto'}
            className={cn('slide-photo aspect-[4/5] w-full object-cover sm:max-h-[460px] object-[center_64%] sm:aspect-[4/3] lg:aspect-auto lg:h-full lg:max-h-[600px] lg:object-[55%_58%]',
              ad.promo ? 'max-h-[280px]' : 'max-h-[330px]')} />
        </picture>
        {ad.badge && <span className="absolute bottom-4 left-4 rounded-[10px] bg-ink/85 px-3 py-2 text-[13px]">{ad.badge}</span>}
      </div>
    </div>
  )
}
