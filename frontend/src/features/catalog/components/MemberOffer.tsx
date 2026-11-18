/**
 * PRIX MEMBRE (maquettes validées le 18 novembre 2026) : la gamme à 10 000 F pour une cliente
 * connectée, 15 000 F sans compte, 20 gammes, une par compte. Le serveur dit où en est la visiteuse
 * (member_offer.status) ; ce composant ne fait qu'afficher.
 */
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/hooks'
import { formatPrice } from '@/lib/format'
import type { ProductSummary } from '@/types/api'
import { useProduct } from '../hooks'

/** Slug de la gamme du lancement (créée par DaboHairCatalogSeeder) */
export const LAUNCH_BUNDLE_SLUG = 'gamme-complete-dabo-hair'

export function hasMemberOffer(p: Pick<ProductSummary, 'member_price' | 'member_offer'>): boolean {
  return p.member_price != null && !!p.member_offer && p.member_offer.status !== 'none'
}

/** « Plus que 12 gammes sur 20 » */
export function MemberCounter({ remaining, limit }: { remaining: number; limit: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-[#e6e1d6]">
        {remaining > 0 ? `Plus que ${remaining} gamme${remaining > 1 ? 's' : ''} sur ${limit} au prix membre` : `Les ${limit} gammes au prix membre sont parties`}
      </span>
      <div className="h-[5px] overflow-hidden rounded-full bg-[#2b2516]" role="progressbar" aria-label="Gammes restantes au prix membre" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={remaining}>
        <div className="h-full bg-gold" style={{ width: `${Math.round((100 * remaining) / Math.max(1, limit))}%` }} />
      </div>
    </div>
  )
}

/** Le bloc « prix » d'un article à prix membre, selon la situation de la visiteuse */
export function MemberPriceBlock({ product }: { product: ProductSummary }) {
  const me = useMe()
  const here = useLocation().pathname
  const offer = product.member_offer!
  const memberPrice = product.member_price!

  if (offer.status === 'eligible') {
    return (
      <div className="flex flex-col gap-1 rounded-2xl border-2 border-gold bg-gold-soft p-4">
        <span className="text-sm text-[#e6e1d6]">{me.data ? `Bonjour ${me.data.first_name}, votre prix membre` : 'Votre prix membre'}</span>
        <p className="flex flex-wrap items-baseline gap-3">
          <strong className="text-3xl font-semibold text-gold">{formatPrice(memberPrice)}</strong>
          <s className="text-base text-[#8a857b]">{formatPrice(product.price)}</s>
        </p>
        <span className="text-xs text-[#c9c4b8]">Une gamme au prix membre par compte</span>
      </div>
    )
  }

  if (offer.status === 'sign_in') {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border-2 border-gold bg-gold-soft p-3">
            <span className="text-xs font-bold tracking-wider text-gold uppercase">Prix membre</span>
            <strong className="block text-xl whitespace-nowrap text-gold sm:text-2xl">{formatPrice(memberPrice)}</strong>
            <span className="text-xs text-[#c9c4b8]">avec un compte gratuit</span>
          </div>
          <div className="rounded-2xl border border-[#333] p-3">
            <span className="text-xs font-semibold tracking-wider text-muted uppercase">Sans compte</span>
            <strong className="block text-xl whitespace-nowrap text-mist sm:text-2xl">{formatPrice(product.price)}</strong>
            <span className="text-xs text-[#8a857b]">prix normal</span>
          </div>
        </div>
        <Button asChild><Link to={`/inscription?redirect=${encodeURIComponent(here)}`}>Créer mon compte gratuit</Link></Button>
        <p className="text-center text-sm text-[#c9c4b8]">
          Déjà membre ? <Link to={`/connexion?redirect=${encodeURIComponent(here)}`} className="font-semibold text-gold underline underline-offset-4">Se connecter</Link>
        </p>
      </div>
    )
  }

  // Déjà utilisé, ou plus de place : prix normal, avec l'explication
  return (
    <div className="flex flex-col gap-1">
      <strong className="text-3xl font-semibold">{formatPrice(product.price)}</strong>
      <span className="text-sm text-muted">
        {offer.status === 'already_used' ? 'Vous avez déjà profité du prix membre : une gamme par compte.' : 'Les gammes au prix membre sont toutes parties.'}
      </span>
    </div>
  )
}

/** Accueil : la gamme du lancement, si elle existe et que son offre est active */
export function MemberOfferHero() {
  const { data: product } = useProduct(LAUNCH_BUNDLE_SLUG)
  if (!product || !hasMemberOffer(product)) return null
  const offer = product.member_offer!
  const image = product.images[0]

  return (
    <section aria-labelledby="offre-lancement" className="px-4 pt-6 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2 lg:items-center">
        <Link to={`/produits/${product.slug}`} className="relative block overflow-hidden rounded-[22px] border border-[#2b2516]" tabIndex={-1} aria-hidden="true">
          {image && <img src={image.url} alt="" className="aspect-[4/3] w-full object-cover object-[center_64%]" />}
          <span className="absolute top-3 left-3 rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-gold uppercase">Réservé aux membres</span>
        </Link>
        <div className="flex flex-col gap-3.5">
          <h2 id="offre-lancement" className="font-display text-3xl leading-tight font-semibold sm:text-4xl">
            <Link to={`/produits/${product.slug}`} className="hover:text-gold">La gamme complète, six soins</Link>
          </h2>
          <MemberPriceBlock product={product} />
          {offer.status !== 'sold_out' && <MemberCounter remaining={offer.remaining} limit={offer.limit} />}
          {offer.status !== 'sign_in' && (
            <Button asChild variant="outline"><Link to={`/produits/${product.slug}`}>Voir la gamme</Link></Button>
          )}
        </div>
      </div>
    </section>
  )
}
