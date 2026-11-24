/**
 * Réservation express de l'accueil (maquette validée le 24 novembre 2026) : les prochains créneaux libres.
 * Les jours arrivent dans l'ordre (aujourd'hui, demain…) ; on garde les `limit` premiers créneaux libres.
 * Heure de Dakar = UTC toute l'année : les dates sont calculées en UTC.
 */
import type { DayAvailability } from '@/types/api'

export interface NextSlot { date: string; time: string; label: string }

/** « 2026-11-24 » + n jours */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** « Aujourd’hui », « Demain », puis « Samedi 28 » */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Aujourd’hui'
  if (date === addDays(today, 1)) return 'Demain'
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', timeZone: 'UTC' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function nextSlots(days: (DayAvailability | undefined)[], today: string, limit = 4): NextSlot[] {
  const out: NextSlot[] = []
  for (const day of days) {
    if (!day) break // un jour pas encore chargé : on attend, pour garder l'ordre
    for (const slot of day.slots) {
      if (out.length >= limit) return out
      if (slot.available) out.push({ date: day.date, time: slot.time, label: dayLabel(day.date, today) })
    }
  }
  return out
}
