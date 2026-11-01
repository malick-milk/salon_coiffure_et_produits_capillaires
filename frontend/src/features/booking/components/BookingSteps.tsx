/** Étapes du tunnel de réservation : chaque composant ne fait QU'UNE chose (choisir une prestation, un coiffeur…) */
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useState } from 'react'
import { QueryError } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration, formatLongDate, formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import { cn } from '@/lib/utils'
import type { BusinessHour, Service, Stylist } from '@/types/api'
import { MONTHS, monthGrid, todayIso } from '../calendar'
import { useAvailability } from '../hooks'

export const STEPS = ['Prestation', 'Coiffeur', 'Date et heure', 'Coordonnées', 'Confirmation'] as const

/** Indicateur d'étapes. aria-current="step" annonce l'étape en cours aux lecteurs d'écran. */
export function Stepper({ current }: { current: number }) {
  return (
    <ol aria-label="Étapes de la réservation" className="flex flex-wrap gap-2 sm:gap-2.5">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-full border py-2 pr-4 pl-2 text-sm font-medium',
              active ? 'border-gold bg-gold-soft' : 'border-[#2a2a2a] max-sm:pr-2', // mobile : pastille seule
              !active && !done && 'text-[#a3a3a3]',
            )}
          >
            <span className={cn('flex size-7 items-center justify-center rounded-full text-[13px] font-bold', active || done ? 'bg-gold text-ink' : 'bg-ink-line')}>
              {done ? '✓' : n}
            </span>
            <span className={cn(!active && 'max-sm:sr-only')}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Carte sélectionnable (rôle de bouton à bascule : aria-pressed) */
function ChoiceCard({ selected, onSelect, children, className }: { selected: boolean; onSelect: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn('flex flex-col gap-2 rounded-2xl border-2 p-5 text-left transition-colors', selected ? 'border-gold bg-gold-soft' : 'border-[#2a2a2a] bg-ink hover:border-[#4a4a4a]', className)}
    >
      {children}
    </button>
  )
}

export function ServiceStep({ services, selectedId, onSelect }: { services: Service[]; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((s) => (
        <ChoiceCard key={s.id} selected={s.id === selectedId} onSelect={() => onSelect(s.id)} className="min-h-[150px]">
          <span className="text-[13px] text-muted">{s.category}</span>
          <span className="font-display text-[21px]">{s.name}</span>
          <span className="mt-auto flex items-center gap-1.5 text-[15px] text-[#d9d9d9]">
            <Clock className="size-4" aria-hidden="true" />
            {formatDuration(s.duration_minutes)} · <strong className="text-ivory">{formatPrice(s.price)}</strong>
          </span>
        </ChoiceCard>
      ))}
    </div>
  )
}

export function StylistStep({ stylists, selected, onSelect }: { stylists: Stylist[]; selected: number | 'any' | null; onSelect: (v: number | 'any') => void }) {
  const options = [{ id: 'any' as const, name: 'Peu importe', initial: '?', hint: 'Premier coiffeur disponible' }, ...stylists.map((s) => ({ id: s.id, name: s.display_name, initial: s.display_name.charAt(0), hint: 'Coiffeur du salon' }))]
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-muted">Seuls les coiffeurs qui réalisent cette prestation sont proposés.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {options.map((o) => (
          <ChoiceCard key={o.id} selected={selected === o.id} onSelect={() => onSelect(o.id)} className="min-h-[120px] items-center justify-center text-center">
            <span className="flex size-[52px] items-center justify-center rounded-full bg-ink-line text-lg font-semibold text-gold" aria-hidden="true">{o.initial}</span>
            <span className="font-semibold">{o.name}</span>
            <span className="text-[13px] text-muted">{o.hint}</span>
          </ChoiceCard>
        ))}
      </div>
    </div>
  )
}

const HORIZON_DAYS = 60

export function DateTimeStep({
  serviceId, stylistId, hours, date, time, onDate, onTime,
}: {
  serviceId: number
  stylistId: number | null
  hours: BusinessHour[]
  date: string | null
  time: string | null
  onDate: (d: string) => void
  onTime: (t: string) => void
}) {
  const today = todayIso()
  const [y0, m0] = today.split('-').map(Number) as [number, number]
  const [view, setView] = useState({ year: y0, month: m0 })
  const maxDate = new Date(Date.now() + HORIZON_DAYS * 86_400_000).toISOString().slice(0, 10)
  const closedWeekdays = hours.filter((h) => h.is_closed).map((h) => h.day_of_week)
  const availability = useAvailability(serviceId, stylistId, date)

  const shift = (delta: number) => setView(({ year, month }) => {
    const m = month + delta
    return m < 1 ? { year: year - 1, month: 12 } : m > 12 ? { year: year + 1, month: 1 } : { year, month: m }
  })
  const isFirstMonth = view.year === y0 && view.month === m0
  const isLastMonth = `${view.year}-${String(view.month).padStart(2, '0')}` >= maxDate.slice(0, 7)

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex flex-1 flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Mois précédent" disabled={isFirstMonth} onClick={() => shift(-1)} className="flex size-11 items-center justify-center rounded-full border border-[#3a3a3a] disabled:border-[#2a2a2a] disabled:text-[#4a4a4a]">
            <ChevronLeft className="size-[18px]" aria-hidden="true" />
          </button>
          <p className="font-semibold capitalize" aria-live="polite">{MONTHS[view.month - 1]} {view.year}</p>
          <button type="button" aria-label="Mois suivant" disabled={isLastMonth} onClick={() => shift(1)} className="flex size-11 items-center justify-center rounded-full border border-[#3a3a3a] disabled:border-[#2a2a2a] disabled:text-[#4a4a4a]">
            <ChevronRight className="size-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-[#a3a3a3]" aria-hidden="true">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {monthGrid(view.year, view.month).map((cell, i) => {
            if (!cell.date) return <span key={i} />
            const closed = closedWeekdays.includes(cell.weekday)
            const outOfRange = cell.date < today || cell.date > maxDate
            const disabled = closed || outOfRange
            const selected = cell.date === date
            return (
              <button
                key={cell.date}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={`${formatLongDate(cell.date)}${closed ? ', salon fermé' : ''}`}
                onClick={() => onDate(cell.date!)}
                className={cn(
                  'h-11 rounded-[10px] border text-[15px] font-medium',
                  selected ? 'border-gold bg-gold text-ink' : 'border-[#3a3a3a] hover:border-gold',
                  disabled && 'border-transparent text-[#5a5a5a]',
                  closed && 'line-through',
                )}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
        <p className="text-[13px] text-[#a3a3a3]">Dimanches barrés : salon fermé. Réservation jusqu'à {HORIZON_DAYS} jours à l'avance.</p>
      </div>

      <div className="flex flex-1 flex-col gap-3.5" aria-live="polite">
        <p className="font-semibold first-letter:uppercase">{date ? formatLongDate(date) : 'Horaires disponibles'}</p>
        {!date ? (
          <p className="rounded-xl border border-dashed border-[#3a3a3a] p-5 text-[15px] text-muted">Sélectionnez un jour pour voir les horaires disponibles.</p>
        ) : availability.isError ? (
          <QueryError message={apiErrorMessage(availability.error)} onRetry={() => availability.refetch()} />
        ) : availability.isPending ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-11 rounded-[10px]" />)}</div>
        ) : !availability.data.is_open ? (
          <p className="rounded-xl border border-dashed border-[#3a3a3a] p-5 text-[15px] text-muted">{availability.data.closed_reason}</p>
        ) : availability.data.slots.every((s) => !s.available) ? (
          <p className="rounded-xl border border-dashed border-[#3a3a3a] p-5 text-[15px] text-muted">Plus aucun créneau libre ce jour-là. Essayez un autre jour.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {availability.data.slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.available}
                  aria-pressed={s.time === time}
                  aria-label={`${s.time}${s.available ? '' : ', indisponible'}`}
                  onClick={() => onTime(s.time)}
                  className={cn(
                    'min-h-11 rounded-[10px] border text-[15px] font-medium',
                    s.time === time ? 'border-gold bg-gold font-semibold text-ink' : 'border-[#3a3a3a] hover:border-gold',
                    !s.available && 'border-dashed text-[#6b6b6b] line-through hover:border-[#3a3a3a]',
                  )}
                >
                  {s.time}
                </button>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-[#a3a3a3]">Créneaux calculés selon la durée de la prestation, la pause de midi et les rendez-vous existants. Barré = déjà pris.</p>
          </>
        )}
      </div>
    </div>
  )
}

export function BookingSummary({ service, stylistName, date, time }: { service: Service | null; stylistName: string | null; date: string | null; time: string | null }) {
  const rows: [string, string][] = [
    ['Prestation', service?.name ?? '—'],
    ['Coiffeur', stylistName ?? '—'],
    ['Date', date ? `${formatLongDate(date)}${time ? ` à ${time}` : ''}` : '—'],
    ['Durée', service ? formatDuration(service.duration_minutes) : '—'],
  ]
  return (
    <aside aria-label="Récapitulatif" className="flex flex-col gap-4 rounded-[20px] bg-ivory p-7 text-ink lg:w-[360px] lg:shrink-0">
      <h2 className="font-display text-[22px] font-semibold">Récapitulatif</h2>
      <dl className="flex flex-col">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-[#e4e4e7] py-3 text-[15px]">
            <dt className="text-[#52525b]">{k}</dt>
            <dd className="text-right font-semibold first-letter:uppercase">{v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 pt-4 text-lg">
          <dt>Total</dt>
          <dd className="font-semibold">{service ? formatPrice(service.price) : '—'}</dd>
        </div>
      </dl>
      <p className="text-[13px] leading-relaxed text-[#52525b]">Paiement au salon après la prestation (espèces, Wave, Orange Money, Free Money).</p>
    </aside>
  )
}
