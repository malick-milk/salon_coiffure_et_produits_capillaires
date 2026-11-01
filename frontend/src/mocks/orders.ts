/**
 * CALCUL D'UNE COMMANDE CÔTÉ SERVEUR (spécification du futur PlaceOrderAction Laravel).
 *
 * Règles appliquées :
 * - RG-COM-04 : les prix viennent de la BASE, jamais du navigateur (qui n'envoie que des ids).
 * - RG-STK-01/04 : quantité demandée <= stock disponible ; un produit en rupture est refusé.
 * - Frais de livraison = ceux de la zone (0 pour un retrait en boutique).
 * - total = sous-total - remise + frais (même règle que la contrainte CHECK de la table orders).
 */
import type { DeliveryZone, FulfillmentMethod, Money, StockConflict } from '@/types/api'

export interface PricedProduct {
  id: number
  slug: string
  name: string
  unit_size: string | null
  price: Money
  stock: number
  is_active?: boolean
}

export interface PricedLine {
  product_id: number
  product_slug: string
  product_name: string
  unit_price: Money
  quantity: number
  line_total: Money
}

export type PricingResult =
  | { ok: true; lines: PricedLine[]; subtotal: Money; discount_total: Money; shipping_fee: Money; total: Money }
  | { ok: false; status: 409; conflict: StockConflict }
  | { ok: false; status: 422; message: string }

export function priceOrder(input: {
  items: { product_id: number; quantity: number }[]
  products: PricedProduct[]
  method: FulfillmentMethod
  zone: DeliveryZone | null
}): PricingResult {
  if (input.items.length === 0) return { ok: false, status: 422, message: 'Le panier est vide.' }
  if (input.method === 'delivery' && !input.zone) return { ok: false, status: 422, message: 'Choisissez une zone de livraison.' }

  // Regrouper les doublons éventuels (même produit envoyé deux fois)
  const wanted = new Map<number, number>()
  for (const { product_id, quantity } of input.items) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { ok: false, status: 422, message: 'Quantité invalide.' }
    wanted.set(product_id, (wanted.get(product_id) ?? 0) + quantity)
  }

  const lines: PricedLine[] = []
  const conflicts: StockConflict['items'] = []
  for (const [id, quantity] of wanted) {
    const p = input.products.find((x) => x.id === id && x.is_active !== false)
    if (!p) return { ok: false, status: 422, message: 'Un produit du panier n’existe plus.' }
    const name = [p.name, p.unit_size].filter(Boolean).join(' ')
    if (quantity > p.stock) conflicts.push({ product_id: id, name, requested: quantity, available: p.stock })
    lines.push({ product_id: id, product_slug: p.slug, product_name: name, unit_price: p.price, quantity, line_total: p.price * quantity })
  }

  if (conflicts.length) {
    return { ok: false, status: 409, conflict: { message: 'Stock insuffisant pour certains produits.', items: conflicts } }
  }

  const subtotal = lines.reduce((s, l) => s + l.line_total, 0)
  const shipping_fee = input.method === 'delivery' ? (input.zone?.fee ?? 0) : 0
  const discount_total = 0 // codes promo : plus tard (EF-COM-10)
  return { ok: true, lines, subtotal, discount_total, shipping_fee, total: subtotal - discount_total + shipping_fee }
}
