/** Racheter la même chose : produits encore en vente et en stock seulement, quantités reprises */
import { describe, expect, it } from 'vitest'
import type { OrderLine, ProductDetail } from '@/types/api'
import { planRebuy } from './rebuy'

const line = (product_slug: string | null, product_name: string, quantity = 1): OrderLine => ({ product_slug, product_name, quantity, unit_price: 0, line_total: 0 })
const product = (slug: string, stock_status: ProductDetail['stock_status'] = 'in_stock') => ({ id: 1, slug, name: slug, stock_status }) as ProductDetail

describe('planRebuy', () => {
  it('reprend les quantités ; signale ce qui est retiré de la vente ou en rupture', () => {
    const plan = planRebuy(
      [line('spray', 'Spray hydratant', 2), line(null, 'Ancien produit'), line('creme', 'Crème capillaire')],
      { spray: product('spray'), creme: product('creme', 'out_of_stock') },
    )
    expect(plan.add.map((a) => [a.product.slug, a.quantity])).toEqual([['spray', 2]])
    expect(plan.unavailable).toEqual(['Ancien produit', 'Crème capillaire'])
  })
})
