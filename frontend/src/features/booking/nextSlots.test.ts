/** Réservation express : les 4 prochains créneaux libres, dans l'ordre */
import { describe, expect, it } from 'vitest'
import { addDays, dayLabel, nextSlots } from './nextSlots'

const day = (date: string, slots: [string, boolean][], is_open = true) => ({ date, is_open, closed_reason: null, slots: slots.map(([time, available]) => ({ time, available })) })

describe('nextSlots', () => {
  it('prend les créneaux libres dans l’ordre, en sautant les pris et les jours fermés', () => {
    const days = [
      day('2026-11-24', [['14:00', false], ['15:00', true]]),
      day('2026-11-25', [], false), // fermé
      day('2026-11-26', [['09:00', true], ['10:00', false], ['11:00', true], ['14:00', true]]),
    ]
    expect(nextSlots(days, '2026-11-24').map((s) => `${s.label} ${s.time}`)).toEqual(['Aujourd’hui 15:00', 'Jeudi 26 09:00', 'Jeudi 26 11:00', 'Jeudi 26 14:00'])
  })

  it('un jour pas encore chargé : on s’arrête avant lui (pas de créneau dans le désordre)', () => {
    expect(nextSlots([day('2026-11-24', [['15:00', true]]), undefined, day('2026-11-26', [['09:00', true]])], '2026-11-24')).toHaveLength(1)
  })

  it('libellés et passage de mois', () => {
    expect([dayLabel('2026-11-24', '2026-11-24'), dayLabel('2026-11-25', '2026-11-24'), dayLabel('2026-11-28', '2026-11-24')]).toEqual(['Aujourd’hui', 'Demain', 'Samedi 28'])
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
  })
})
