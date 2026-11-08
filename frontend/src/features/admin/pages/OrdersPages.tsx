/** Commandes : liste filtrable, puis détail avec les actions permises par la machine à états */
import axios from 'axios'
import { ChevronLeft, FileText } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan } from '@/features/auth/permissions'
import { formatPrice, fulfillmentLabel } from '@/lib/format'
import { apiErrorMessage, type ValidationErrorBody } from '@/lib/http'
import type { OrderStatus } from '@/types/api'
import type { PaymentMethod } from '@/types/admin'
import { invoicePdfUrl, useAdminOrder, useAdminOrders, useChangeOrderStatus, useRecordPayment } from '../api'
import { AdminField, AdminInput, AdminSelect, Card, dateTime, Feedback, PageHeader, Table } from '../components/ui'

const ACTION_LABELS: Record<OrderStatus, string> = {
  pending: 'Remettre en attente', confirmed: 'Confirmer', preparing: 'Mettre en préparation', ready: 'Prête à retirer',
  shipped: 'Remettre au livreur', delivered: 'Marquer livrée', cancelled: 'Annuler la commande',
}
const STATUS_FILTERS: Record<OrderStatus, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation', ready: 'Prête à retirer',
  shipped: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée',
}
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', free_money: 'Free Money', card: 'Carte bancaire', bank_transfer: 'Virement',
}

/** Message d'erreur le plus parlant : le premier message de validation, sinon le message général */
export function firstError(error: unknown): string {
  if (axios.isAxiosError<ValidationErrorBody>(error) && error.response?.data.errors) {
    const first = Object.values(error.response.data.errors)[0]?.[0]
    if (first) return first
  }
  return apiErrorMessage(error)
}

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const filters = { status: params.get('status') ?? undefined, payment_status: params.get('payment_status') ?? undefined, search: params.get('search') ?? undefined, page: Number(params.get('page') ?? 1) }
  const orders = useAdminOrders(filters)
  const [search, setSearch] = useState(filters.search ?? '')
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  return (
    <>
      <Seo title="ERP — Commandes" />
      <PageHeader title="Commandes" subtitle={orders.data ? `${orders.data.meta.total} commande(s)` : undefined} />
      <Card>
        <form role="search" className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); update('search', search.trim()) }}>
          <div className="min-w-56 flex-1"><AdminField label="Rechercher (référence, client, téléphone)" htmlFor="o-search"><AdminInput id="o-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></AdminField></div>
          <AdminField label="Statut" htmlFor="o-status">
            <AdminSelect id="o-status" value={filters.status ?? ''} onChange={(e) => update('status', e.target.value)}>
              <option value="">Tous</option>
              {(Object.keys(STATUS_FILTERS) as OrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_FILTERS[s]}</option>)}
            </AdminSelect>
          </AdminField>
          <AdminField label="Paiement" htmlFor="o-pay">
            <AdminSelect id="o-pay" value={filters.payment_status ?? ''} onChange={(e) => update('payment_status', e.target.value)}>
              <option value="">Tous</option><option value="unpaid">À encaisser</option><option value="paid">Payée</option>
            </AdminSelect>
          </AdminField>
          <Button type="submit" variant="dark" size="sm">Filtrer</Button>
        </form>
        {orders.isError ? <QueryError message={apiErrorMessage(orders.error)} onRetry={() => orders.refetch()} />
          : orders.isPending ? <Skeleton className="h-60 bg-[#e4e4e7]" /> : (
            <Table head={['Référence', 'Date', 'Client', 'Mode', 'Articles', 'Statut', 'Paiement', 'Total']} minWidth={860}>
              {orders.data.data.map((o) => (
                <tr key={o.reference}>
                  <td><Link to={`/admin/commandes/${o.reference}`} className="font-semibold underline-offset-4 hover:underline">{o.reference}</Link></td>
                  <td className="whitespace-nowrap">{dateTime(o.placed_at)}</td>
                  <td>{o.customer_name}{o.customer_type === 'reseller' && <span className="ml-1.5 rounded-full bg-[#f4f4f5] px-2 py-0.5 text-xs">revendeur</span>}<br /><span className="text-xs text-[#52525b]">{o.customer_phone}</span></td>
                  <td>{fulfillmentLabel(o.fulfillment_method)}</td>
                  <td>{o.items_count}</td>
                  <td><StatusBadge kind="order" status={o.status} /></td>
                  <td><StatusBadge kind="payment" status={o.payment_status} /></td>
                  <td className="font-semibold whitespace-nowrap">{formatPrice(o.total)}</td>
                </tr>
              ))}
            </Table>
          )}
        {orders.data && orders.data.meta.last_page > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-end gap-3 text-sm">
            <Button variant="subtle" size="sm" disabled={filters.page <= 1} onClick={() => update('page', String(filters.page - 1))}>Précédent</Button>
            Page {orders.data.meta.current_page} / {orders.data.meta.last_page}
            <Button variant="subtle" size="sm" disabled={filters.page >= orders.data.meta.last_page} onClick={() => update('page', String(filters.page + 1))}>Suivant</Button>
          </nav>
        )}
      </Card>
    </>
  )
}

export function OrderDetailPage() {
  const { reference = '' } = useParams()
  const order = useAdminOrder(reference)
  const changeStatus = useChangeOrderStatus(reference)
  const recordPayment = useRecordPayment(reference)
  const canManage = useCan('orders.manage')
  const canInvoice = useCan('invoices.view')
  const [cancelReason, setCancelReason] = useState('')
  const [askCancel, setAskCancel] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [providerRef, setProviderRef] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  if (order.isError) return <QueryError message={apiErrorMessage(order.error)} onRetry={() => order.refetch()} />
  if (order.isPending) return <Skeleton className="h-96 bg-[#e4e4e7]" />
  const o = order.data
  const forward = o.allowed_transitions.filter((s) => s !== 'cancelled')
  const canCancel = o.allowed_transitions.includes('cancelled') && o.payment_status !== 'paid'
  const mutationError = changeStatus.error ?? recordPayment.error

  const go = (status: OrderStatus, reason?: string) => {
    setNotice(null)
    changeStatus.mutate({ status, reason }, { onSuccess: () => { setNotice(`Commande : ${ACTION_LABELS[status].toLowerCase()} — fait.`); setAskCancel(false) } })
  }

  return (
    <>
      <Seo title={`ERP — ${o.reference}`} />
      <Link to="/admin/commandes" className="inline-flex w-fit items-center gap-1 text-sm text-[#52525b] hover:underline"><ChevronLeft className="size-4" aria-hidden="true" />Commandes</Link>
      <PageHeader
        title={o.reference}
        subtitle={`Passée le ${dateTime(o.placed_at)} · ${o.channel === 'store' ? 'en boutique' : 'en ligne'}`}
        actions={<><StatusBadge kind="order" status={o.status} /><StatusBadge kind="payment" status={o.payment_status} /></>}
      />
      {notice && <Feedback kind="success">{notice}</Feedback>}
      {mutationError && <Feedback kind="error">{firstError(mutationError)}</Feedback>}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Articles" className="xl:col-span-2">
          <Table head={['Produit', 'Prix unitaire', 'Qté', 'Total']} minWidth={420}>
            {o.items.map((l, i) => <tr key={i}><td>{l.product_name}</td><td className="whitespace-nowrap">{formatPrice(l.unit_price)}</td><td>{l.quantity}</td><td className="font-semibold whitespace-nowrap">{formatPrice(l.line_total)}</td></tr>)}
          </Table>
          <dl className="ml-auto flex w-full max-w-xs flex-col gap-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-[#52525b]">Sous-total</dt><dd>{formatPrice(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-[#52525b]">Livraison</dt><dd>{o.shipping_fee ? formatPrice(o.shipping_fee) : 'Gratuite'}</dd></div>
            <div className="flex justify-between border-t border-[#e4e4e7] pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatPrice(o.total)}</dd></div>
          </dl>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Client">
            <p className="text-sm"><strong>{o.customer.name}</strong>{o.customer.type === 'reseller' && ' (revendeur)'}<br />{o.customer.phone}{o.customer.email && <><br />{o.customer.email}</>}</p>
            <p className="text-sm">
              <strong>{o.fulfillment_method === 'delivery' ? `Livraison · ${o.delivery_zone}` : o.pickup_point ? `Point de retrait · ${o.pickup_point.name} (${o.pickup_point.city})` : 'Retrait au salon'}</strong>
              {o.pickup_code && <><br />Code de retrait de la cliente : <strong>{o.pickup_code}</strong></>}
              {o.picked_up_at && <><br />Remise confirmée par le partenaire le {dateTime(o.picked_up_at)}</>}
              {o.shipping_address && <><br />{o.shipping_address.address_line}{o.shipping_address.district && `, ${o.shipping_address.district}`}, {o.shipping_address.city}{o.shipping_address.landmark && <><br />Repère : {o.shipping_address.landmark}</>}</>}
            </p>
            {o.customer_notes && <p className="rounded-lg bg-[#f4f4f5] p-3 text-sm">« {o.customer_notes} »</p>}
            {o.cancellation_reason && <p className="text-sm text-[#7f1d1d]">Motif d’annulation : {o.cancellation_reason}</p>}
          </Card>

          {canManage && (forward.length > 0 || canCancel) && (
            <Card title="Faire avancer la commande">
              <div className="flex flex-wrap gap-2">
                {forward.map((s) => <Button key={s} variant="dark" size="sm" disabled={changeStatus.isPending} onClick={() => go(s)}>{ACTION_LABELS[s]}</Button>)}
                {canCancel && !askCancel && <Button variant="subtle" size="sm" onClick={() => setAskCancel(true)}>Annuler…</Button>}
              </div>
              {askCancel && (
                <form className="flex flex-col gap-2.5" onSubmit={(e) => { e.preventDefault(); go('cancelled', cancelReason) }}>
                  <AdminField label="Motif de l’annulation (obligatoire)" htmlFor="cancel-reason"><AdminInput id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required minLength={3} /></AdminField>
                  <p className="text-xs text-[#52525b]">Les produits seront remis en stock.</p>
                  <div className="flex gap-2"><Button type="submit" variant="danger" size="sm" disabled={changeStatus.isPending}>Confirmer l’annulation</Button><Button type="button" variant="subtle" size="sm" onClick={() => setAskCancel(false)}>Retour</Button></div>
                </form>
              )}
            </Card>
          )}

          <Card title="Paiement">
            {o.payments.map((p, i) => <p key={i} className="text-sm">{formatPrice(p.amount)} · {PAYMENT_LABELS[p.method]} · {dateTime(p.paid_at)}{p.provider_reference && ` · réf. ${p.provider_reference}`}</p>)}
            {o.payment_status !== 'paid' && o.status !== 'cancelled' && canManage && (
              <form className="flex flex-col gap-2.5" onSubmit={(e) => { e.preventDefault(); setNotice(null); recordPayment.mutate({ method, provider_reference: providerRef || undefined }, { onSuccess: () => setNotice('Paiement enregistré, facture émise.') }) }}>
                <AdminField label="Moyen de paiement" htmlFor="pay-method">
                  <AdminSelect id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
                  </AdminSelect>
                </AdminField>
                {method !== 'cash' && <AdminField label="Référence de transaction (facultatif)" htmlFor="pay-ref"><AdminInput id="pay-ref" value={providerRef} onChange={(e) => setProviderRef(e.target.value)} /></AdminField>}
                <Button type="submit" variant="dark" size="sm" disabled={recordPayment.isPending}>Encaisser {formatPrice(o.total)}</Button>
                <p className="text-xs text-[#52525b]">Le montant est celui de la commande : il ne peut pas être modifié.</p>
              </form>
            )}
            {o.invoice_number && canInvoice && (
              <a href={invoicePdfUrl(o.invoice_number)} className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d4d4d8] px-4 py-2 text-sm font-semibold hover:bg-[#f4f4f5]">
                <FileText className="size-4" aria-hidden="true" />Facture {o.invoice_number} (PDF)
              </a>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
