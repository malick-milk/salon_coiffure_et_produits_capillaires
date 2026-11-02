/**
 * Analyses (étape 8) : le tableau de bord DÉCISIONNEL du propriétaire.
 * Le tableau de bord du jour (/admin) répond à « que dois-je faire maintenant ? » ;
 * cette page répond à « comment évolue l'activité, et que dois-je décider ? ».
 */
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleAlert, Download, Info, Minus, OctagonAlert, PackageX, Snail } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLongDate, formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import { cn } from '@/lib/utils'
import type { ExportDataset, KpiSet, StockStatus } from '@/types/analytics'
import { analyticsExportUrl, useAnalytics } from '../api'
import { BookingHeatmap, bucketLabel, DataTable, Legend, RevenueChart, SERIES, TopProductsChart } from '../components/charts'
import { AdminInput, Card, PageHeader, Table } from '../components/ui'
import { PAYMENT_LABELS } from './OrdersPages'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000))
const PRESETS = [
  { label: '7 jours', days: 7 }, { label: '30 jours', days: 30 }, { label: '90 jours', days: 90 }, { label: '12 mois', days: 365 },
]

/** Variation en % ; null si la période précédente est vide (une hausse « infinie » ne veut rien dire) */
function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/**
 * Tuile KPI avec comparaison. La couleur dépend du SENS et de l'objectif : un taux d'absence qui
 * monte est une mauvaise nouvelle. Une flèche + le signe accompagnent toujours la couleur.
 */
function Stat({ label, value, current, previous, upIsGood = true, points = false, hint }: {
  label: string; value: string; current: number | null; previous: number | null; upIsGood?: boolean; points?: boolean; hint?: string
}) {
  const d = points ? (current !== null && previous !== null ? Math.round((current - previous) * 10) / 10 : null) : delta(current, previous)
  const good = d === null || d === 0 ? null : (d > 0) === upIsGood
  const Icon = d === null || d === 0 ? Minus : d > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-[#e4e4e7] bg-white p-5">
      <span className="text-[13px] font-medium text-[#52525b]">{label}</span>
      <strong className="text-[26px] leading-tight font-semibold text-ink">{value}</strong>
      <span className={cn('flex items-center gap-1 text-[13px] font-medium', good === null ? 'text-[#52525b]' : good ? 'text-[#14532d]' : 'text-[#b91c1c]')}>
        <Icon className="size-4" aria-hidden="true" />
        {d === null ? 'Pas de comparaison' : `${d > 0 ? '+' : ''}${d.toLocaleString('fr-FR')}${points ? ' pt' : ' %'} vs période précédente`}
      </span>
      {hint && <span className="text-xs text-[#71717a]">{hint}</span>}
    </div>
  )
}

const STOCK_STATUS: Record<StockStatus, { label: string; tone: 'warning' | 'neutral' | 'success' | 'info'; Icon: typeof AlertTriangle; className?: string }> = {
  out_of_stock: { label: 'Rupture', tone: 'neutral', Icon: PackageX, className: 'bg-[#fde2e2] text-[#7f1d1d]' },
  below_threshold: { label: 'Sous le seuil', tone: 'warning', Icon: OctagonAlert },
  cover_under_14_days: { label: 'Rupture sous 14 j', tone: 'warning', Icon: AlertTriangle },
  slow_moving: { label: 'Faible rotation', tone: 'info', Icon: Snail },
  ok: { label: 'OK', tone: 'success', Icon: Minus },
}

const EXPORTS: { dataset: ExportDataset; label: string }[] = [
  { dataset: 'daily_sales', label: 'Ventes par jour' },
  { dataset: 'product_daily', label: 'Produits par jour' },
  { dataset: 'order_lines', label: 'Lignes de commande' },
]

export function AnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const to = params.get('to') ?? iso(new Date())
  const from = params.get('from') ?? daysAgo(29)
  const { data, isPending, isError, error, refetch, isFetching } = useAnalytics(from, to)
  const setPeriod = (f: string, t: string) => setParams({ from: f, to: t }, { replace: true })

  return (
    <>
      <Seo title="ERP — Analyses" />
      <PageHeader title="Analyses" subtitle="Tendances, rentabilité, clients et stock. Montants en F CFA, comparés à la période précédente de même durée." />

      {/* UNE seule rangée de filtres, au-dessus de tout ce qu'elle filtre */}
      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Période" className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = from === daysAgo(p.days - 1) && to === iso(new Date())
            return (
              <button key={p.days} type="button" aria-pressed={active} onClick={() => setPeriod(daysAgo(p.days - 1), iso(new Date()))}
                className={cn('min-h-11 rounded-full border px-4 text-sm font-semibold', active ? 'border-ink bg-ink text-ivory' : 'border-[#d4d4d8] bg-white text-ink hover:bg-[#f4f4f5]')}>
                {p.label}
              </button>
            )
          })}
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#3f3f46]">Du
          <AdminInput type="date" value={from} max={to} onChange={(e) => e.target.value && setPeriod(e.target.value, to)} className="min-h-11 w-40" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#3f3f46]">Au
          <AdminInput type="date" value={to} min={from} max={iso(new Date())} onChange={(e) => e.target.value && setPeriod(from, e.target.value)} className="min-h-11 w-40" />
        </label>
        {isFetching && !isPending && <span role="status" className="pb-3 text-xs text-[#71717a]">Mise à jour…</span>}
      </div>

      {isError ? <QueryError message={apiErrorMessage(error)} onRetry={() => refetch()} />
        : isPending ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-32 bg-[#e4e4e7]" />)}</div>
        : (
          // Pendant un rechargement, l'écran précédent reste visible, estompé : pas de saut de mise en page
          <div className={cn('flex flex-col gap-5 transition-opacity', isFetching && 'opacity-60')}>
            <Kpis current={data.kpis.current} previous={data.kpis.previous} />

            {data.data_quality.products_without_cost.length > 0 && (
              <p className="flex items-start gap-2.5 rounded-xl bg-[#fff4d6] px-4 py-3 text-sm text-[#5c4300]">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Coût de revient inconnu pour : <strong>{data.data_quality.products_without_cost.join(', ')}</strong>. Leur marge n’est pas comptée
                  {data.data_quality.costed_revenue_share !== null && ` (la marge porte sur ${data.data_quality.costed_revenue_share.toLocaleString('fr-FR')} % du CA produits)`}.
                  Renseignez un lot dans <Link to="/admin/fabrication" className="font-semibold underline underline-offset-4">Fabrication</Link>.
                </span>
              </p>
            )}

            <Card title="Évolution du chiffre d’affaires" actions={<Legend items={[{ label: 'Produits', color: SERIES.products }, { label: 'Prestations', color: SERIES.services }]} />}>
              <p className="-mt-2 text-[13px] text-[#52525b]">
                Par {data.period.granularity === 'day' ? 'jour' : data.period.granularity === 'week' ? 'semaine' : 'mois'}, du {formatLongDate(data.period.from)} au {formatLongDate(data.period.to)}.
              </p>
              <RevenueChart data={data.series} granularity={data.period.granularity} />
              <DataTable summary="Voir les données" head={['Période', 'Produits', 'Prestations', 'Total', 'Commandes', 'Prestations réalisées']}
                rows={data.series.map((s) => [bucketLabel(s.date, data.period.granularity, true), formatPrice(s.products), formatPrice(s.services), formatPrice(s.products + s.services), s.orders, s.bookings])} />
            </Card>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card title="Produits les plus vendus">
                {data.top_products.length === 0 ? <p className="text-sm text-[#52525b]">Aucune vente payée sur la période.</p> : (
                  <>
                    <TopProductsChart data={data.top_products} />
                    <DataTable summary="Voir les données (unités et marge)" head={['Produit', 'Unités', 'CA', 'Marge brute', 'Taux']}
                      rows={data.top_products.map((p) => [p.name, p.units, formatPrice(p.revenue), p.margin === null ? 'coût inconnu' : formatPrice(p.margin), p.margin_rate === null ? '—' : `${p.margin_rate.toLocaleString('fr-FR')} %`])} />
                  </>
                )}
              </Card>
              <Card title="Affluence au salon">
                <p className="-mt-2 text-[13px] text-[#52525b]">Rendez-vous (hors annulations) par jour et heure de début : utile pour planifier les coiffeuses.</p>
                <BookingHeatmap data={data.booking_heatmap} />
              </Card>
            </div>

            <Card title="Stock : rotation et prévision de rupture">
              <p className="-mt-2 text-[13px] text-[#52525b]">
                Couverture = stock actuel ÷ ventes moyennes par jour sur 90 jours. Rotation = unités vendues ÷ stock moyen de la période.
              </p>
              <Table head={['Produit', 'Stock', 'Vendus (période)', 'Demande / jour', 'Couverture', 'Rupture estimée', 'Rotation', 'Valeur immobilisée', 'Statut']} minWidth={960}>
                {data.stock.map((s) => {
                  const st = STOCK_STATUS[s.status]
                  return (
                    <tr key={s.product_id} className="tabular-nums">
                      <td className="font-semibold">{s.name}</td>
                      <td>{s.stock} <span className="text-xs text-[#71717a]">/ seuil {s.threshold}</span></td>
                      <td>{s.units_sold}</td>
                      <td>{s.avg_daily_demand.toLocaleString('fr-FR')}</td>
                      <td>{s.days_of_cover === null ? '—' : `${s.days_of_cover} j`}</td>
                      <td>{s.stockout_date ? formatLongDate(s.stockout_date) : s.stock === 0 ? 'déjà en rupture' : 'pas de vente récente'}</td>
                      <td>{s.turnover === null ? '—' : `${s.turnover.toLocaleString('fr-FR')}×`}</td>
                      <td>{s.immobilized_value === null ? 'coût inconnu' : formatPrice(s.immobilized_value)}</td>
                      <td><Badge tone={st.tone} className={st.className}><st.Icon className="size-3.5" aria-hidden="true" />{st.label}</Badge></td>
                    </tr>
                  )
                })}
              </Table>
            </Card>

            <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
              <Card title="Meilleurs clients de la période">
                {data.top_customers.length === 0 ? <p className="text-sm text-[#52525b]">Aucun achat sur la période.</p> : (
                  <Table head={['Client', 'Dépensé (période)', 'Visites', 'Valeur vie client', 'Dernière visite']} minWidth={560}>
                    {data.top_customers.map((c) => (
                      <tr key={c.customer_id} className="tabular-nums">
                        <td><span className="font-semibold">{c.name}</span>{c.type === 'reseller' && <Badge tone="info" className="ml-2">Revendeur</Badge>}</td>
                        <td className="font-semibold">{formatPrice(c.period_spent)}</td>
                        <td>{c.period_visits}</td>
                        <td>{formatPrice(c.lifetime_value)} <span className="text-xs text-[#71717a]">({c.lifetime_visits} visites)</span></td>
                        <td>{c.days_since_last_visit === 0 ? 'aujourd’hui' : `il y a ${c.days_since_last_visit} j`}</td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>
              <Card title="Moyens de paiement (commandes)">
                {data.payment_methods.length === 0 ? <p className="text-sm text-[#52525b]">Aucun encaissement sur la période.</p> : (
                  <PaymentMethods rows={data.payment_methods} />
                )}
              </Card>
            </div>

            <Card title="Exporter les données (CSV)">
              <p className="-mt-2 text-[13px] text-[#52525b]">
                Pour Excel, Power BI ou Python (pandas). Séparateur « ; ». Sans nom ni téléphone : chaque client est un numéro (données minimisées).
              </p>
              <div className="flex flex-wrap gap-2.5">
                {EXPORTS.map((e) => (
                  <a key={e.dataset} href={analyticsExportUrl(e.dataset, from, to)} download
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d4d4d8] bg-white px-4 text-sm font-semibold text-ink hover:bg-[#f4f4f5]">
                    <Download className="size-4" aria-hidden="true" />{e.label}
                  </a>
                ))}
              </div>
            </Card>
          </div>
        )}
    </>
  )
}

function Kpis({ current: c, previous: p }: { current: KpiSet; previous: KpiSet }) {
  const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('fr-FR')} %`)
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Chiffre d’affaires" value={formatPrice(c.revenue)} current={c.revenue} previous={p.revenue}
        hint={`Produits ${formatPrice(c.products_revenue)} · prestations ${formatPrice(c.services_revenue)}`} />
      <Stat label="Marge brute (produits)" value={c.gross_margin === null ? 'coût inconnu' : formatPrice(c.gross_margin)} current={c.gross_margin} previous={p.gross_margin}
        hint={c.margin_rate === null ? undefined : `Taux de marge ${pct(c.margin_rate)}`} />
      <Stat label="Panier moyen" value={c.average_basket === null ? '—' : formatPrice(c.average_basket)} current={c.average_basket} previous={p.average_basket}
        hint={`${c.orders} commande(s) payée(s), ${c.items_sold} article(s)`} />
      <Stat label="Prestations réalisées" value={String(c.bookings_completed)} current={c.bookings_completed} previous={p.bookings_completed}
        hint={`${c.bookings} rendez-vous pris sur la période`} />
      <Stat label="Taux d’absence (no-show)" value={pct(c.no_show_rate)} current={c.no_show_rate} previous={p.no_show_rate} upIsGood={false} points
        hint="Absents ÷ rendez-vous passés" />
      <Stat label="Nouveaux clients" value={String(c.new_customers)} current={c.new_customers} previous={p.new_customers} />
      <Stat label="Taux de retour" value={pct(c.returning_rate)} current={c.returning_rate} previous={p.returning_rate} points
        hint={`Clients venus 2 fois ou plus, parmi ${c.active_customers} actifs`} />
      <Stat label="Commandes payées" value={String(c.orders)} current={c.orders} previous={p.orders} />
    </div>
  )
}

/** Classement horizontal simple : la barre fine visualise la part, le chiffre exact reste écrit */
function PaymentMethods({ rows }: { rows: { method: string; count: number; amount: number }[] }) {
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((r) => {
        const share = total ? Math.round((r.amount / total) * 1000) / 10 : 0
        return (
          <li key={r.method} className="flex flex-col gap-1.5 text-sm">
            <span className="flex justify-between gap-3 tabular-nums">
              <span className="font-semibold">{PAYMENT_LABELS[r.method as keyof typeof PAYMENT_LABELS] ?? r.method}</span>
              <span><strong>{share.toLocaleString('fr-FR')} %</strong> <span className="text-[#71717a]">· {formatPrice(r.amount)} · {r.count}</span></span>
            </span>
            <span className="h-2 rounded-full bg-[#f4f4f5]" aria-hidden="true">
              <span className="block h-2 rounded-full" style={{ width: `${share}%`, background: SERIES.products }} />
            </span>
          </li>
        )
      })}
      <li className="flex items-start gap-2 text-xs text-[#71717a]"><CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />Les prestations du salon sont encaissées sur place et ne figurent pas ici.</li>
    </ul>
  )
}
