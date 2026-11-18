/**
 * PRIX MEMBRE dans le panier (maquettes validées le 18 novembre 2026).
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
  const candidates = items.filter((i) => i.memberPrice != null)
  const results = useQueries({
    queries: candidates.map((i) => ({ queryKey: catalogKeys.product(i.slug), queryFn: () => fetchProduct(i.slug), staleTime: 30_000 })),
  })
  const lines: MemberLine[] = candidates.map((item, k) => {
    const product = results[k]?.data
    const memberPrice = product?.member_price ?? item.memberPrice ?? item.price
    return { item, offer: product?.member_offer ?? null, memberPrice, saving: Math.max(0, item.price - memberPrice) }
  })
  const applied = lines.filter((l) => l.offer?.status === 'eligible')
  return {
    lines,
    applied,
    /** Remise totale affichée (prix normal − prix membre, une unité par article) */
    discount: applied.reduce((sum, l) => sum + l.saving, 0),
    /** Un article à prix membre attend une visiteuse non connectée : on l'invite à créer son compte */
    signIn: lines.find((l) => l.offer?.status === 'sign_in') ?? null,
    savingFor: (productId: number) => applied.find((l) => l.item.productId === productId)?.saving ?? 0,
  }
}
