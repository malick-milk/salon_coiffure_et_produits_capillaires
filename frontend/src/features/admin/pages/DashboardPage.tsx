/** Tableau de bord du jour (EF-ERP-01) : ce qui demande une ACTION aujourd'hui */
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import { useDashboard } from '../api'
import { Card, Kpi, PageHeader, Table } from '../components/ui'

export function DashboardPage() {
  const { data: d, isPending, isError, error, refetch } = useDashboard()

  if (isError) return <QueryError message={apiErrorMessage(error)} onRetry={() => refetch()} />
  if (isPending) return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28 bg-[#e4e4e7]" />)}</div>

  // Les montants sont null quand le serveur ne les envoie pas (permission analytics.view absente)
  const money = d.revenue_month !== null
  const trend = money && d.revenue_prev_month_same_period
    ? Math.round(((d.revenue_month! - d.revenue_prev_month_same_period) / d.revenue_prev_month_same_period) * 1000) / 10
    : null

  return (
    <>
      <Seo title="ERP — Tableau de bord" />
      <PageHeader title="Tableau de bord" subtitle="Mise à jour automatique toutes les minutes." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {money ? (
          <>
            <Kpi label="CA du jour" value={formatPrice(d.revenue_today ?? 0)} hint="Commandes payées + prestations terminées" />
            <Kpi label="CA du mois" value={formatPrice(d.revenue_month ?? 0)} tone={trend !== null && trend >= 0 ? 'good' : 'warn'}
              hint={trend !== null ? `${trend >= 0 ? '+' : ''}${trend.toLocaleString('fr-FR')} % vs même période du mois dernier` : 'Pas de comparaison disponible'} />
          </>
        ) : (
          <Kpi label="Chiffre d’affaires" value="—" hint="Réservé au propriétaire" />
        )}
        <Kpi label="Commandes à traiter" value={d.orders_to_process} hint={`${d.orders_today} reçue(s) aujourd’hui`} tone={d.orders_to_process ? 'warn' : 'neutral'} />
        <Kpi label="Rendez-vous du jour" value={d.bookings_today} hint={`${d.bookings_to_confirm} à confirmer`} tone={d.bookings_to_confirm ? 'warn' : 'neutral'} />
        {!money && <Kpi label="Nouveaux clients (mois)" value={d.new_customers_month} />}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Planning du jour" className="xl:col-span-1" actions={<Link to="/admin/planning" className="text-sm font-semibold underline underline-offset-4">Planning</Link>}>
          {d.agenda.length === 0 ? <p className="text-sm text-[#52525b]">Aucun rendez-vous aujourd’hui.</p> : (
            <ul className="flex flex-col gap-2">
              {d.agenda.map((a) => (
                <li key={a.reference} className="flex items-center gap-3 rounded-xl border border-[#e4e4e7] p-3">
                  <strong className="w-12">{a.time}</strong>
                  <span className="flex flex-1 flex-col text-sm"><span className="font-semibold">{a.service_name}</span><span className="text-[#52525b]">{a.customer_name} · {a.stylist_name}</span></span>
                  <StatusBadge kind="booking" status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Alertes stock">
          {d.stock_alerts.length === 0 ? <p className="text-sm text-[#52525b]">Aucun produit sous son seuil d’alerte.</p> : (
            <ul className="flex flex-col gap-2">
              {d.stock_alerts.map((s) => (
                <li key={s.id} className={`flex items-start gap-2.5 rounded-xl p-3 text-sm ${s.stock === 0 ? 'bg-[#fde2e2] text-[#7f1d1d]' : 'bg-[#fff4d6] text-[#5c4300]'}`}>
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span><strong>{s.name}</strong> · {s.stock === 0 ? 'rupture de stock' : `${s.stock} en stock (seuil ${s.threshold})`}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/fabrication" className="text-sm font-semibold underline underline-offset-4">Enregistrer une fabrication</Link>
        </Card>

        <Card title="Top produits (30 jours)">
          {d.top_products.length === 0 ? <p className="text-sm text-[#52525b]">Pas encore de vente payée sur la période.</p> : (
            <Table head={['Produit', 'Vendus', money ? 'Marge' : '']} minWidth={280}>
              {d.top_products.map((p) => (
                <tr key={p.name}><td>{p.name}</td><td>{p.units}</td><td className="font-semibold">{p.margin !== null ? formatPrice(p.margin) : money ? 'coût inconnu' : ''}</td></tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card title="Dernières commandes" actions={<Link to="/admin/commandes" className="text-sm font-semibold underline underline-offset-4">Toutes les commandes</Link>}>
        <Table head={['Référence', 'Client', 'Mode', 'Statut', 'Paiement', 'Total']}>
          {d.recent_orders.map((o) => (
            <tr key={o.reference}>
              <td><Link to={`/admin/commandes/${o.reference}`} className="font-semibold underline-offset-4 hover:underline">{o.reference}</Link></td>
              <td>{o.customer_name}</td>
              <td>{o.fulfillment_method === 'pickup' ? 'Retrait' : 'Livraison'}{o.channel === 'store' ? ' · boutique' : ''}</td>
              <td><StatusBadge kind="order" status={o.status} /></td>
              <td><StatusBadge kind="payment" status={o.payment_status} /></td>
              <td className="font-semibold whitespace-nowrap">{formatPrice(o.total)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  )
}
