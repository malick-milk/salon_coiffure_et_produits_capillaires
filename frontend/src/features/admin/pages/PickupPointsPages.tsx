/**
 * ERP « Points de retrait » (étape 14) : boutiques partenaires dans les régions.
 * Cycle mensuel : livraison (bon de dépôt) → relevé (comptage des restants) → versement au plus tard le 5.
 * Les calculs (ventes, commission, montant dû) sont faits par le SERVEUR : l'écran affiche, il ne décide pas.
 */
import { AlertTriangle, FileDown } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import { cn } from '@/lib/utils'
import type { ConsignmentStatementRow, PaymentMethod, PickupPointDetail, StatementPreview } from '@/types/admin'
import {
  deliveryPdfUrl, fetchStatementPreview, statementPdfUrl, useAdminProducts, useCreatePickupPoint, useDeliverToPoint,
  usePickupPointAdmin, usePickupPointsAdmin, useStatementPayment, useValidateStatement,
} from '../api'
import { AdminInput, AdminSelect, Card, Feedback, Kpi, PageHeader, Table, dateTime } from '../components/ui'
import { firstError, PAYMENT_LABELS } from './OrdersPages'

const STATE: Record<ConsignmentStatementRow['payment_state'], { label: string; cls: string }> = {
  paid: { label: 'Payé', cls: 'bg-[#dff3e4] text-[#14532d]' },
  due: { label: 'À payer avant le 5', cls: 'bg-[#fff7e6] text-gold-text' },
  overdue: { label: 'En retard', cls: 'bg-[#fde2e2] text-[#7f1d1d]' },
}
const PaymentBadge = ({ s }: { s: ConsignmentStatementRow }) => <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', STATE[s.payment_state].cls)}>{STATE[s.payment_state].label}</span>
const monthLabel = (period: string) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-15T12:00:00Z`))
const previousMonth = () => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7) }

// ---------- Liste ----------
export function PickupPointsPage() {
  const points = usePickupPointsAdmin()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <Seo title="ERP — Points de retrait" />
      <PageHeader title="Points de retrait partenaires" subtitle="Boutiques des régions : stock confié (il reste à Dabo Hair), retrait des commandes en ligne, vente au comptoir au prix du site."
        actions={<Button size="sm" variant="dark" onClick={() => setCreating(!creating)}>{creating ? 'Fermer' : 'Ajouter un point de retrait'}</Button>} />
      {creating && <CreatePointForm regions={points.data?.summary.regions ?? []} onDone={() => setCreating(false)} />}
      {points.isError ? <QueryError message={apiErrorMessage(points.error)} onRetry={() => points.refetch()} />
        : points.isPending ? <Skeleton className="h-80 bg-[#e4e4e7]" />
        : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Points actifs" value={points.data.summary.active} hint={`${points.data.summary.regions_covered.length} région(s) sur 14`} />
              <Kpi label="À encaisser" value={formatPrice(points.data.summary.amount_to_collect)} hint="Relevés validés non payés" />
              <Kpi label="Versements en retard" value={points.data.summary.overdue} tone={points.data.summary.overdue ? 'warn' : 'good'} hint="Après le 5 du mois" />
              <Kpi label="À investiguer" value={points.data.summary.investigations} tone={points.data.summary.investigations ? 'warn' : 'good'} hint="Abîmés deux mois de suite" />
            </div>
            <Card title="Partenaires">
              {points.data.data.length === 0 ? <p className="text-sm text-[#52525b]">Aucun point de retrait pour le moment.</p> : (
                <Table head={['Boutique', 'Régions', 'Stock confié', 'À remettre', 'Dernier relevé', 'À verser', 'Paiement']} minWidth={860}>
                  {points.data.data.map((p) => (
                    <tr key={p.id}>
                      <td><Link to={`/admin/points-de-retrait/${p.id}`} className="font-semibold underline">{p.name}</Link><br /><span className="text-xs text-[#71717a]">{p.owner_name} · {p.phone}{!p.is_active && ' · inactif'}</span>
                        {p.needs_investigation && <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-[#b91c1c]"><AlertTriangle className="size-3.5" aria-hidden="true" />à investiguer</span>}</td>
                      <td>{p.regions.join(', ')}</td>
                      <td>{p.stock_units} · {formatPrice(p.stock_value)}</td>
                      <td>{p.orders_to_hand_over}</td>
                      <td>{p.last_statement ? `${monthLabel(p.last_statement.period)} · ${p.last_statement.sold_qty} vendus` : '—'}</td>
                      <td className="font-semibold">{p.last_statement ? formatPrice(p.last_statement.amount_due) : '—'}</td>
                      <td>{p.last_statement ? <PaymentBadge s={p.last_statement} /> : '—'}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
            <Card title="Régions couvertes">
              <div className="flex flex-wrap gap-2">
                {points.data.summary.regions.map((r) => (
                  <span key={r} className={cn('rounded-full px-3 py-1.5 text-sm', points.data.summary.regions_covered.includes(r) ? 'bg-ink text-gold' : 'bg-[#f4f4f5] text-[#71717a]')}>{r}</span>
                ))}
              </div>
            </Card>
          </>
        )}
    </>
  )
}

function CreatePointForm({ regions, onDone }: { regions: string[]; onDone: () => void }) {
  const create = useCreatePickupPoint()
  const [f, setF] = useState({ name: '', owner_name: '', phone: '', email: '', city: '', address: '', opening_hours: '', commission_rate: '10' })
  const [chosen, setChosen] = useState<string[]>([])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const field = (k: keyof typeof f, label: string, props: React.ComponentProps<'input'> = {}) => (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">{label}<AdminInput value={f[k]} onChange={set(k)} {...props} /></label>
  )

  return (
    <Card title="Nouveau point de retrait">
      <form className="flex flex-col gap-4 text-ink" onSubmit={(e) => {
        e.preventDefault()
        create.mutate({ ...f, email: f.email || null, opening_hours: f.opening_hours || null, notes: null, regions: chosen, commission_rate: Number(f.commission_rate) }, { onSuccess: onDone })
      }}>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('name', 'Nom de la boutique', { required: true, placeholder: 'Boutique de Moussa Diop' })}
          {field('owner_name', 'Responsable', { required: true })}
          {field('phone', 'Téléphone (mobile)', { required: true, inputMode: 'tel', placeholder: '77 123 45 67' })}
          {field('email', 'E-mail (facultatif)', { type: 'email' })}
          {field('city', 'Ville', { required: true })}
          {field('address', 'Adresse précise', { required: true, placeholder: 'Marché central, allée des cosmétiques' })}
          {field('opening_hours', 'Horaires', { placeholder: 'Lundi au samedi, 9 h – 19 h' })}
          {field('commission_rate', 'Commission (%)', { type: 'number', min: 0, max: 50, step: 0.5, required: true })}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Régions servies (un partenaire peut en couvrir plusieurs)</legend>
          <div className="flex flex-wrap gap-2">
            {regions.map((r) => (
              <label key={r} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm', chosen.includes(r) ? 'border-ink bg-ink text-ivory' : 'border-[#d4d4d8]')}>
                <input type="checkbox" className="sr-only" checked={chosen.includes(r)} onChange={() => setChosen(chosen.includes(r) ? chosen.filter((x) => x !== r) : [...chosen, r])} />{r}
              </label>
            ))}
          </div>
        </fieldset>
        {create.isError && <Feedback kind="error">{firstError(create.error)}</Feedback>}
        <Button type="submit" variant="dark" className="self-start" disabled={create.isPending || chosen.length === 0}>Enregistrer le point de retrait</Button>
      </form>
    </Card>
  )
}

// ---------- Fiche ----------
const TABS = ['Stock et commandes', 'Livraison', 'Relevé du mois', 'Historique'] as const

export function PickupPointDetailPage() {
  const id = Number(useParams().id)
  const point = usePickupPointAdmin(id)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Stock et commandes')

  if (point.isError) return <QueryError message={apiErrorMessage(point.error)} onRetry={() => point.refetch()} />
  if (point.isPending) return <Skeleton className="h-96 bg-[#e4e4e7]" />
  const p = point.data

  return (
    <>
      <Seo title={`ERP — ${p.name}`} />
      <PageHeader title={p.name} subtitle={`${p.regions.join(', ')} · ${p.address}, ${p.city} · ${p.owner_name}, ${p.phone} · commission ${p.commission_rate} % · prix du site`} />
      {p.needs_investigation && <Feedback kind="error">Des produits abîmés ou perdus ont été déclarés deux mois de suite : une investigation s’impose avant la prochaine livraison.</Feedback>}
      <div role="tablist" aria-label="Rubriques du point de retrait" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn('min-h-11 rounded-full border px-4 text-sm font-semibold', tab === t ? 'border-ink bg-ink text-ivory' : 'border-[#d4d4d8] bg-white text-ink')}>{t}</button>
        ))}
      </div>
      {tab === 'Stock et commandes' && <StockTab p={p} />}
      {tab === 'Livraison' && <DeliveryTab p={p} />}
      {tab === 'Relevé du mois' && <StatementTab p={p} onDone={() => setTab('Historique')} />}
      {tab === 'Historique' && <HistoryTab p={p} />}
    </>
  )
}

function StockTab({ p }: { p: PickupPointDetail }) {
  const value = p.stock.reduce((s, x) => s + x.price * x.quantity, 0)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`Stock confié · ${formatPrice(value)} au prix du site`}>
        {p.stock.length === 0 ? <p className="text-sm text-[#52525b]">Aucun produit chez ce partenaire.</p> : (
          <Table head={['Produit', 'Quantité', 'Valeur']} minWidth={360}>
            {p.stock.map((s) => <tr key={s.product_id}><td>{s.name}</td><td>{s.quantity}</td><td>{formatPrice(s.price * s.quantity)}</td></tr>)}
          </Table>
        )}
      </Card>
      <Card title="Commandes en ligne à remettre">
        {p.orders_to_hand_over.length === 0 ? <p className="text-sm text-[#52525b]">Aucune commande en attente de retrait.</p> : (
          <Table head={['Commande', 'Cliente', 'Montant']} minWidth={360}>
            {p.orders_to_hand_over.map((o) => <tr key={o.reference}><td><Link className="underline" to={`/admin/commandes/${o.reference}`}>{o.reference}</Link></td><td>{o.customer_name}</td><td>{formatPrice(o.total)}</td></tr>)}
          </Table>
        )}
        <p className="mt-3 text-xs text-[#52525b]">Le partenaire confirme la remise avec le code de la cliente, depuis le lien reçu par SMS.</p>
      </Card>
    </div>
  )
}

function DeliveryTab({ p }: { p: PickupPointDetail }) {
  const products = useAdminProducts()
  const deliver = useDeliverToPoint(p.id)
  const [qty, setQty] = useState<Record<number, string>>({})
  const lines = Object.entries(qty).map(([id, q]) => ({ product_id: Number(id), quantity: Number(q) })).filter((l) => l.quantity > 0)
  const total = lines.reduce((s, l) => s + l.quantity * (products.data?.find((x) => x.id === l.product_id)?.price ?? 0), 0)

  return (
    <Card title="Livraison du mois : bon de dépôt">
      <p className="mb-3 text-sm text-[#52525b]">Les quantités quittent le stock du salon et passent dans le stock du partenaire. Elles restent la propriété de Dabo Hair.</p>
      {deliver.isSuccess && (
        <Feedback kind="success">Bon de dépôt {deliver.data.number} enregistré. <a className="underline" href={deliveryPdfUrl(deliver.data.id)}>Télécharger le PDF à faire signer</a></Feedback>
      )}
      {deliver.isError && <Feedback kind="error">{firstError(deliver.error)}</Feedback>}
      {products.isPending ? <Skeleton className="h-60 bg-[#e4e4e7]" /> : (
        <form onSubmit={(e) => { e.preventDefault(); deliver.mutate({ items: lines }, { onSuccess: () => setQty({}) }) }} className="flex flex-col gap-3 text-ink">
          <Table head={['Produit', 'Prix du site', 'Stock du salon', 'Quantité à livrer']} minWidth={560}>
            {products.data?.filter((x) => x.stock_quantity > 0).map((x) => (
              <tr key={x.id}>
                <td>{[x.name, x.unit_size].filter(Boolean).join(' ')}</td><td>{formatPrice(x.price)}</td><td>{x.stock_quantity}</td>
                <td><AdminInput type="number" min={0} max={x.stock_quantity} aria-label={`Quantité à livrer : ${x.name}`} className="w-28" value={qty[x.id] ?? ''} onChange={(e) => setQty({ ...qty, [x.id]: e.target.value })} /></td>
              </tr>
            ))}
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong>{lines.reduce((s, l) => s + l.quantity, 0)} produit(s) · {formatPrice(total)} confiés</strong>
            <Button type="submit" variant="dark" disabled={lines.length === 0 || deliver.isPending}>Enregistrer et générer le bon de dépôt</Button>
          </div>
        </form>
      )}
      {p.deliveries.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold">Livraisons précédentes</h3>
          <Table head={['Bon', 'Date', 'Produits', 'Valeur', '']} minWidth={520}>
            {p.deliveries.map((d) => <tr key={d.id}><td>{d.number}</td><td>{d.delivered_on}</td><td>{d.total_quantity}</td><td>{formatPrice(d.total_value)}</td><td><a className="inline-flex items-center gap-1 underline" href={deliveryPdfUrl(d.id)}><FileDown className="size-4" aria-hidden="true" />PDF</a></td></tr>)}
          </Table>
        </div>
      )}
    </Card>
  )
}

function StatementTab({ p, onDone }: { p: PickupPointDetail; onDone: () => void }) {
  const validate = useValidateStatement(p.id)
  const [period, setPeriod] = useState(previousMonth)
  const [counts, setCounts] = useState<Record<number, { counted: string; damaged: string }>>(() =>
    Object.fromEntries(p.stock.map((s) => [s.product_id, { counted: String(s.quantity), damaged: '0' }])))
  const [declared, setDeclared] = useState('')
  const [gapNote, setGapNote] = useState('')
  const [preview, setPreview] = useState<StatementPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const payload = () => Object.entries(counts).map(([id, c]) => ({ product_id: Number(id), counted: Number(c.counted || 0), damaged: Number(c.damaged || 0) }))
  const calculate = () => fetchStatementPreview(p.id, payload()).then((r) => { setPreview(r); setPreviewError(null) }).catch((e) => { setPreview(null); setPreviewError(firstError(e)) })
  const t = preview?.totals
  const gap = t && declared !== '' && Number(declared) !== t.sold_qty

  return (
    <Card title="Relevé de fin de mois">
      <form className="flex flex-col gap-4 text-ink" onSubmit={(e) => {
        e.preventDefault()
        validate.mutate({ period, counts: payload(), declared_sold: declared === '' ? null : Number(declared), gap_note: gapNote || null }, { onSuccess: onDone })
      }}>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Mois du relevé<AdminInput type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required className="w-48" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Vendus selon le partenaire (facultatif)<AdminInput type="number" min={0} value={declared} onChange={(e) => setDeclared(e.target.value)} className="w-48" /></label>
        </div>
        <p className="text-sm text-[#52525b]">Saisissez ce qui reste dans la boutique : le serveur calcule les ventes au comptoir (attendu − compté − abîmés), ajoute les commandes en ligne remises, puis la commission.</p>
        {p.stock.length === 0 ? <p className="text-sm">Aucun stock attendu chez ce partenaire.</p> : (
          <Table head={['Produit', 'Prix', 'Attendu', 'Compté', 'Abîmés / perdus']} minWidth={560}>
            {p.stock.map((s) => (
              <tr key={s.product_id}>
                <td>{s.name}</td><td>{formatPrice(s.price)}</td><td>{s.quantity}</td>
                {(['counted', 'damaged'] as const).map((k) => (
                  <td key={k}><AdminInput type="number" min={0} className="w-24" aria-label={`${k === 'counted' ? 'Compté' : 'Abîmés'} : ${s.name}`}
                    value={counts[s.product_id]?.[k] ?? ''} onChange={(e) => { setCounts({ ...counts, [s.product_id]: { counted: counts[s.product_id]?.counted ?? '0', damaged: counts[s.product_id]?.damaged ?? '0', [k]: e.target.value } }); setPreview(null) }} /></td>
                ))}
              </tr>
            ))}
          </Table>
        )}
        <Button type="button" variant="subtle" className="self-start" onClick={calculate}>Calculer le relevé</Button>
        {previewError && <Feedback kind="error">{previewError}</Feedback>}
        {t && (
          <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-[15px]">
            <dt>Ventes au comptoir</dt><dd className="text-right">{formatPrice(t.counter_sales_total)}</dd>
            <dt>Commandes en ligne remises</dt><dd className="text-right">{formatPrice(t.online_sales_total)}</dd>
            <dt className="font-semibold">Total encaissé par le partenaire ({t.sold_qty} produits)</dt><dd className="text-right font-semibold">{formatPrice(t.sales_total)}</dd>
            <dt>Commission {t.commission_rate} %</dt><dd className="text-right">{formatPrice(t.commission_gross)}</dd>
            {t.damaged_value > 0 && <><dt>Abîmés / perdus déduits ({t.damaged_qty})</dt><dd className="text-right text-[#b91c1c]">− {formatPrice(Math.min(t.damaged_value, t.commission_gross))}</dd></>}
            <dt>Commission nette (jamais sous 0)</dt><dd className="text-right">{formatPrice(t.commission_net)}</dd>
            <dt className="border-t border-[#e4e4e7] pt-2 text-lg font-bold">À verser avant le 5</dt><dd className="border-t border-[#e4e4e7] pt-2 text-right text-lg font-bold">{formatPrice(t.amount_due)}</dd>
          </dl>
        )}
        {gap && (
          <label className="flex flex-col gap-1.5 rounded-xl bg-[#fff7e6] p-3 text-sm font-semibold">
            Écart : le partenaire déclare {declared} vendu(s), le comptage en donne {t.sold_qty}. Expliquez avant de valider.
            <AdminInput value={gapNote} onChange={(e) => setGapNote(e.target.value)} required maxLength={500} placeholder="Ex. : oubli d’une vente du samedi" />
          </label>
        )}
        {validate.isError && <Feedback kind="error">{firstError(validate.error)}</Feedback>}
        <Button type="submit" variant="dark" className="self-start" disabled={!t || validate.isPending}>Valider le relevé</Button>
      </form>
    </Card>
  )
}

function HistoryTab({ p }: { p: PickupPointDetail }) {
  const pay = useStatementPayment()
  const [method, setMethod] = useState<PaymentMethod>('wave')
  if (p.statements.length === 0) return <Card><p className="text-sm text-[#52525b]">Aucun relevé validé pour le moment.</p></Card>

  return (
    <Card title="Relevés">
      {pay.isError && <Feedback kind="error">{firstError(pay.error)}</Feedback>}
      <Table head={['Mois', 'Vendus', 'Encaissé', 'Commission', 'À verser', 'Échéance', 'Paiement', '']} minWidth={900}>
        {p.statements.map((s) => (
          <tr key={s.id}>
            <td>{monthLabel(s.period)}<br /><span className="text-xs text-[#71717a]">{s.number}</span></td>
            <td>{s.sold_qty}{s.damaged_qty > 0 && <span className="text-xs text-[#b91c1c]"> · {s.damaged_qty} abîmé(s)</span>}</td>
            <td>{formatPrice(s.sales_total)}</td>
            <td>{formatPrice(s.commission_net)}</td>
            <td className="font-semibold">{formatPrice(s.amount_due)}</td>
            <td>{new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }).format(new Date(`${s.due_date}T12:00:00Z`))}</td>
            <td><PaymentBadge s={s} />{s.paid_at && <><br /><span className="text-xs">{dateTime(s.paid_at)}</span></>}</td>
            <td className="whitespace-nowrap">
              <a className="mr-3 inline-flex items-center gap-1 underline" href={statementPdfUrl(s.id)}><FileDown className="size-4" aria-hidden="true" />PDF</a>
              {!s.paid_at && (
                <span className="inline-flex items-center gap-2">
                  <AdminSelect aria-label="Moyen de versement" className="w-auto" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
                  </AdminSelect>
                  <Button size="sm" variant="dark" disabled={pay.isPending} onClick={() => pay.mutate({ statementId: s.id, method })}>Versement reçu</Button>
                </span>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {p.statements.some((s) => s.gap_note) && (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-[#52525b]">
          {p.statements.filter((s) => s.gap_note).map((s) => <li key={s.id}>{monthLabel(s.period)} : écart expliqué — {s.gap_note}</li>)}
        </ul>
      )}
    </Card>
  )
}
