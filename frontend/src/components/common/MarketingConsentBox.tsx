/**
 * Case « nouveautés et offres par e-mail » : DISTINCTE de la politique de confidentialité, NON cochée, FACULTATIVE
 * (loi n° 2008-12). Refuser n'empêche ni l'inscription, ni la commande, ni la réservation.
 * Masquée pour une cliente connectée qui a déjà accepté (inutile de redemander).
 */
import type { ComponentProps } from 'react'
import { MARKETING_HINT, MARKETING_TEXT } from '@/content/consent'
import { usePreferences } from '@/features/account/hooks'

export function MarketingConsentBox(props: ComponentProps<'input'>) {
  const prefs = usePreferences()
  if (prefs.data?.marketing_email) return null
  const [before, after] = MARKETING_TEXT.split('nouveautés et offres')
  return (
    <label className="flex items-start gap-3 rounded-[14px] border border-gold/60 bg-[#1d1810] p-3.5 text-sm leading-relaxed text-[#e6e1d6]">
      <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 accent-gold" {...props} />
      <span>
        {before}<strong className="font-semibold text-ivory">nouveautés et offres</strong>{after}
        <span className="mt-0.5 block text-xs text-muted">{MARKETING_HINT}</span>
      </span>
    </label>
  )
}
