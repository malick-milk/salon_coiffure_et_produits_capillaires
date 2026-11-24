/**
 * « IL MANQUE … » près du bouton d'envoi (maquette validée le 24 novembre 2026).
 * N'apparaît qu'APRÈS un essai refusé ; se met à jour pendant la saisie (react-hook-form revalide à chaque
 * frappe après le 1er envoi) et disparaît quand tout est bon. Chaque ligne amène sur le champ, curseur dedans.
 * Rouge foncé sur rose pâle : lisible sur fond clair comme sur fond sombre, compris sans la couleur (texte + icône).
 */
import { AlertCircle, ChevronRight } from 'lucide-react'
import type { MouseEvent } from 'react'
import { goToField } from '@/lib/focusFirstInvalid'
import type { MissingItem } from '@/lib/missingFields'

export function MissingFieldsSummary({ items, reassurance }: { items: MissingItem[]; reassurance?: string }) {
  if (items.length === 0) return null
  const go = (e: MouseEvent, name: string) => { e.preventDefault(); goToField(name) }
  return (
    <div className="flex flex-col gap-2">
      <div aria-labelledby="missing-title" role="group" className="flex flex-col gap-1.5 rounded-[14px] border-2 border-[#dc2626] bg-[#fef2f2] p-3.5">
        <strong id="missing-title" className="flex items-center gap-2 text-[15px] text-[#991b1b]">
          <AlertCircle className="size-[18px] shrink-0" aria-hidden="true" />
          Il manque {items.length} information{items.length > 1 ? 's' : ''}
        </strong>
        <ul className="flex flex-col text-sm">
          {items.map((i) => (
            <li key={i.name}>
              <a href={`#${i.name}`} onClick={(e) => go(e, i.name)}
                className="flex min-h-10 items-center justify-between gap-3 py-1 font-semibold text-[#991b1b] underline underline-offset-[3px] hover:text-[#7f1d1d]">
                {i.label}<ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
      {reassurance && <p className="text-center text-xs text-[#52525b]">{reassurance}</p>}
    </div>
  )
}
