/**
 * Formatage des données pour l'affichage.
 * Règle du projet : les montants sont des ENTIERS en XOF (le FCFA n'a pas de centimes).
 */

const xof = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** 6500 -> "6 500 F CFA" (espace normale, plus lisible et prévisible que l'espace fine d'Intl) */
export function formatPrice(amount: number): string {
  return `${xof.format(amount).replace(/[\u202f\u00a0]/g, ' ')} F CFA`
}

/** 90 -> "1 h 30", 180 -> "3 h", 45 -> "45 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m}`
}

const longDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Africa/Dakar',
})

/** "2026-11-14" -> "samedi 14 novembre 2026" */
export function formatLongDate(isoDate: string): string {
  // Midi UTC : évite qu'un décalage horaire fasse basculer la date au jour précédent
  return longDate.format(new Date(`${isoDate}T12:00:00Z`))
}

/** Quantité affichée en douzaines quand c'est pertinent : 48 -> "4 douzaines (48)" */
export function formatDozens(units: number): string {
  if (units % 12 !== 0) return `${units}`
  const dozens = units / 12
  return `${dozens} douzaine${dozens > 1 ? 's' : ''} (${units})`
}
