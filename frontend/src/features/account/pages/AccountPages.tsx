/** Pages de l'espace client (EF-CLI-06 à 11) */
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { ArrowRight, CalendarDays, Check, ChevronLeft, FileText, Package } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { z } from 'zod'
import { applyServerErrors, Field } from '@/components/common/FormField'
import { Seo } from '@/components/common/Seo'
import { EmptyState, QueryError } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/features/auth/hooks'
import { normalizePhone, SENEGAL_MOBILE } from '@/features/booking/schema'
import { formatDuration, formatLongDate, formatPrice } from '@/lib/format'
import { apiErrorMessage, apiErrorStatus, type ValidationErrorBody } from '@/lib/http'
import type { CustomerBooking, OrderSummary } from '@/types/api'
import { useCancelBooking, useMyBookings, useMyOrder, useMyOrders, useUpdateProfile } from '../hooks'

const shortDate = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 19)}Z`))
const time = (iso: string) => iso.slice(11, 16)

function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="font-display text-4xl font-semibold">{children}</h1>
}

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-ink-line bg-ink-soft p-5 sm:p-6 ${className}`}>{children}</section>
)

// ---------- Vue d'ensemble ----------
export function AccountOverviewPage() {
  const { data: user } = useMe()
  const orders = useMyOrders()
  const bookings = useMyBookings()
  const next = bookings.data
    ?.filter((b) => (b.status === 'pending' || b.status === 'confirmed') && b.starts_at >= new Date().toISOString().slice(0, 19))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  const current = orders.data?.find((o) => !['delivered', 'cancelled'].includes(o.status))

  return (
    <div className="flex flex-col gap-7">
      <Seo title="Mon compte" />
      <PageTitle>Bonjour {user?.first_name}</PageTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-gold-dark bg-gold-soft">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-gold uppercase">Prochain rendez-vous</p>
          {bookings.isPending ? <Skeleton className="mt-3 h-16" /> : next ? (
            <div className="mt-3 flex flex-col gap-2">
              <strong className="text-xl first-letter:uppercase">{formatLongDate(next.starts_at.slice(0, 10))} · {time(next.starts_at)}</strong>
              <span className="text-[#d9d9d9]">{next.service_name} avec {next.stylist_name}</span>
              <StatusBadge kind="booking" status={next.status} />
            </div>
          ) : (
            <div className="mt-3 flex flex-col items-start gap-3"><p className="text-muted">Aucun rendez-vous à venir.</p><Button asChild size="sm"><Link to="/reserver">Réserver</Link></Button></div>
          )}
        </Card>
        <Card>
          <p className="text-[13px] font-semibold tracking-[0.14em] text-muted uppercase">Commande en cours</p>
          {orders.isPending ? <Skeleton className="mt-3 h-16" /> : current ? (
            <Link to={`/compte/commandes/${current.reference}`} className="mt-3 flex flex-col gap-2 hover:text-gold">
              <strong className="text-xl">{current.reference}</strong>
              <span className="text-[#d9d9d9]">{current.items_count} article{current.items_count > 1 ? 's' : ''} · {formatPrice(current.total)}</span>
              <StatusBadge kind="order" status={current.status} />
            </Link>
          ) : <p className="mt-3 text-muted">Aucune commande en cours.</p>}
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" size="sm"><Link to="/compte/commandes"><Package aria-hidden="true" />Toutes mes commandes</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/compte/reservations"><CalendarDays aria-hidden="true" />Toutes mes réservations</Link></Button>
      </div>
    </div>
  )
}

// ---------- Commandes ----------
export function OrdersPage() {
  const orders = useMyOrders()
  return (
    <div className="flex flex-col gap-6">
      <Seo title="Mes commandes" />
      <PageTitle>Mes commandes</PageTitle>
      {orders.isError ? <QueryError message={apiErrorMessage(orders.error)} onRetry={() => orders.refetch()} />
        : orders.isPending ? <Skeleton className="h-48" />
        : orders.data.length === 0 ? (
          <EmptyState title="Aucune commande pour l’instant"><Button asChild><Link to="/boutique">Découvrir la boutique</Link></Button></EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.data.map((o) => <OrderRow key={o.reference} order={o} />)}
          </ul>
        )}
    </div>
  )
}

function OrderRow({ order: o }: { order: OrderSummary }) {
  return (
    <li>
      <Link to={`/compte/commandes/${o.reference}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-ink-line bg-ink-soft p-5 hover:border-gold">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <strong>{o.reference}</strong>
          <span className="text-sm text-muted">{shortDate(o.placed_at)} · {o.fulfillment_method === 'pickup' ? 'Retrait en boutique' : 'Livraison'} · {o.items_count} article{o.items_count > 1 ? 's' : ''}</span>
        </div>
        <StatusBadge kind="order" status={o.status} />
        <strong className="w-32 text-right">{formatPrice(o.total)}</strong>
        <ArrowRight className="size-5 text-muted" aria-hidden="true" />
      </Link>
    </li>
  )
}

export function OrderDetailPage() {
  const { reference = '' } = useParams()
  const order = useMyOrder(reference)
  const status = apiErrorStatus(order.error)
  return (
    <div className="flex flex-col gap-6">
      <Seo title={`Commande ${reference}`} />
      <Link to="/compte/commandes" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted hover:text-gold"><ChevronLeft className="size-4" aria-hidden="true" />Mes commandes</Link>
      {order.isError ? (
        status === 403 || status === 404
          ? <EmptyState title="Commande introuvable"><p className="text-muted">Cette commande n’existe pas ou n’est pas associée à votre compte.</p></EmptyState>
          : <QueryError message={apiErrorMessage(order.error)} onRetry={() => order.refetch()} />
      ) : order.isPending ? <Skeleton className="h-96" /> : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <PageTitle>{order.data.reference}</PageTitle>
            <StatusBadge kind="order" status={order.data.status} />
            <StatusBadge kind="payment" status={order.data.payment_status} />
          </div>
          <p className="text-muted">Passée le {shortDate(order.data.placed_at)} à {time(order.data.placed_at)}</p>
          <Card>
            <h2 className="mb-3 font-display text-2xl">Articles</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-[15px]">
                <thead><tr className="border-b border-ink-line text-left text-[13px] text-muted"><th scope="col" className="py-2 font-medium">Produit</th><th scope="col" className="py-2 text-right font-medium">Prix</th><th scope="col" className="py-2 text-right font-medium">Qté</th><th scope="col" className="py-2 text-right font-medium">Total</th></tr></thead>
                <tbody>
                  {order.data.items.map((l, i) => (
                    <tr key={i} className="border-b border-ink-line">
                      <td className="py-3">{l.product_slug ? <Link to={`/produits/${l.product_slug}`} className="hover:text-gold">{l.product_name}</Link> : l.product_name}</td>
                      <td className="py-3 text-right whitespace-nowrap">{formatPrice(l.unit_price)}</td>
                      <td className="py-3 text-right">{l.quantity}</td>
                      <td className="py-3 text-right font-semibold whitespace-nowrap">{formatPrice(l.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 ml-auto flex max-w-xs flex-col gap-2 text-[15px]">
              <div className="flex justify-between"><dt className="text-muted">Sous-total</dt><dd>{formatPrice(order.data.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Livraison</dt><dd>{order.data.shipping_fee ? formatPrice(order.data.shipping_fee) : 'Gratuite'}</dd></div>
              <div className="flex justify-between border-t border-ink-line pt-2 text-lg"><dt>Total</dt><dd className="font-semibold">{formatPrice(order.data.total)}</dd></div>
            </dl>
          </Card>
          <Card>
            <h2 className="mb-2 font-display text-2xl">{order.data.fulfillment_method === 'pickup' ? 'Retrait en boutique' : `Livraison · ${order.data.delivery_zone}`}</h2>
            {order.data.shipping_address ? (
              <p className="text-[#d9d9d9]">{order.data.shipping_address.address_line}{order.data.shipping_address.district && `, ${order.data.shipping_address.district}`}, {order.data.shipping_address.city}{order.data.shipping_address.landmark && ` — repère : ${order.data.shipping_address.landmark}`}</p>
            ) : <p className="text-[#d9d9d9]">Nous vous prévenons par SMS dès que la commande est prête.</p>}
          </Card>
          {order.data.invoice_available ? (
            <Button variant="outline" className="w-fit" disabled title="Génération PDF : étape 6 (Laravel)"><FileText aria-hidden="true" />Facture PDF (bientôt)</Button>
          ) : <p className="text-sm text-muted">La facture sera disponible après le paiement.</p>}
        </>
      )}
    </div>
  )
}

// ---------- Réservations ----------
export function BookingsPage() {
  const bookings = useMyBookings()
  const cancel = useCancelBooking()
  const [confirming, setConfirming] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-6">
      <Seo title="Mes réservations" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Mes réservations</PageTitle>
        <Button asChild size="sm"><Link to="/reserver">Nouvelle réservation</Link></Button>
      </div>
      {cancel.isError && <p role="alert" className="rounded-xl border border-[#b45309] bg-[#2a1a05] p-4 text-[15px]">{apiErrorMessage(cancel.error)}</p>}
      {bookings.isError ? <QueryError message={apiErrorMessage(bookings.error)} onRetry={() => bookings.refetch()} />
        : bookings.isPending ? <Skeleton className="h-48" />
        : bookings.data.length === 0 ? <EmptyState title="Aucune réservation"><Button asChild><Link to="/reserver">Réserver une prestation</Link></Button></EmptyState>
        : (
          <ul className="flex flex-col gap-3">
            {bookings.data.map((b) => (
              <BookingRow
                key={b.reference}
                booking={b}
                confirming={confirming === b.reference}
                pending={cancel.isPending && cancel.variables === b.reference}
                onAsk={() => setConfirming(b.reference)}
                onAbort={() => setConfirming(null)}
                onConfirm={() => cancel.mutate(b.reference, { onSettled: () => setConfirming(null) })}
              />
            ))}
          </ul>
        )}
      <p className="text-sm text-muted">Annulation en ligne possible jusqu’à 24 h avant le rendez-vous. Au-delà, appelez le salon.</p>
    </div>
  )
}

function BookingRow({ booking: b, confirming, pending, onAsk, onAbort, onConfirm }: { booking: CustomerBooking; confirming: boolean; pending: boolean; onAsk: () => void; onAbort: () => void; onConfirm: () => void }) {
  const d = new Date(`${b.starts_at.slice(0, 19)}Z`)
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl border border-ink-line bg-ink-soft p-5">
      <div className="flex w-16 flex-col items-center"><strong className="text-2xl">{d.getUTCDate()}</strong><span className="text-xs text-muted uppercase">{new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(d)}</span></div>
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <strong>{b.service_name}</strong>
        <span className="text-sm text-muted">{time(b.starts_at)} · {formatDuration(b.duration_minutes)} · {b.stylist_name} · {formatPrice(b.price)} · {b.reference}</span>
        {b.status === 'cancelled' && b.cancellation_reason && (
          <span className="text-sm text-[#fca5a5]">Annulé par le salon · Motif : {b.cancellation_reason}. <Link to="/reserver" className="font-semibold text-gold underline">Choisir un autre créneau</Link></span>
        )}
      </div>
      <StatusBadge kind="booking" status={b.status} />
      {b.can_cancel && !confirming && <Button variant="outline" size="sm" onClick={onAsk}>Annuler</Button>}
      {confirming && (
        <div role="group" aria-label="Confirmer l’annulation" className="flex items-center gap-2">
          <span className="text-sm">Annuler ce rendez-vous ?</span>
          <Button size="sm" onClick={onConfirm} disabled={pending}>{pending ? 'Annulation…' : 'Oui, annuler'}</Button>
          <Button size="sm" variant="ghost" onClick={onAbort}>Non</Button>
        </div>
      )}
    </li>
  )
}

// ---------- Profil ----------
const profileSchema = z.object({
  first_name: z.string().trim().min(2, 'Indiquez votre prénom.'),
  last_name: z.string().trim().min(2, 'Indiquez votre nom.'),
  phone: z.string().transform(normalizePhone).refine((v) => SENEGAL_MOBILE.test(v), 'Numéro mobile invalide.'),
})

export function ProfilePage() {
  const { data: user } = useMe()
  const update = useUpdateProfile()
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, setError, formState: { errors, isDirty } } = useForm<z.input<typeof profileSchema>, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { first_name: user?.first_name ?? '', last_name: user?.last_name ?? '', phone: user?.phone ?? '' },
  })
  return (
    <div className="flex flex-col gap-6">
      <Seo title="Profil" />
      <PageTitle>Profil</PageTitle>
      <Card>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={handleSubmit((values) => {
            setSaved(false)
            update.mutate(values, {
              onSuccess: () => setSaved(true),
              onError: (e) => { if (apiErrorStatus(e) === 422 && axios.isAxiosError<ValidationErrorBody>(e)) applyServerErrors(e.response?.data.errors, setError) },
            })
          })}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Prénom" error={errors.first_name?.message}>{(id, d) => <Input id={id} autoComplete="given-name" aria-invalid={!!errors.first_name} aria-describedby={d} {...register('first_name')} />}</Field>
            <Field label="Nom" error={errors.last_name?.message}>{(id, d) => <Input id={id} autoComplete="family-name" aria-invalid={!!errors.last_name} aria-describedby={d} {...register('last_name')} />}</Field>
          </div>
          <Field label="Téléphone mobile" error={errors.phone?.message}>{(id, d) => <Input id={id} type="tel" autoComplete="tel" aria-invalid={!!errors.phone} aria-describedby={d} {...register('phone')} />}</Field>
          <Field label="Email" hint="Pour changer d’email, contactez le salon (vérification d’identité).">{(id, d) => <Input id={id} value={user?.email ?? ''} readOnly aria-describedby={d} className="text-muted" />}</Field>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={update.isPending || !isDirty}>{update.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>
            {saved && <p role="status" className="flex items-center gap-1.5 text-sm text-[#86efac]"><Check className="size-4" aria-hidden="true" />Profil mis à jour</p>}
          </div>
        </form>
      </Card>
    </div>
  )
}
