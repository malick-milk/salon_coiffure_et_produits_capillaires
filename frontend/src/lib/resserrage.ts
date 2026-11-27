/**
 * DATE CONSEILLÉE DU RESSERRAGE (maquette validée le 27 novembre 2026) : Awa conseille un resserrage 2 mois après
 * chaque twist. Le délai vient du serveur (services.resserrage_after_days) ; ici, le calcul de la date et le fichier
 * « Ajouter à mon agenda » (.ics, lu par les agendas Google, Apple, Outlook).
 */

/** « 2026-11-29 » + 60 jours → « 2027-01-28 » (calcul en UTC : jamais de décalage d'un jour) */
export function addDaysIso(isoDate: string, days: number): string {
  const [y = 0, m = 1, d = 1] = isoDate.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Jours entre aujourd'hui et la date (négatif = passée) */
export function daysFromToday(isoDate: string, today = new Date()): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const [y = 0, m = 1, d = 1] = isoDate.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - t) / 86_400_000)
}

/** Texte d'un événement d'une journée au format iCalendar (RFC 5545) */
export function resserrageIcs(isoDate: string, title: string, description: string, uid: string): string {
  const day = isoDate.replaceAll('-', '')
  const next = addDaysIso(isoDate, 1).replaceAll('-', '')
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dabo Hair//Resserrage//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${uid}@dabohair.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(description)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:-P7D', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n')
}

/** Enregistre le fichier .ics : le téléphone propose de l'ouvrir dans l'agenda */
export function downloadIcs(content: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
