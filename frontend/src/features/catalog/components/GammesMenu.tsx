/**
 * MENU « GAMMES » DE L'EN-TÊTE (maquette validée le 24 novembre 2026).
 * Un clic ouvre le panneau sans quitter la page :
 * - ordinateur : les gammes en bande horizontale (image, nom, à qui elle s'adresse, contenu, prix), flèches pour défiler ;
 * - téléphone : une liste comme le panier (image à gauche, description à droite).
 * Filtres par base et par public, construits avec les gammes présentes. Les gammes viennent du catalogue (ERP) :
 * une gamme créée par Awa apparaît toute seule. Fermeture : Échap, clic dehors, re-clic, ou changement de page.
 */
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductSummary } from '@/types/api'
import { gammeFilters, GAMME_FILTERS } from '../gammeFilters'
import { useProducts } from '../hooks'

export function GammesMenu({ variant }: { variant: 'desktop' | 'mobile' }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLUListElement>(null)
  const panelId = useId()
  const location = useLocation()
  // Chargées à la première ouverture seulement : l'en-tête reste léger pour toutes les pages
  const [wanted, setWanted] = useState(false)
  const gammes = useProducts({ category: 'gammes', sort: 'newest' }, { enabled: wanted })

  useEffect(() => { setOpen(false) }, [location.pathname, location.search])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onClick = (e: MouseEvent) => { if (!wrapper.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open])

  const list = (gammes.data?.data ?? []).filter((g) => g.is_bundle)
  const filters = gammeFilters(list)
  const shown = filter ? list.filter(GAMME_FILTERS.find((f) => f.label === filter)!.match) : list
  const scroll = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * 316, behavior: 'smooth' })

  return (
    <div ref={wrapper} className={variant === 'mobile' ? 'md:hidden' : 'hidden md:block'}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onMouseEnter={() => setWanted(true)}
        onFocus={() => setWanted(true)}
        onClick={() => { setWanted(true); setOpen((o) => !o) }}
        className={variant === 'mobile'
          ? cn('flex min-h-11 items-center gap-1 rounded-full px-3.5 text-sm font-bold', open ? 'bg-gold text-ink' : 'border border-gold text-gold')
          : cn('flex items-center gap-1.5 border-b-2 py-2 text-[15px] font-medium', open ? 'border-gold text-gold' : 'border-transparent hover:text-gold')}
      >
        Gammes <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <section id={panelId} aria-label="Nos gammes"
          className="absolute inset-x-0 top-full border-b border-[#2b2516] bg-[#141414] shadow-[0_24px_48px_rgba(0,0,0,.55)]">
          <div className="mx-auto flex max-h-[75vh] max-w-7xl flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-6 md:py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {filters.length > 1 && (
                <div role="group" aria-label="Filtrer les gammes" className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
                  <FilterChip label={`Toutes (${list.length})`} active={!filter} onClick={() => setFilter(null)} />
                  {filters.map((f) => <FilterChip key={f.label} label={f.label} active={filter === f.label} onClick={() => setFilter(f.label)} />)}
                </div>
              )}
              <div className="ml-auto hidden items-center gap-2.5 md:flex">
                <Link to="/boutique?category=gammes" className="text-sm font-semibold text-gold hover:underline">Voir toutes les gammes</Link>
                <button type="button" onClick={() => scroll(-1)} aria-label="Gammes précédentes" className="grid size-10 place-items-center rounded-full border border-[#3a3a3a] hover:border-gold"><ChevronLeft className="size-4" aria-hidden="true" /></button>
                <button type="button" onClick={() => scroll(1)} aria-label="Gammes suivantes" className="grid size-10 place-items-center rounded-full border border-[#3a3a3a] hover:border-gold"><ChevronRight className="size-4" aria-hidden="true" /></button>
              </div>
            </div>

            {gammes.isPending ? <p className="py-6 text-center text-sm text-muted">Chargement des gammes…</p>
              : gammes.isError ? <p className="py-6 text-center text-sm text-muted">Les gammes n’ont pas pu être chargées. <Link to="/boutique?category=gammes" className="text-gold underline">Voir la boutique</Link></p>
                : (
                  <ul ref={strip} className="flex flex-col gap-2.5 md:snap-x md:flex-row md:gap-4 md:overflow-x-auto md:pb-2">
                    {shown.map((g) => <GammeItem key={g.id} gamme={g} />)}
                  </ul>
                )}
            <Link to="/boutique?category=gammes" className="py-2 text-center text-sm font-semibold text-gold md:hidden">Voir les {list.length} gammes</Link>
          </div>
        </section>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn('min-h-10 shrink-0 rounded-full px-4 text-sm', active ? 'bg-gold font-semibold text-ink' : 'border border-[#3a3a3a] text-[#e6e1d6] hover:border-gold')}>
      {label}
    </button>
  )
}

/** Une gamme : carte verticale sur ordinateur, ligne façon panier sur téléphone */
function GammeItem({ gamme: g }: { gamme: ProductSummary }) {
  const out = g.stock_status === 'out_of_stock'
  // Une gamme en rupture n'est pas mise en avant (ni cadre doré ni badge) : on ne pousse pas ce qu'on ne peut pas vendre
  const member = !out && g.member_price != null && g.member_offer && g.member_offer.status !== 'none' && g.member_offer.status !== 'sold_out'
  const promo = g.promotion?.applies ? g.promotion : null
  return (
    <li className="md:w-[300px] md:shrink-0 md:snap-start">
      <Link to={`/produits/${g.slug}`}
        className={cn('flex h-full items-center gap-3 rounded-2xl bg-ink p-2.5 hover:border-gold md:flex-col md:items-stretch md:gap-0 md:overflow-hidden md:p-0',
          member ? 'border-2 border-gold' : 'border border-[#2b2516]')}>
        <span className="relative size-[76px] shrink-0 overflow-hidden rounded-xl bg-[#1a1712] md:h-40 md:w-full md:rounded-none">
          {g.image_url
            ? <img src={g.image_url} alt="" loading="lazy" className="size-full object-cover" />
            : <span aria-hidden="true" className="grid size-full place-items-center font-display text-lg text-gold md:text-3xl">Dabo Hair</span>}
          {member && <span className="absolute top-2.5 left-2.5 hidden rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold tracking-wider text-ink uppercase md:block">Prix membre</span>}
        </span>
        <span className="flex min-w-0 flex-col gap-1 md:p-3.5">
          <span className="text-[10px] font-bold tracking-[0.12em] text-gold uppercase md:text-[11px]">{g.name}</span>
          {g.short_description && <strong className="line-clamp-2 text-[15px] leading-snug md:font-display md:text-lg md:font-semibold">{g.short_description}</strong>}
          {g.bundle_contents && <span className="line-clamp-2 text-xs text-[#c9c4b8] md:text-[13px]">{g.bundle_contents.join(' · ')}</span>}
          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            {out ? <span className="text-sm font-semibold text-[#c9c4b8]">Bientôt de retour</span>
              : member ? <><strong className="text-gold">{formatPrice(g.member_price!)}</strong><s className="text-xs text-[#8a857b]"><span className="sr-only">au lieu de </span>{formatPrice(g.price)}</s><span className="text-xs text-[#c9c4b8]">membres</span></>
                : promo ? <><strong className="text-gold">{formatPrice(promo.price)}</strong><s className="text-xs text-[#8a857b]"><span className="sr-only">au lieu de </span>{formatPrice(g.price)}</s></>
                  : <strong className="text-gold">{formatPrice(g.price)}</strong>}
          </span>
        </span>
      </Link>
    </li>
  )
}
