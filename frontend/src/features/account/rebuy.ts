/**
 * « RACHETER LA MÊME CHOSE » (maquette validée le 25 novembre 2026) : le panier se remplit avec la même commande.
 * Prix et stock DU JOUR (lus sur les fiches) : on ne ressuscite jamais un ancien prix. Un produit retiré de la vente
 * ou en rupture est signalé, pas ajouté. La commande reste à confirmer par la cliente.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { fetchProduct } from '@/features/catalog/api'
import { useCart } from '@/features/cart/store'
import type { OrderLine, ProductDetail } from '@/types/api'
import { fetchMyOrder } from './api'

/** Ce qu'on peut remettre au panier, et ce qui ne l'est plus */
export function planRebuy(items: OrderLine[], products: Record<string, ProductDetail | null>) {
  const add: { product: ProductDetail; quantity: number }[] = []
  const unavailable: string[] = []
  for (const line of items) {
    const product = line.product_slug ? products[line.product_slug] : null
    if (!product || product.stock_status === 'out_of_stock') unavailable.push(line.product_name)
    else add.push({ product, quantity: line.quantity })
  }
  return { add, unavailable }
}

export function useRebuy() {
  const navigate = useNavigate()
  const addToCart = useCart((s) => s.add)
  const [busy, setBusy] = useState<string | null>(null)
  const rebuy = async (reference: string) => {
    setBusy(reference)
    try {
      const order = await fetchMyOrder(reference)
      const slugs = [...new Set(order.items.flatMap((i) => (i.product_slug ? [i.product_slug] : [])))]
      const fetched = await Promise.all(slugs.map((s) => fetchProduct(s).then((p) => [s, p] as const, () => [s, null] as const)))
      const plan = planRebuy(order.items, Object.fromEntries(fetched))
      for (const { product: p, quantity } of plan.add) {
        addToCart({ productId: p.id, slug: p.slug, name: p.name, unitSize: p.unit_size, price: p.price, memberPrice: p.member_price ?? null }, quantity)
      }
      navigate('/panier', { state: { rebuy: { reference, unavailable: plan.unavailable } } })
    } finally {
      setBusy(null)
    }
  }
  return { rebuy, busy }
}
