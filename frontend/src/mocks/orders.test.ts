/** Spécification du calcul de commande (reprise par les tests du PlaceOrderAction PHP à l'étape 6) */
import { priceOrder, type PricedProduct } from './orders'

const products: PricedProduct[] = [
  { id: 10, slug: 'serum-30', name: 'Sérum Activ’Pousse', unit_size: '30 ml', price: 3000, stock: 24 },
  { id: 7, slug: 'spray', name: 'Spray hydratant', unit_size: '250 ml', price: 5000, stock: 48 },
  { id: 9, slug: 'creme', name: 'Crème capillaire', unit_size: null, price: 3000, stock: 0 },
]
const plateau = { id: 1, name: 'Dakar Plateau', fee: 1000 }

describe('calcul d’une commande côté serveur', () => {
  it('recalcule les prix depuis la base et ajoute les frais de livraison de la zone', () => {
    const r = priceOrder({ items: [{ product_id: 10, quantity: 2 }, { product_id: 7, quantity: 1 }], products, method: 'delivery', zone: plateau })
    expect(r.ok && r.subtotal).toBe(11000)
    expect(r.ok && r.shipping_fee).toBe(1000)
    expect(r.ok && r.total).toBe(12000)
  })

  it('retrait en boutique : pas de frais, même si une zone est envoyée', () => {
    const r = priceOrder({ items: [{ product_id: 7, quantity: 1 }], products, method: 'pickup', zone: plateau })
    expect(r.ok && r.total).toBe(5000)
  })

  it('regroupe un produit envoyé deux fois', () => {
    const r = priceOrder({ items: [{ product_id: 10, quantity: 1 }, { product_id: 10, quantity: 2 }], products, method: 'pickup', zone: null })
    expect(r.ok && r.lines).toHaveLength(1)
    expect(r.ok && r.lines[0]!.quantity).toBe(3)
  })

  it('stock insuffisant : 409 avec le détail des produits concernés', () => {
    const r = priceOrder({ items: [{ product_id: 9, quantity: 1 }, { product_id: 10, quantity: 30 }], products, method: 'pickup', zone: null })
    expect(r.ok).toBe(false)
    if (!r.ok && r.status === 409) {
      expect(r.conflict.items).toEqual([
        { product_id: 9, name: 'Crème capillaire', requested: 1, available: 0 },
        { product_id: 10, name: 'Sérum Activ’Pousse 30 ml', requested: 30, available: 24 },
      ])
    }
  })

  it('refuse un panier vide, une quantité invalide, une livraison sans zone, un produit inconnu', () => {
    expect(priceOrder({ items: [], products, method: 'pickup', zone: null }).ok).toBe(false)
    expect(priceOrder({ items: [{ product_id: 10, quantity: 0 }], products, method: 'pickup', zone: null }).ok).toBe(false)
    expect(priceOrder({ items: [{ product_id: 10, quantity: 1.5 }], products, method: 'pickup', zone: null }).ok).toBe(false)
    expect(priceOrder({ items: [{ product_id: 10, quantity: 1 }], products, method: 'delivery', zone: null }).ok).toBe(false)
    expect(priceOrder({ items: [{ product_id: 999, quantity: 1 }], products, method: 'pickup', zone: null }).ok).toBe(false)
  })
})
