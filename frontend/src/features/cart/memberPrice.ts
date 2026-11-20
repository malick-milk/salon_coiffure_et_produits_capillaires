/**
 * PRIX MEMBRE et PROMOTIONS dans le panier (maquettes validées le 18 novembre 2026).
 *
 * Le panier sait seulement qu'un article PEUT avoir un prix membre. Pour savoir s'il s'applique,
 * on demande la fiche au serveur : « member_offer.status » dit si CETTE visiteuse y a droit
 * (connectée, pas encore utilisé, places restantes). Une seule unité par compte.
 * Ce calcul sert à l'AFFICHAGE : à la commande, le serveur recalcule tout lui-même.
 */
import { useQueries } from '@tanstack/react-query'
import { fetchProduct } from '@/features/catalog/api'
import { catalogKeys } from '@/features/catalog/hooks'
import type { MemberOffer, Money } from '@/types/api'
import { type CartItem, useCart } from './store'

export interface MemberLine {
  item: CartItem
  offer: MemberOffer | null
  memberPrice: Money
  saving: Money // économie si le prix membre s'applique (une unité)
}

export function useMemberPricing() {
  const items = useCart((s) => s.items)
  // Toutes les fiches du panier : une PROMOTION peut toucher n'importe quel produit (20 novembre 2026)
  const results = useQueries({
    queries: items.map((i) => ({ queryKey: catalogKeys.product(i.slug), queryFn: () => fetchProduct(i.slug), staleTime: 30_000 })),
  })
  const products = new Map(items.map((item, k) => [item.productId, results[k]?.data]))
  const lines: MemberLine[] = items.filter((i) => i.memberPrice != null).map((item) => {
    const product = products.get(item.productId)
    const memberPrice = product?.member_price ?? item.memberPrice ?? item.price
    return { item, offer: product?.member_offer ?? null, memberPrice, saving: Math.max(0, item.price - memberPrice) }
  })
  const applied = lines.filter((l) => l.offer?.status === 'eligible')
  /** Promotion en cours qui s'applique à cette visiteuse pour ce produit, ou null */
  const promoFor = (productId: number) => {
    const promotion = products.get(productId)?.promotion
    return promotion?.applies ? promotion : null
  }
  /** Économie sur la ligne : promotion (toutes les unités) sinon prix membre (une unité). Jamais les deux. */
  const savingFor = (productId: number) => {
    const item = items.find((i) => i.productId === productId)
    const promotion = promoFor(productId)
    if (item && promotion) return (item.price - promotion.price) * item.quantity
    return applied.find((l) => l.item.productId === productId)?.saving ?? 0
  }
  return {
    lines,
    applied,
    promoFor,
    savingFor,
    /** Remise totale affichée (promotions + prix membre). Le serveur recalcule tout à la commande. */
    discount: items.reduce((sum, i) => sum + savingFor(i.productId), 0),
    /** Une remise de promotion dans le panier ? (le libellé du total en dépend) */
    hasPromotion: items.some((i) => promoFor(i.productId) !== null),
    /** Un article à prix membre attend une visiteuse non connectée : on l'invite à créer son compte */
    signIn: lines.find((l) => l.offer?.status === 'sign_in') ?? null,
  }
}
