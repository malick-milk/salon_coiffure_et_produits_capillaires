import { describe, expect, it } from 'vitest'
import { bucketLabel, compact } from './charts'

// Les espaces des nombres français sont insécables : on les normalise pour comparer
const n = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ')

describe('compact (graduations des axes)', () => {
  it('abrège les grands montants', () => {
    expect(n(compact(1_250_000))).toBe('1,25 M')
    expect(n(compact(45_000))).toBe('45 k')
    expect(n(compact(77_500))).toBe('77,5 k')
  })
  it('laisse les petits nombres intacts', () => {
    expect(compact(950)).toBe('950')
    expect(compact(0)).toBe('0')
  })
})

describe('bucketLabel (étiquettes de période)', () => {
  it('jour, semaine et mois', () => {
    expect(bucketLabel('2026-10-12', 'day')).toBe('12 oct.')
    expect(bucketLabel('2026-10-12', 'week', true)).toBe('Semaine du 12 oct.')
    expect(bucketLabel('2026-10-01', 'month', true)).toBe('octobre 2026')
  })
  it('ne décale pas la date selon le fuseau horaire du navigateur', () => {
    expect(bucketLabel('2026-01-01', 'day')).toBe('1 janv.')
  })
})
