import { describe, expect, it } from 'vitest'
import { addDaysIso, daysFromToday, resserrageIcs } from './resserrage'

describe('resserrage', () => {
  it('calcule la date conseillée sans décalage, même à cheval sur l’année', () => {
    expect(addDaysIso('2026-11-29T10:00:00', 60)).toBe('2027-01-28')
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('compte les jours restants', () => {
    expect(daysFromToday('2027-01-26', new Date(2026, 10, 27, 23, 0))).toBe(60)
  })
  it('produit un événement d’une journée avec un rappel 7 jours avant', () => {
    const ics = resserrageIcs('2027-01-28', 'Resserrage twist simple, Dabo Hair', 'Réservez sur dabohair.com, 77 602 62 00', 'RDV-1')
    expect(ics).toContain('DTSTART;VALUE=DATE:20270128')
    expect(ics).toContain('DTEND;VALUE=DATE:20270129')
    expect(ics).toContain('SUMMARY:Resserrage twist simple\\, Dabo Hair')
    expect(ics).toContain('TRIGGER:-P7D')
    expect(resserrageIcs('2027-01-28', 'A;B', 'x', 'u')).toContain('SUMMARY:A\\;B')
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
  })
})
