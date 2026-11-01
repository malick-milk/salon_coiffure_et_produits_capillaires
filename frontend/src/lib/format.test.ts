import { formatDozens, formatDuration, formatLongDate, formatPrice } from './format'

describe('formatage', () => {
  it('affiche un montant en F CFA avec séparateur de milliers', () => {
    expect(formatPrice(6500)).toBe('6 500 F CFA')
    expect(formatPrice(1374000)).toBe('1 374 000 F CFA')
    expect(formatPrice(0)).toBe('0 F CFA')
  })

  it('affiche une durée lisible', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(90)).toBe('1 h 30')
    expect(formatDuration(180)).toBe('3 h')
  })

  it('affiche une date longue en français', () => {
    expect(formatLongDate('2026-11-14')).toBe('samedi 14 novembre 2026')
  })

  it('exprime les quantités en douzaines quand elles tombent juste', () => {
    expect(formatDozens(48)).toBe('4 douzaines (48)')
    expect(formatDozens(12)).toBe('1 douzaine (12)')
    expect(formatDozens(50)).toBe('50')
  })
})
