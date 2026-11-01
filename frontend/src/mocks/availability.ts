/**
 * CALCUL DES CRÉNEAUX DISPONIBLES (règles RG-RES-01 à RG-RES-03).
 *
 * Fonction PURE : mêmes entrées => même résultat, aucun accès réseau ni à l'horloge
 * (« maintenant » est passé en paramètre). C'est ce qui la rend facile à tester.
 *
 * Aujourd'hui, le faux serveur (MSW) l'utilise. À l'étape 6, la même logique sera écrite
 * en PHP dans App\Services\Booking\AvailabilityService, et validée par les MÊMES cas de test
 * (availability.test.ts sert de spécification).
 */
import type { BusinessHour, DayAvailability } from '@/types/api'

export interface ExistingBooking {
  stylistId: number
  date: string // "2026-11-14"
  start: string // "10:00"
  end: string // "13:15" (fin de prestation + battement)
}

export interface Closure {
  startsOn: string
  endsOn: string
  reason: string
}

export interface AvailabilityInput {
  date: string // jour demandé "YYYY-MM-DD"
  durationMinutes: number
  bufferMinutes: number // temps de nettoyage après la prestation
  stylistIds: number[] // coiffeurs possibles (un seul si le client a choisi)
  hours: BusinessHour[]
  closures: Closure[]
  bookings: ExistingBooking[] // réservations ACTIVES (en attente ou confirmées)
  now: Date
  minNoticeMinutes: number // délai minimal avant le créneau (120 = 2 h)
  maxHorizonDays: number // réservation possible jusqu'à J+60
  stepMinutes?: number // un créneau toutes les 30 min
}

export interface SlotResult {
  time: string
  available: boolean
  freeStylistIds: number[] // pour affecter un coiffeur quand le client choisit « peu importe »
}

export interface AvailabilityResult extends Omit<DayAvailability, 'slots'> {
  slots: SlotResult[]
}

/** "10:30" -> 630 minutes depuis minuit */
export const toMinutes = (hhmm: string): number => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** 630 -> "10:30" */
export const toHHMM = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Jour ISO : 1 = lundi … 7 = dimanche (getUTCDay renvoie 0 pour dimanche) */
export const isoWeekday = (date: string): number => {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

/** Deux intervalles [a, b[ et [c, d[ se chevauchent si a < d ET c < b (formule à retenir) */
export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  aStart < bEnd && bStart < aEnd

/** Date + heure locales (Dakar = UTC+0 toute l'année) en timestamp */
const at = (date: string, minutes: number): number => Date.parse(`${date}T${toHHMM(minutes)}:00Z`)

export function computeDayAvailability(input: AvailabilityInput): AvailabilityResult {
  const { date, durationMinutes, bufferMinutes, stylistIds, now } = input
  const step = input.stepMinutes ?? 30
  const closed = (reason: string): AvailabilityResult => ({ date, is_open: false, closed_reason: reason, slots: [] })

  // 1. Fermeture exceptionnelle (jour férié, Tabaski…)
  const closure = input.closures.find((c) => date >= c.startsOn && date <= c.endsOn)
  if (closure) return closed(closure.reason)

  // 2. Horaires du jour de la semaine
  const hours = input.hours.find((h) => h.day_of_week === isoWeekday(date))
  if (!hours || hours.is_closed || !hours.opens_at || !hours.closes_at) return closed('Salon fermé ce jour-là')

  // 3. Horizon de réservation (RG-RES-03)
  const horizonEnd = now.getTime() + input.maxHorizonDays * 86_400_000
  if (at(date, 0) > horizonEnd) return closed(`Réservation possible jusqu'à ${input.maxHorizonDays} jours à l'avance`)

  const open = toMinutes(hours.opens_at)
  const close = toMinutes(hours.closes_at)
  const breakStart = hours.break_start ? toMinutes(hours.break_start) : null
  const breakEnd = hours.break_end ? toMinutes(hours.break_end) : null
  const earliest = now.getTime() + input.minNoticeMinutes * 60_000

  const dayBookings = input.bookings.filter((b) => b.date === date)
  const slots: SlotResult[] = []

  for (let start = open; start + durationMinutes <= close; start += step) {
    const end = start + durationMinutes

    // 4. La prestation ne doit pas empiéter sur la pause : le créneau n'est même pas proposé
    if (breakStart !== null && breakEnd !== null && overlaps(start, end, breakStart, breakEnd)) continue

    // 5. Délai minimal (2 h) : un créneau trop proche est affiché mais indisponible
    const tooSoon = at(date, start) < earliest

    // 6. Coiffeurs libres : aucune réservation active ne chevauche [début, fin + battement[
    const freeStylistIds = tooSoon
      ? []
      : stylistIds.filter(
          (id) =>
            !dayBookings.some(
              (b) => b.stylistId === id && overlaps(start, end + bufferMinutes, toMinutes(b.start), toMinutes(b.end)),
            ),
        )

    slots.push({ time: toHHMM(start), available: freeStylistIds.length > 0, freeStylistIds })
  }

  return { date, is_open: true, closed_reason: null, slots }
}
