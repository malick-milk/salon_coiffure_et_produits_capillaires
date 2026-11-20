/** Promotions (maquettes validées le 20 novembre 2026) : prix promo et phrase des résultats */
import { describe, expect, it } from 'vitest'
import { discountedPrice } from '../purchaseMath'
import { verdict } from './PromotionsPages'

const period = (units: number, margin: number) => ({ units, revenue: 0, margin, margin_partial: false, discount: 0 })
const results = (daysDuring: number, units: number | null, margin: number | null) => ({
  days_during: daysDuring,
  totals: { before: period(3.7, 13260), during: period(6, 17370), change: { units, revenue: 34, margin }, units_sold: 18 },
  products: [],
})

describe('Promotions', () => {
  it('prix promo : même arrondi que le serveur (dizaine inférieure)', () => {
    expect(discountedPrice(3500, 15)).toBe(2970) // 2 975 -> 2 970
    expect(discountedPrice(5000, 20)).toBe(4000)
    expect(discountedPrice(5200, 20)).toBe(4160)
  })

  it('les résultats se lisent en une phrase', () => {
    expect(verdict(results(2, 62, 31))).toMatch(/^Trop tôt pour conclure/)
    expect(verdict(results(3, 62, 31))).toMatch(/fait vendre plus \(\+62 %\) et la marge du jour augmente quand même \(\+31 %\).*À refaire/)
    expect(verdict(results(3, 40, -12))).toMatch(/mais la marge du jour baisse \(-12 %\).*déstockage/)
    expect(verdict(results(3, -5, -20))).toMatch(/^Pas d’effet sur les ventes/)
    expect(verdict(results(3, null, null))).toMatch(/^Pas de ventes les 7 jours d’avant/)
  })
})
