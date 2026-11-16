/** Même formule que le serveur (RecordPurchaseReceiptAction) : on vérifie les mêmes exemples que tests/Feature/ProductCreationTest.php */
import { describe, expect, it } from 'vitest'
import { fitWithin } from '@/lib/resizeImage'
import { previewReceipt } from './purchaseMath'

describe('Réception d’achat : aperçu du calcul', () => {
  it('coût par unité avec frais du lot, puis moyenne pondérée avec le stock existant', () => {
    // Stock : 10 unités à 2 000 F. On reçoit 20 × 2 500 F + 2 000 F de transport = 2 600 F l'unité
    const p = previewReceipt({ quantity: 20, unitPrice: 2500, extraCosts: 2000, stockBefore: 10, costBefore: 2000, salePrice: 6000 })
    expect(p).toEqual({ subtotal: 50000, total: 52000, unitCost: 2600, stockAfter: 30, newCost: 2400, unitMargin: 3600 })
  })

  it('sans coût connu ou sans stock, le coût est celui de la réception', () => {
    expect(previewReceipt({ quantity: 10, unitPrice: 2000, extraCosts: 0, stockBefore: 5, costBefore: null, salePrice: 6000 })?.newCost).toBe(2000)
    expect(previewReceipt({ quantity: 10, unitPrice: 2000, extraCosts: 0, stockBefore: 0, costBefore: 9999, salePrice: 6000 })?.newCost).toBe(2000)
  })

  it('vente à perte : marge négative signalée ; saisie incomplète : pas d’aperçu', () => {
    expect(previewReceipt({ quantity: 3, unitPrice: 7000, extraCosts: 0, stockBefore: 0, costBefore: null, salePrice: 6000 })?.unitMargin).toBe(-1000)
    expect(previewReceipt({ quantity: 0, unitPrice: 2000, extraCosts: 0, stockBefore: 0, costBefore: null, salePrice: 6000 })).toBeNull()
    expect(previewReceipt({ quantity: Number(''), unitPrice: Number('abc'), extraCosts: 0, stockBefore: 0, costBefore: null, salePrice: 6000 })).toBeNull()
  })

  it('arrondi au centime : 3 unités pour 10 000 F', () => {
    expect(previewReceipt({ quantity: 3, unitPrice: 3000, extraCosts: 1000, stockBefore: 0, costBefore: null, salePrice: 6000 })?.unitCost).toBe(3333.33)
  })
})

describe('Photo réduite avant l’envoi', () => {
  it('le plus grand côté passe à 2000 px, les proportions sont gardées', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 }) // photo de téléphone en paysage
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: 2000 }) // en portrait
  })
  it('une image déjà petite n’est jamais agrandie', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
