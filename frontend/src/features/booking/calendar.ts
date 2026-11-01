/** Outils de calendrier (sans bibliothèque) : construire la grille d'un mois, commençant le lundi */

export const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** Date du jour à Dakar (UTC+0) au format YYYY-MM-DD */
export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10)

export interface CalendarCell {
  date: string | null // null = case vide avant le 1er ou après le dernier jour
  day: number
  weekday: number // 1 = lundi … 7 = dimanche
}

export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay() // 0 = dimanche
  const leading = (first + 6) % 7 // nombre de cases vides avant le 1er (semaine commençant lundi)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: CalendarCell[] = Array.from({ length: leading }, () => ({ date: null, day: 0, weekday: 0 }))
  for (let d = 1; d <= daysInMonth; d++) {
    const wd = new Date(Date.UTC(year, month - 1, d)).getUTCDay()
    cells.push({ date: isoDate(year, month, d), day: d, weekday: wd === 0 ? 7 : wd })
  }
  while (cells.length % 7) cells.push({ date: null, day: 0, weekday: 0 })
  return cells
}

export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
