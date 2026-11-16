/**
 * Carte « Votre resserrage approche » (maquette validée le 16 novembre 2026).
 * Affichée en tête de la vue d'ensemble et dans la rubrique « Notifications ».
 * « Réserver » ouvre la réservation avec le bon resserrage déjà choisi.
 */
import { Scissors } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import type { AccountNotification } from '@/types/api'
import { useSnoozeNotification } from '../hooks'

export function ResserrageCard({ notification }: { notification: AccountNotification }) {
  const snooze = useSnoozeNotification()
  const r = notification.resserrage
  return (
    <section aria-labelledby={`rappel-${notification.id}`} className="flex flex-col gap-3.5 rounded-[20px] border-2 border-gold bg-gradient-to-br from-[#1d1810] to-ink-soft p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-soft"><Scissors className="size-5 text-gold" aria-hidden="true" /></span>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-[0.14em] text-gold uppercase">Rappel{notification.read ? '' : ' · Nouveau'}</span>
          <h2 id={`rappel-${notification.id}`} className="text-lg font-semibold sm:text-xl">{notification.title}</h2>
        </div>
      </div>
      <p className="leading-relaxed text-[#c9c4b8]">{notification.text}</p>
      <div className="flex flex-wrap items-center gap-2.5">
        {r && (
          <Button asChild>
            <Link to={`/reserver?prestation=${encodeURIComponent(r.slug)}`}>Réserver mon resserrage · {formatPrice(r.price)}</Link>
          </Button>
        )}
        <Button variant="outline" disabled={snooze.isPending} onClick={() => snooze.mutate(notification.id)}>Me le rappeler dans 1 semaine</Button>
      </div>
      {snooze.isError && <p role="alert" className="text-sm text-[#f87171]">{apiErrorMessage(snooze.error)}</p>}
    </section>
  )
}
