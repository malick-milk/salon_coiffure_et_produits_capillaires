/** Nouvelle gamme (maquette validée le 24 novembre 2026) : les chiffres de l'exemple « Gamme à l'avocat » */
import { describe, expect, it } from 'vitest'
import { bundleSummary, type BundleLine } from './purchaseMath'

const avocat: BundleLine[] = [
  { name: 'Shampooing', price: 3000, cost: 400, stock: 47, quantity: 1 },
  { name: 'Masque', price: 3000, cost: 383.33, stock: 23, quantity: 1 },
  { name: 'Crème', price: 3000, cost: 150, stock: 23, quantity: 1 },
  { name: 'Spray hydratant', price: 5000, cost: 350, stock: 47, quantity: 1 },
]

describe('bundleSummary', () => {
  it('l’exemple de la maquette : 14 000 F séparément, 2 000 F d’économie, 89 % de marge, 87 % au prix membre', () => {
    const s = bundleSummary(avocat, 12000, 10000, 200)
    expect(s.separate).toBe(14000)
    expect([s.saving, s.savingRate]).toEqual([2000, 14.3])
    expect(s.cost).toBe(1283)
    expect(s.margin).toEqual({ amount: 12000 - 1283.33, rate: 89.3, loss: false })
    expect(s.memberMargin?.rate).toBe(87.2)
  })

  it('le produit le plus rare limite tout ; pour 200 gammes, il manque 177 masques et 177 crèmes, 153 shampooings et sprays', () => {
    const s = bundleSummary(avocat, 12000, 10000, 200)
    expect(s.possible).toBe(23)
    expect(s.limiting).toEqual(['Masque', 'Crème'])
    expect(s.shortfalls).toEqual([
      { name: 'Shampooing', missing: 153 }, { name: 'Masque', missing: 177 }, { name: 'Crème', missing: 177 }, { name: 'Spray hydratant', missing: 153 },
    ])
  })

  it('une quantité de 2 compte double ; l’objectif déjà atteint : rien ne manque', () => {
    const s = bundleSummary([{ name: 'A', price: 1000, cost: 100, stock: 9, quantity: 2 }, { name: 'B', price: 1000, cost: 100, stock: 50, quantity: 1 }], 2500, null, 4)
    expect([s.separate, s.possible, s.limiting, s.shortfalls, s.memberMargin]).toEqual([3000, 4, ['A'], [], null])
  })

  it('un coût inconnu : la marge n’est pas inventée', () => {
    const s = bundleSummary([...avocat.slice(0, 3), { name: 'Leave In', price: 5000, cost: null, stock: 19, quantity: 1 }], 12000, null, null)
    expect([s.cost, s.margin, s.unknownCost]).toEqual([null, null, ['Leave In']])
  })
})
