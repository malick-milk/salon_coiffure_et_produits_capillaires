/**
 * SPÉCIFICATION EXÉCUTABLE des disponibilités (RG-RES-01 à 03).
 * Ces cas seront repris tels quels pour tester le AvailabilityService PHP (étape 6).
 */
import type { BusinessHour } from '@/types/api'
import { computeDayAvailability, overlaps, type AvailabilityInput } from './availability'

const week: BusinessHour[] = [1, 2, 3, 4].map((d) => ({ day_of_week: d, is_closed: false, opens_at: '09:00', closes_at: '19:00', break_start: '13:00', break_end: '14:00' }))
week.push({ day_of_week: 5, is_closed: false, opens_at: '09:00', closes_at: '19:00', break_start: '13:00', break_end: '15:00' })
week.push({ day_of_week: 6, is_closed: false, opens_at: '09:00', closes_at: '20:00', break_start: null, break_end: null })
week.push({ day_of_week: 7, is_closed: true, opens_at: null, closes_at: null, break_start: null, break_end: null })

// Lundi 9 novembre 2026, « maintenant » = dimanche 8 novembre à 10 h
const base: AvailabilityInput = {
  date: '2026-11-09',
  durationMinutes: 180,
  bufferMinutes: 15,
  stylistIds: [1, 2],
  hours: week,
  closures: [{ startsOn: '2026-12-25', endsOn: '2026-12-25', reason: 'Fermé : Noël' }],
  bookings: [],
  now: new Date('2026-11-08T10:00:00Z'),
  minNoticeMinutes: 120,
  maxHorizonDays: 60,
}
const times = (input: AvailabilityInput) => computeDayAvailability(input).slots.map((s) => s.time)
const free = (input: AvailabilityInput) => computeDayAvailability(input).slots.filter((s) => s.available).map((s) => s.time)

describe('chevauchement de deux intervalles', () => {
  it('détecte un chevauchement partiel, mais pas deux intervalles qui se touchent', () => {
    expect(overlaps(600, 780, 720, 900)).toBe(true) // 10:00-13:00 et 12:00-15:00
    expect(overlaps(600, 780, 780, 900)).toBe(false) // 10:00-13:00 puis 13:00-15:00 : bord à bord
  })
})

describe('créneaux proposés', () => {
  it('une prestation de 3 h un lundi ne déborde ni sur la pause ni après la fermeture', () => {
    expect(times(base)).toEqual(['09:00', '09:30', '10:00', '14:00', '14:30', '15:00', '15:30', '16:00'])
  })

  it('le samedi, sans pause et fermeture à 20 h, les créneaux vont jusqu’à 17 h', () => {
    const slots = times({ ...base, date: '2026-11-14' })
    expect(slots[0]).toBe('09:00')
    expect(slots.at(-1)).toBe('17:00')
    expect(slots).toContain('12:00')
  })

  it('le vendredi, la pause va jusqu’à 15 h', () => {
    expect(times({ ...base, date: '2026-11-13', durationMinutes: 60 })).not.toContain('14:00')
    expect(times({ ...base, date: '2026-11-13', durationMinutes: 60 })).toContain('15:00')
  })
})

describe('jours fermés et limites', () => {
  it('le dimanche est fermé', () => {
    const r = computeDayAvailability({ ...base, date: '2026-11-15' })
    expect(r.is_open).toBe(false)
    expect(r.slots).toEqual([])
  })

  it('une fermeture exceptionnelle est annoncée avec son motif', () => {
    const r = computeDayAvailability({ ...base, date: '2026-12-25', now: new Date('2026-12-01T10:00:00Z') })
    expect(r.is_open).toBe(false)
    expect(r.closed_reason).toBe('Fermé : Noël')
  })

  it('au-delà de 60 jours, on ne peut pas réserver', () => {
    expect(computeDayAvailability({ ...base, date: '2027-02-01' }).is_open).toBe(false)
  })

  it('un créneau à moins de 2 h est affiché mais indisponible', () => {
    const r = computeDayAvailability({ ...base, durationMinutes: 60, now: new Date('2026-11-09T09:15:00Z') })
    const status = Object.fromEntries(r.slots.map((s) => [s.time, s.available]))
    expect(status['09:00']).toBe(false)
    expect(status['11:00']).toBe(false) // 11:00 < 9:15 + 2 h = 11:15
    expect(status['11:30']).toBe(true)
  })
})

describe('réservations existantes', () => {
  const fatouBusy = { stylistId: 1, date: '2026-11-09', start: '10:00', end: '13:15' }

  it('avec un seul coiffeur choisi, ses créneaux occupés deviennent indisponibles (battement inclus)', () => {
    const slots = free({ ...base, durationMinutes: 60, bufferMinutes: 10, stylistIds: [1], bookings: [fatouBusy] })
    // 09:00 + 1 h + 10 min de battement = 10:10 > 10:00 (début du RDV de Fatou) : indisponible
    expect(slots).not.toContain('09:00')
    expect(slots).not.toContain('09:30')
    expect(slots).not.toContain('11:00')
    expect(slots).toContain('14:00')
  })

  it('« peu importe » : le créneau reste libre si un autre coiffeur est disponible, et c’est lui qui est proposé', () => {
    const r = computeDayAvailability({ ...base, durationMinutes: 60, bufferMinutes: 10, bookings: [fatouBusy] })
    const slot = r.slots.find((s) => s.time === '11:00')!
    expect(slot.available).toBe(true)
    expect(slot.freeStylistIds).toEqual([2])
  })

  it('une réservation un autre jour ne gêne pas', () => {
    expect(free({ ...base, stylistIds: [1], bookings: [{ ...fatouBusy, date: '2026-11-10' }] })).toContain('10:00')
  })
})
