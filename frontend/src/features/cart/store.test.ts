import { act } from '@testing-library/react'
import { MAX_QUANTITY_PER_ITEM, useCart } from './store'

const serum = { productId: 10, slug: 'serum-activ-pousse-30-ml', name: 'Sérum Activ’Pousse', unitSize: '30 ml', price: 3000 }
const spray = { productId: 7, slug: 'spray-hydratant-250-ml', name: 'Spray hydratant', unitSize: '250 ml', price: 5000 }
const items = () => useCart.getState().items
const subtotal = () => items().reduce((s, i) => s + i.price * i.quantity, 0)

describe('panier', () => {
  beforeEach(() => act(() => useCart.getState().clear()))

  it('ajouter deux fois le même produit augmente la quantité (une seule ligne)', () => {
    act(() => {
      useCart.getState().add(serum)
      useCart.getState().add(serum, 2)
    })
    expect(items()).toHaveLength(1)
    expect(items()[0]!.quantity).toBe(3)
  })

  it('calcule le sous-total', () => {
    act(() => {
      useCart.getState().add(serum, 2) // 6 000
      useCart.getState().add(spray) // 5 000
    })
    expect(subtotal()).toBe(11000)
  })

  it('la quantité reste entre 1 et le maximum autorisé', () => {
    act(() => useCart.getState().add(serum))
    act(() => useCart.getState().setQuantity(10, 0))
    expect(items()[0]!.quantity).toBe(1)
    act(() => useCart.getState().setQuantity(10, 500))
    expect(items()[0]!.quantity).toBe(MAX_QUANTITY_PER_ITEM)
  })

  it('retire un article', () => {
    act(() => {
      useCart.getState().add(serum)
      useCart.getState().add(spray)
      useCart.getState().remove(10)
    })
    expect(items().map((i) => i.productId)).toEqual([7])
  })
})

// Bug du 20 novembre 2026 : le panier d'une cliente apparaissait dans le compte de la gérante (même navigateur)
describe('le panier appartient à la personne connectée', () => {
  const item = { productId: 1, slug: 'spray', name: 'Spray hydratant', unitSize: '250 ml', price: 5000 }
  beforeEach(() => useCart.setState({ items: [], ownerId: null }))

  it('panier de visiteuse : gardé à la connexion, il devient le sien (prix membre après inscription)', () => {
    useCart.getState().add(item)
    useCart.getState().syncOwner(7)
    expect(useCart.getState().items).toHaveLength(1)
    expect(useCart.getState().ownerId).toBe(7)
  })
  it('panier d’un autre compte : vidé', () => {
    useCart.setState({ ownerId: 7 })
    useCart.getState().add(item)
    useCart.getState().syncOwner(1) // la gérante se connecte
    expect(useCart.getState().items).toHaveLength(0)
  })
  it('plus personne de connecté (déconnexion ailleurs, session expirée) : vidé', () => {
    useCart.setState({ ownerId: 7 })
    useCart.getState().add(item)
    useCart.getState().syncOwner(null)
    expect(useCart.getState().items).toHaveLength(0)
  })
  it('panier enregistré avant le correctif (propriétaire inconnu) : vidé à la connexion', () => {
    useCart.setState({ items: [{ ...item, quantity: 2 }], ownerId: undefined as unknown as null })
    useCart.getState().syncOwner(1)
    expect(useCart.getState().items).toHaveLength(0)
  })
})
