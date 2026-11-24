/**
 * « RÉSERVER UN TWIST EN 1 CLIC » sur l'accueil (maquette validée le 24 novembre 2026).
 * Les 4 prochains créneaux libres du twist simple, avec la première coiffeuse libre. Toucher un créneau ouvre
 * la réservation à la dernière étape (coordonnées) : 3 touchers pour une cliente connectée au lieu d'environ 10.
 * Les jours sont demandés un par un (aujourd'hui, demain…) et on s'arrête dès qu'on a 4 créneaux (7 jours au plus).
 */
import { useQueries } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { formatDuration, formatPrice } from '@/lib/format'
import { fetchAvailability } from '../api'
import { useServices } from '../hooks'
import { addDays, nextSlots } from '../nextSlots'

export const EXPRESS_SERVICE = 'twist-simple'
const WANTED = 4
const MAX_DAYS = 7

export function TwistExpress() {
  const services = useServices()
  const service = services.data?.find((s) => s.slug === EXPRESS_SERVICE) ?? null
  const today = new Date().toISOString().slice(0, 10) // Dakar = UTC
  const [dayCount, setDayCount] = useState(2) // aujourd'hui et demain d'abord
  const dates = Array.from({ length: dayCount }, (_, i) => addDays(today, i))
  const days = useQueries({
    queries: dates.map((date) => ({
      queryKey: ['availability', service?.id ?? null, null, date],
      queryFn: () => fetchAvailability({ serviceId: service!.id, stylistId: null, date }),
      enabled: service !== null,
      staleTime: 30_000,
    })),
  })
  const loaded = days.every((d) => d.isSuccess)
  const slots = nextSlots(days.map((d) => d.data), today, WANTED)
  // Pas assez de créneaux sur les jours chargés : on regarde le jour suivant
  useEffect(() => {
    if (loaded && slots.length < WANTED && dayCount < MAX_DAYS) setDayCount((n) => n + 1)
  }, [loaded, slots.length, dayCount])

  if (!service) return null
  const searching = !loaded || (slots.length < WANTED && dayCount < MAX_DAYS)

  return (
    <section aria-labelledby="twist-express" className="mx-auto flex max-w-7xl flex-col gap-3.5 rounded-[20px] border border-[#2b2516] bg-ink-soft p-4 sm:p-6">
      <h2 id="twist-express" className="font-display text-[22px] font-semibold sm:text-[26px]">Réserver un twist en 1 clic</h2>
      <p className="text-sm text-[#c9c4b8] sm:text-[15px]">
        {service.name} · {formatDuration(service.duration_minutes)} · <strong className="text-gold">{formatPrice(service.price)}</strong> · avec la première coiffeuse libre
      </p>
      <span className="text-xs font-semibold tracking-[0.1em] text-[#a8a29e] uppercase">Prochains créneaux libres</span>
      {slots.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {slots.map((s, i) => (
            <li key={`${s.date} ${s.time}`}>
              <Link
                to={`/reserver?prestation=${EXPRESS_SERVICE}&date=${s.date}&heure=${s.time}`}
                aria-label={`Réserver le ${service.name} ${s.label.toLowerCase()} à ${s.time}`}
                className={`flex min-h-[52px] flex-col items-center justify-center rounded-[14px] hover:border-gold ${i === 0 ? 'border-2 border-gold bg-[#1a1710]' : 'border border-[#3a3a3a]'}`}
              >
                <span className={`text-xs ${i === 0 ? 'font-semibold text-gold' : 'text-[#c9c4b8]'}`}>{s.label}</span>
                <strong className="text-[17px]">{s.time}</strong>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#c9c4b8]">{searching ? 'Recherche des créneaux libres…' : 'Aucun créneau libre cette semaine.'}</p>
      )}
      <Link to="/reserver" className="self-center py-1.5 text-sm font-semibold text-gold underline-offset-4 hover:underline">Un autre jour ou un autre twist</Link>
    </section>
  )
}
