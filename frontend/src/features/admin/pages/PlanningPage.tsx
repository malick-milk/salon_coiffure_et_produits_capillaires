/** Planning du salon (EF-RES-10) : une semaine, regroupée par jour, avec les actions possibles */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan } from '@/features/auth/permissions'
import { formatDuration, formatLongDate, formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import type { BookingStatus } from '@/types/api'
import type { AdminBooking } from '@/types/admin'
import { useAdminBookings, useChangeBookingStatus } from '../api'
import { AdminInput, Card, Feedback, PageHeader } from '../components/ui'
import { firstError } from './OrdersPages'

const ACTIONS: Record<BookingStatus, string> = { pending: '', confirmed: 'Confirmer', completed: 'Terminé', no_show: 'Absent', cancelled: 'Annuler' }

/** Lundi de la semaine contenant la date (semaine du lundi au dimanche) */
function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d
}
const iso = (d: Date) => d.toISOString().slice(0, 10)

export function PlanningPage() {
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const sunday = new Date(monday.getTime() + 6 * 86_400_000)
  const bookings = useAdminBookings(iso(monday), iso(sunday))
  const change = useChangeBookingStatus()
  const canManage = useCan('bookings.manage')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const byDay = new Map<string, AdminBooking[]>()
  for (const b of bookings.data ?? []) byDay.set(b.starts_at.slice(0, 10), [...(byDay.get(b.starts_at.slice(0, 10)) ?? []), b])

  const act = (b: AdminBooking, status: BookingStatus, why?: string) =>
    change.mutate({ reference: b.reference, status, reason: why }, { onSuccess: () => { setCancelling(null); setReason('') } })

  return (
    <>
      <Seo title="ERP — Planning" />
      <PageHeader
        title="Planning"
        subtitle={`Semaine du ${formatLongDate(iso(monday))} au ${formatLongDate(iso(sunday))}`}
        actions={
          <>
            <Button variant="subtle" size="sm" aria-label="Semaine précédente" onClick={() => setMonday(new Date(monday.getTime() - 7 * 86_400_000))}><ChevronLeft aria-hidden="true" /></Button>
            <Button variant="subtle" size="sm" onClick={() => setMonday(mondayOf(new Date()))}>Cette semaine</Button>
            <Button variant="subtle" size="sm" aria-label="Semaine suivante" onClick={() => setMonday(new Date(monday.getTime() + 7 * 86_400_000))}><ChevronRight aria-hidden="true" /></Button>
          </>
        }
      />
      {change.isError && <Feedback kind="error">{firstError(change.error)}</Feedback>}
      {bookings.isError ? <QueryError message={apiErrorMessage(bookings.error)} onRetry={() => bookings.refetch()} />
        : bookings.isPending ? <Skeleton className="h-80 bg-[#e4e4e7]" />
        : byDay.size === 0 ? <Card><p className="text-sm text-[#52525b]">Aucun rendez-vous cette semaine.</p></Card>
        : [...byDay.entries()].map(([day, list]) => (
          <Card key={day} title={formatLongDate(day).replace(/^./, (c) => c.toUpperCase())}>
            <ul className="flex flex-col gap-2.5">
              {list.map((b) => (
                <li key={b.reference} className="flex flex-col gap-3 rounded-xl border border-[#e4e4e7] p-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <strong className="w-14 text-lg">{b.starts_at.slice(11, 16)}</strong>
                    <span className="flex min-w-52 flex-1 flex-col text-sm">
                      <span className="font-semibold">{b.service_name} · {formatDuration(b.duration_minutes)} · {formatPrice(b.price)}</span>
                      <span className="text-[#52525b]">{b.customer_name} ({b.customer_phone}) · avec {b.stylist_name} · {b.reference}</span>
                      {b.customer_notes && <span className="text-[#52525b]">« {b.customer_notes} »</span>}
                    </span>
                    <StatusBadge kind="booking" status={b.status} />
                    {canManage && (
                      <div className="flex flex-wrap gap-2">
                        {b.allowed_transitions.filter((s) => s !== 'cancelled').map((s) => (
                          <Button key={s} size="sm" variant="dark" disabled={change.isPending} onClick={() => act(b, s)}>{ACTIONS[s]}</Button>
                        ))}
                        {b.allowed_transitions.includes('cancelled') && <Button size="sm" variant="subtle" onClick={() => setCancelling(b.reference)}>Annuler…</Button>}
                      </div>
                    )}
                  </div>
                  {cancelling === b.reference && (
                    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); act(b, 'cancelled', reason) }}>
                      <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-semibold">Motif (prévenir le client)<AdminInput value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} /></label>
                      <Button type="submit" size="sm" variant="danger">Confirmer l’annulation</Button>
                      <Button type="button" size="sm" variant="subtle" onClick={() => setCancelling(null)}>Retour</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
    </>
  )
}
