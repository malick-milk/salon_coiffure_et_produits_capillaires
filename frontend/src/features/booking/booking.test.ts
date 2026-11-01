import { bookingReducer, canContinue } from './pages/BookingPage'
import { contactSchema } from './schema'

const start = { step: 1 as const, serviceId: null, stylist: null, date: null, time: null, confirmation: null }

describe('tunnel de réservation (reducer)', () => {
  it('impossible de continuer sans avoir choisi de prestation', () => {
    expect(canContinue(start)).toBe(false)
    expect(bookingReducer(start, { type: 'next' }).step).toBe(1)
  })

  it('changer de prestation efface le coiffeur et l’heure déjà choisis', () => {
    const s = { ...start, step: 3 as const, serviceId: 1, stylist: 2 as const, date: '2026-11-14', time: '10:00' }
    const next = bookingReducer(s, { type: 'service', id: 2 })
    expect(next.stylist).toBeNull()
    expect(next.time).toBeNull()
    expect(next.date).toBe('2026-11-14')
  })

  it('un conflit (409) ramène au choix de l’heure', () => {
    const s = { ...start, step: 4 as const, serviceId: 1, stylist: 'any' as const, date: '2026-11-14', time: '10:00' }
    const next = bookingReducer(s, { type: 'slotTaken' })
    expect(next.step).toBe(3)
    expect(next.time).toBeNull()
  })
})

describe('validation des coordonnées (Zod)', () => {
  const valid = { first_name: 'Awa', last_name: 'Ndiaye', phone: '77 123 45 67', email: '', notes: '', consent: true }

  it('accepte un mobile sénégalais avec ou sans indicatif, et le normalise', () => {
    expect(contactSchema.parse(valid).phone).toBe('771234567')
    expect(contactSchema.parse({ ...valid, phone: '+221 78 000 11 22' }).phone).toBe('+221780001122')
  })

  it('refuse un numéro invalide, un email invalide et l’absence de consentement', () => {
    expect(contactSchema.safeParse({ ...valid, phone: '33 821 00 00' }).success).toBe(false) // fixe, pas mobile
    expect(contactSchema.safeParse({ ...valid, email: 'awa@' }).success).toBe(false)
    expect(contactSchema.safeParse({ ...valid, consent: false }).success).toBe(false)
  })
})
