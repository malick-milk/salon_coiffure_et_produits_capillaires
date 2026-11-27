/**
 * PAGE « NOS GAMMES » (maquette validée le 27 novembre 2026). Remplace le panneau déroulant de l'en-tête, jugé
 * encombrant : « Gammes » dans l'en-tête est maintenant un simple lien vers /gammes.
 * - toutes les gammes publiées d'un coup d'œil : 4 par ligne sur ordinateur, une liste façon panier sur téléphone ;
 * - filtres par base, public et petits prix, construits avec les gammes présentes (gammeFilters.ts) ;
 * - « Ajouter au panier » directement sur la carte ; une gamme en rupture reste visible, grisée ;
 * - « Pas sûre ? » ouvre le questionnaire « Quelle gamme pour moi ? » sur la page.
 * Les gammes viennent du catalogue : une gamme créée dans l'ERP apparaît toute seule.
 */
import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart } from '@/features/cart/store'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import { cn } from '@/lib/utils'
import type { ProductSummary } from '@/types/api'
import { GammeQuiz } from '../components/GammeQuiz'
import { gammeFilters, GAMME_FILTERS } from '../gammeFilters'
import { useProducts } from '../hooks'

export function GammesPage() {
  const gammes = useProducts({ category: 'gammes', sort: 'newest' })
  const [filter, setFilter] = useState<string | null>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  const list = (gammes.data?.data ?? []).filter((g) => g.is_bundle)
  const filters = gammeFilters(list)
  const shown = filter ? list.filter(GAMME_FILTERS.find((f) => f.label === filter)!.match) : list
  const more = (gammes.data?.meta.last_page ?? 1) > 1

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 md:gap-6 md:py-10">
      <Seo title="Nos gammes" description="Les gammes Dabo Hair : une routine complète, prête à l’emploi, moins chère que les soins achetés séparément." />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-[32px] font-semibold md:text-[44px]">Nos gammes</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-[#c9c4b8] md:text-[17px]">Une routine complète, prête à l’emploi. Moins cher que les soins achetés séparément.</p>
        </div>
        <button type="button" aria-expanded={quizOpen} onClick={() => setQuizOpen((o) => !o)}
          className="min-h-11 shrink-0 rounded-full border border-gold px-5 text-sm font-semibold text-gold hover:bg-gold-soft md:text-[15px]">
          {quizOpen ? 'Fermer le questionnaire' : 'Pas sûre ? Quelle gamme pour moi'}
        </button>
      </div>
      {quizOpen && <div className="empty:hidden"><GammeQuiz /></div>}

      {filters.length > 1 && (
        <div role="group" aria-label="Filtrer les gammes" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          <Chip label={`Toutes (${list.length})`} active={!filter} onClick={() => setFilter(null)} />
          {filters.map((f) => <Chip key={f.label} label={f.label} active={filter === f.label} onClick={() => setFilter(f.label)} />)}
        </div>
      )}

      {gammes.isError ? <QueryError message={apiErrorMessage(gammes.error)} onRetry={() => gammes.refetch()} />
        : gammes.isPending ? (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-5 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 md:h-96" />)}</div>
        ) : list.length === 0 ? (
          <p className="rounded-2xl border border-[#2b2516] p-6 text-center text-[#c9c4b8]">Les gammes arrivent bientôt. En attendant, <Link to="/boutique" className="text-gold underline">découvrez nos soins</Link>.</p>
        ) : (
          <ul aria-label="Gammes" className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {shown.map((g) => <GammeCard key={g.id} gamme={g} />)}
          </ul>
        )}
      {more && <Link to="/boutique?category=gammes&page=2" className="self-center text-sm font-semibold text-gold underline">Voir les autres gammes</Link>}
      <p className="text-sm text-[#a8a29e]">Paiement à la réception · Livraison à Dakar ou retrait gratuit au salon.</p>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn('min-h-10 shrink-0 rounded-full px-4 text-sm whitespace-nowrap', active ? 'bg-gold font-semibold text-ink' : 'border border-[#3a3a3a] text-[#e6e1d6] hover:border-gold')}>
      {label}
    </button>
  )
}

/** Une gamme : carte verticale sur ordinateur, ligne façon panier sur téléphone */
function GammeCard({ gamme: g }: { gamme: ProductSummary }) {
  const add = useCart((s) => s.add)
  const [added, setAdded] = useState(false)
  const out = g.stock_status === 'out_of_stock'
  // Une gamme en rupture n'est pas mise en avant (ni cadre doré ni badge) : on ne pousse pas ce qu'on ne peut pas vendre
  const member = !out && g.member_price != null && g.member_offer && g.member_offer.status !== 'none' && g.member_offer.status !== 'sold_out'
  const promo = g.promotion?.applies ? g.promotion : null
  const addToCart = () => {
    add({ productId: g.id, slug: g.slug, name: g.name, unitSize: g.unit_size, price: g.price, memberPrice: g.member_price ?? null })
    setAdded(true)
  }

  return (
    <li className={cn('flex min-w-0 gap-3 rounded-2xl bg-[#141414] p-2.5 md:flex-col md:gap-0 md:overflow-hidden md:p-0', member ? 'border-2 border-gold' : 'border border-[#2b2516]', out && 'opacity-75')}>
      <Link to={`/produits/${g.slug}`} tabIndex={-1} aria-hidden="true" className="relative size-[84px] shrink-0 overflow-hidden rounded-xl bg-[#1a1712] md:h-44 md:w-full md:rounded-none">
        {g.image_url
          ? <img src={g.image_url} alt="" loading="lazy" className="size-full object-cover" />
          : <span className={cn('grid size-full place-items-center font-display text-sm text-gold md:text-[26px]', out && 'opacity-50')}>Dabo Hair</span>}
        {member && <span className="absolute top-2.5 left-2.5 hidden rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold tracking-wider text-ink uppercase md:block">Prix membre</span>}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:gap-1.5 md:p-4">
        <span className="text-[10px] font-bold tracking-[0.12em] text-gold uppercase md:text-[11px]">{g.name}</span>
        <Link to={`/produits/${g.slug}`} className="line-clamp-2 text-[15px] font-semibold hover:text-gold md:line-clamp-3 md:font-display md:text-xl">
          {g.short_description || g.name}
        </Link>
        {g.bundle_contents && <span className="truncate text-xs text-[#c9c4b8] md:flex-1 md:text-[13px] md:whitespace-normal">{g.bundle_contents.join(' · ')}</span>}
        <span className="flex flex-wrap items-baseline gap-x-2">
          {out ? <span className="text-sm font-semibold text-[#c9c4b8]">Bientôt de retour</span>
            : member ? <><strong className="text-gold md:text-lg">{formatPrice(g.member_price!)}</strong><s className="text-xs text-[#8a857b]"><span className="sr-only">au lieu de </span>{formatPrice(g.price)}</s><span className="text-xs text-[#c9c4b8]">membres</span></>
              : promo ? <><strong className="text-gold md:text-lg">{formatPrice(promo.price)}</strong><s className="text-xs text-[#8a857b]"><span className="sr-only">au lieu de </span>{formatPrice(g.price)}</s></>
                : <strong className="text-gold md:text-lg">{formatPrice(g.price)}</strong>}
        </span>
        {/* Ordinateur : grand bouton sous la carte */}
        <div className="mt-1 hidden md:block">
          {out ? <span className="flex min-h-11 items-center justify-center rounded-full bg-[#262626] text-sm font-semibold text-[#8a8a8a]">Indisponible</span>
            : added ? <AddedLink />
              : <button type="button" onClick={addToCart} className="min-h-11 w-full rounded-full bg-gold text-sm font-bold text-ink hover:bg-[#e2c050]">Ajouter au panier<span className="sr-only"> : {g.name}</span></button>}
        </div>
      </div>
      {/* Téléphone : bouton rond « + » à droite, comme dans le panier */}
      {!out && (
        <div className="flex shrink-0 items-center md:hidden">
          {added ? <Link to="/panier" aria-label={`${g.name} est dans le panier : voir le panier`} className="grid size-11 place-items-center rounded-full border border-gold text-gold"><Check className="size-5" aria-hidden="true" /></Link>
            : <button type="button" onClick={addToCart} aria-label={`Ajouter au panier : ${g.name}`} className="grid size-11 place-items-center rounded-full bg-gold text-ink"><Plus className="size-5" aria-hidden="true" /></button>}
        </div>
      )}
      {added && <span role="status" className="sr-only">{g.name} ajoutée au panier.</span>}
    </li>
  )
}

function AddedLink() {
  return (
    <Link to="/panier" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gold text-sm font-semibold text-gold hover:bg-gold-soft">
      <Check className="size-4" aria-hidden="true" /> Ajoutée · Voir le panier
    </Link>
  )
}
