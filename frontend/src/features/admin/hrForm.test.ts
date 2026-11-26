import { describe, expect, it } from 'vitest'
import type { HrSheet } from '@/types/admin'
import { daysUntil, EMPTY_FORM, historyLine, missingFields, nextDay, toPayload } from './hrForm'

describe('Contrats et RH : formulaire', () => {
  it('vide la date de fin pour un CDI, la garde pour un CDD', () => {
    const base = { ...EMPTY_FORM, first_name: 'Aïda', last_name: 'Sy', position: 'Coiffeuse', starts_on: '2026-12-01', ends_on: '2027-05-31', base_salary: '90 000', commission_rate: '10,5' }
    expect(toPayload({ ...base, type: 'cdi' }).ends_on).toBeNull()
    const cdd = toPayload({ ...base, type: 'cdd' })
    expect([cdd.ends_on, cdd.base_salary, cdd.commission_rate, cdd.phone]).toEqual(['2027-05-31', 90000, 10.5, null])
  })

  it('signale ce qui manque, dont la fin d’un CDD', () => {
    expect(Object.keys(missingFields({ ...EMPTY_FORM, type: 'cdd' }))).toEqual(['first_name', 'last_name', 'position', 'starts_on', 'ends_on'])
    expect(missingFields({ ...EMPTY_FORM, first_name: 'Aïda', last_name: 'Sy', position: 'Coiffeuse', starts_on: '2026-12-01' })).toEqual({})
  })

  it('compte les jours et le lendemain, sans décalage de fuseau', () => {
    expect(daysUntil('2026-12-14', new Date(2026, 10, 26, 23, 30))).toBe(18)
    expect(daysUntil('2026-11-20', new Date(2026, 10, 26))).toBe(-6)
    expect(nextDay('2026-12-31')).toBe('2027-01-01')
  })

  it('rend l’historique lisible', () => {
    const h = (changes: Record<string, unknown>, event = 'updated') => ({ event, subject: 'contract', changes, created_at: null, causer: 'Awa' }) as HrSheet['history'][number]
    expect(historyLine(h({ attributes: { commission_rate: '10.00' }, old: { commission_rate: '8.00' } }))).toBe('commission 8 % → 10 %')
    expect(historyLine(h({}, 'document_added'))).toBe('Document ajouté')
    expect(historyLine(h({}, 'created'))).toBe('Contrat créé')
  })
})
