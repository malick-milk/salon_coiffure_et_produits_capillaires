/**
 * PROMOTIONS EN POURCENTAGE (maquettes validées le 20 novembre 2026).
 * 1. Liste (en cours, à venir, terminées). 2. Nouvelle promotion / modifier : la marge AVANT de lancer.
 * 3. Résultats : 7 jours avant contre pendant, pour savoir quand refaire une promotion.
 * Le prix initial des produits ne change jamais : le serveur calcule le prix promo pendant les dates.
 */
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan } from '@/features/auth/permissions'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import { cn } from '@/lib/utils'
import type { AdminPromotion, PromotionAudience, PromotionResults, PromotionStatus } from '@/types/admin'
import { useAdminProducts, useCreatePromotion, usePromotionResults, usePromotions, useStopPromotion, useUpdatePromotion } from '../api'
import { AdminField, AdminInput, Card, Feedback, Kpi, PageHeader, Table } from '../components/ui'
import { discountedPrice, productMargin } from '../purchaseMath'
import { firstError } from './OrdersPages'

const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const todayIso = () => new Date().toISOString().slice(0, 10)
const daysSince = (iso: string) => Math.round((new Date(`${todayIso()}T12:00:00`).getTime() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000)
const pct = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n} %`)
const STATUS: Record<PromotionStatus, string> = { current: 'En cours', upcoming: 'À venir', ended: 'Terminées' }
const AUDIENCE: Record<PromotionAudience, string> = { all: 'Tout le monde', members: 'Membres' }

// ---------------------------------------------------------------- 1. Liste
export function PromotionsPage() {
  const promotions = usePromotions()
  const stop = useStopPromotion()
  const canManage = useCan('products.manage')
  const saved = (useLocation().state as { saved?: string } | null)?.saved
  const [tab, setTab] = useState<PromotionStatus>('current')
  const rows = promotions.data?.filter((p) => p.status === tab) ?? []

  return (
    <>
      <Seo title="ERP — Promotions" />
      <PageHeader
        title="Promotions"
        subtitle="Une réduction en pourcentage, sur des dates précises. Les prix des fiches produits ne bougent pas."
        actions={canManage && <Button asChild variant="dark"><Link to="/admin/promotions/nouvelle"><Plus aria-hidden="true" /> Nouvelle promotion</Link></Button>}
      />
      {saved && <Feedback kind="success">Promotion « {saved} » enregistrée.</Feedback>}
      {stop.isError && <Feedback kind="error">{firstError(stop.error)}</Feedback>}
      <div role="tablist" aria-label="Promotions" className="flex flex-wrap gap-2">
        {(['current', 'upcoming', 'ended'] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
            className={cn('min-h-10 rounded-full px-4 text-sm font-semibold', tab === s ? 'bg-ink text-white' : 'border border-[#d4d4d8] bg-white')}>
            {STATUS[s]} ({promotions.data?.filter((p) => p.status === s).length ?? 0})
          </button>
        ))}
      </div>
      <Card>
        {promotions.isError ? <QueryError message={apiErrorMessage(promotions.error)} onRetry={() => promotions.refetch()} />
          : promotions.isPending ? <Skeleton className="h-40 bg-[#e4e4e7]" />
            : rows.length === 0 ? <p className="text-sm text-[#52525b]">Aucune promotion {tab === 'current' ? 'en cours' : tab === 'upcoming' ? 'à venir' : 'terminée'}.</p> : (
              <Table head={['Promotion', 'Réduction', 'Dates', 'Pour qui', 'Marge après remise', 'Statut', 'Ventes', '']} minWidth={1000}>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><br /><span className="text-xs text-[#52525b]">{p.products.map((x) => x.name).join(', ')}</span></td>
                    <td><Badge tone="gold">−{p.percent} %</Badge></td>
                    <td className="whitespace-nowrap">{shortDate(p.starts_on)} → {shortDate(p.last_day)}</td>
                    <td>{AUDIENCE[p.audience]}</td>
                    <td>
                      {p.min_margin_rate === null ? <span className="text-gold-text">coût inconnu</span>
                        : <span className={p.min_margin_rate < 0 ? 'text-[#b91c1c]' : 'text-[#14532d]'}>{p.products.length > 1 ? 'marge min. ' : 'marge '}{p.min_margin_rate.toLocaleString('fr-FR')} %</span>}
                      {p.unknown_cost && p.min_margin_rate !== null && <><br /><span className="text-xs text-gold-text">+ coût inconnu</span></>}
                    </td>
                    <td>
                      {p.status === 'current' ? <Badge tone="success">En cours · J+{daysSince(p.starts_on)}</Badge>
                        : p.status === 'upcoming' ? <Badge tone="info">À venir</Badge>
                          : <Badge tone="neutral">{p.stopped_at ? 'Arrêtée' : 'Terminée'}</Badge>}
                    </td>
                    <td className="whitespace-nowrap">
                      {p.status === 'upcoming' ? '—' : <>{p.summary?.units_sold ?? 0} vendu{(p.summary?.units_sold ?? 0) > 1 ? 's' : ''}
                        {p.summary?.change.units != null && <><br /><span className={cn('text-xs', p.summary.change.units >= 0 ? 'text-[#14532d]' : 'text-[#b91c1c]')}>{pct(p.summary.change.units)} / jour</span></>}</>}
                    </td>
                    <td className="whitespace-nowrap">
                      {p.status !== 'upcoming' && <Button asChild variant="subtle" size="sm"><Link to={`/admin/promotions/${p.id}`} aria-label={`Résultats de ${p.name}`}>Voir</Link></Button>}{' '}
                      {canManage && p.status !== 'ended' && <Button asChild variant="subtle" size="sm"><Link to={`/admin/promotions/${p.id}/modifier`} aria-label={`Modifier ${p.name}`}>Modifier</Link></Button>}{' '}
                      {canManage && p.status === 'upcoming' && (
                        <Button variant="subtle" size="sm" disabled={stop.isPending} onClick={() => window.confirm(`Annuler la promotion « ${p.name} » ?`) && stop.mutate(p.id)}>Annuler</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
      </Card>
      <Card title="Comment ça marche">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#3f3f46]">
          <li>Le <strong>prix initial ne change jamais</strong> : le site affiche le prix barré et le prix promo pendant les dates, puis tout redevient normal tout seul.</li>
          <li>Un produit ne peut être que dans <strong>une</strong> promotion à la fois. La gamme garde son prix membre : jamais de cumul.</li>
          <li>Chaque vente garde son prix initial et sa promotion : les <strong>résultats</strong> comparent les ventes avant et pendant.</li>
        </ul>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- 2. Nouvelle promotion / modifier
const CHOICES = [10, 15, 20, 25, 30]

export function PromotionFormPage() {
  const { id } = useParams()
  const promotions = usePromotions()
  if (!id) return <PromotionForm />
  if (promotions.isPending) return <Skeleton className="h-96 bg-[#e4e4e7]" />
  const promotion = promotions.data?.find((p) => p.id === Number(id))
  if (!promotion) return <Feedback kind="error">Cette promotion n’existe pas. <Link to="/admin/promotions" className="underline">Retour</Link></Feedback>
  return <PromotionForm key={promotion.id} promotion={promotion} />
}

function PromotionForm({ promotion }: { promotion?: AdminPromotion }) {
  const navigate = useNavigate()
  const products = useAdminProducts()
  const create = useCreatePromotion()
  const update = useUpdatePromotion(promotion?.id ?? 0)
  const running = promotion?.status === 'current' // en cours : seuls le nom et la date de fin changent
  const [name, setName] = useState(promotion?.name ?? '')
  const [percent, setPercent] = useState(String(promotion?.percent ?? 20))
  const [other, setOther] = useState(!!promotion && !CHOICES.includes(promotion.percent))
  const [startsOn, setStartsOn] = useState(promotion?.starts_on ?? todayIso())
  const [endsOn, setEndsOn] = useState(promotion?.ends_on ?? '')
  const [audience, setAudience] = useState<PromotionAudience>(promotion?.audience ?? 'all')
  const [selected, setSelected] = useState<number[]>(promotion?.products.map((p) => p.id) ?? [])
  const [confirmHigh, setConfirmHigh] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saving = create.isPending || update.isPending

  const value = Number(percent)
  const validPercent = Number.isInteger(value) && value >= 5 && value <= 70
  const chosen = products.data?.filter((p) => selected.includes(p.id)) ?? []
  const ready = name.trim().length >= 2 && validPercent && endsOn !== '' && chosen.length > 0 && (value <= 50 || confirmHigh || running)
  const toggle = (pid: number) => setSelected((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]))
  const preview = chosen[0]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const body = running
      ? { name: name.trim(), ends_on: endsOn }
      : { name: name.trim(), percent: value, confirm_high_discount: confirmHigh, starts_on: startsOn, ends_on: endsOn, audience, product_ids: selected }
    const done = { onSuccess: () => navigate('/admin/promotions', { state: { saved: name.trim() } }), onError: (err: unknown) => setError(firstError(err)) }
    if (promotion) update.mutate(body, done)
    else create.mutate(body, done)
  }

  return (
    <>
      <Seo title={`ERP — ${promotion ? 'Modifier la promotion' : 'Nouvelle promotion'}`} />
      <nav aria-label="Fil d'Ariane" className="text-sm text-[#52525b]"><Link to="/admin/promotions" className="underline">Promotions</Link> / {promotion ? 'Modifier' : 'Nouvelle'}</nav>
      <PageHeader
        title={promotion ? `Modifier · ${promotion.name}` : 'Nouvelle promotion'}
        actions={<>
          <Button asChild variant="subtle"><Link to="/admin/promotions">Annuler</Link></Button>
          <Button type="submit" form="promotion" variant="dark" disabled={!ready || saving}>{saving ? 'Enregistrement…' : promotion ? 'Enregistrer' : 'Programmer la promotion'}</Button>
        </>}
      />
      {error && <Feedback kind="error">{error}</Feedback>}
      {running && <Feedback kind="success">Promotion en cours : seuls le nom et la date de fin peuvent changer (les ventes déjà faites gardent leur prix).</Feedback>}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <form id="promotion" onSubmit={submit} className="flex min-w-0 flex-col gap-5">
          <Card title="1. La promotion">
            <AdminField label="Nom (pour vous, pas affiché sur le site)" htmlFor="pr-name">
              <AdminInput id="pr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex. Fêtes de fin d’année" required />
            </AdminField>
            <fieldset className="flex flex-col gap-2" disabled={running}>
              <legend className="mb-2 text-sm font-semibold">Réduction</legend>
              <div className="flex flex-wrap gap-2">
                {CHOICES.map((c) => (
                  <button key={c} type="button" aria-pressed={!other && value === c} onClick={() => { setOther(false); setPercent(String(c)) }}
                    className={cn('min-h-10 rounded-full px-4 text-sm font-semibold', !other && value === c ? 'bg-ink text-gold' : 'border border-[#d4d4d8] bg-white')}>{c} %</button>
                ))}
                <button type="button" aria-pressed={other} onClick={() => setOther(true)} className={cn('min-h-10 rounded-full px-4 text-sm font-semibold', other ? 'bg-ink text-gold' : 'border border-[#d4d4d8] bg-white')}>Autre…</button>
              </div>
              {other && (
                <AdminField label="Pourcentage (5 à 70)" htmlFor="pr-percent">
                  <AdminInput id="pr-percent" type="number" min={5} max={70} value={percent} onChange={(e) => setPercent(e.target.value)} className="max-w-32" />
                </AdminField>
              )}
              <p className="text-xs text-[#52525b]">De 5 % à 70 %. Au-delà de 50 %, l’ERP demande une confirmation.</p>
              {value > 50 && validPercent && !running && (
                <label className="flex items-start gap-2 rounded-xl border border-[#fca5a5] bg-[#fef2f2] p-3 text-sm text-[#b91c1c]">
                  <input type="checkbox" checked={confirmHigh} onChange={(e) => setConfirmHigh(e.target.checked)} className="mt-0.5 size-[18px] accent-ink" />
                  Je confirme une réduction de {value} % (plus de la moitié du prix).
                </label>
              )}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Début" htmlFor="pr-start"><AdminInput id="pr-start" type="date" min={todayIso()} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} disabled={running} required /></AdminField>
              <AdminField label="Fin (incluse)" htmlFor="pr-end"><AdminInput id="pr-end" type="date" min={running ? todayIso() : startsOn} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required /></AdminField>
            </div>
            <fieldset className="flex flex-col gap-2" disabled={running}>
              <legend className="mb-2 text-sm font-semibold">Pour qui</legend>
              <div className="flex flex-wrap gap-2">
                {(['all', 'members'] as const).map((a) => (
                  <label key={a} className={cn('flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold', audience === a ? 'bg-ink text-gold' : 'border border-[#d4d4d8] bg-white')}>
                    <input type="radio" name="audience" value={a} checked={audience === a} onChange={() => setAudience(a)} className="sr-only" />
                    {a === 'all' ? 'Tout le monde' : 'Membres seulement (compte)'}
                  </label>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card title={`2. Les produits (${chosen.length})`}>
            {products.isPending ? <Skeleton className="h-40 bg-[#e4e4e7]" /> : (
              <fieldset disabled={running} className="flex flex-col">
                <legend className="sr-only">Produits en promotion</legend>
                {products.data?.map((p) => {
                  const excluded = p.member_price != null
                  return (
                    <label key={p.id} className={cn('flex items-center gap-3 border-b border-[#f0f0f0] py-2.5 text-sm', excluded && 'opacity-60')}>
                      <input type="checkbox" className="size-[18px] accent-ink" checked={selected.includes(p.id)} disabled={excluded} onChange={() => toggle(p.id)} />
                      <span className="flex-1 font-medium">{[p.name, p.unit_size].filter(Boolean).join(' ')}</span>
                      <span className="text-right text-xs text-[#52525b]">
                        {excluded ? <span className="text-gold-text">prix membre déjà actif : exclue</span> : <>
                          {formatPrice(p.price)} · {p.cost_price === null ? <span className="text-gold-text">coût à calculer</span> : `coût ${Math.round(p.cost_price).toLocaleString('fr-FR')} F`} · stock {p.stock_quantity}
                        </>}
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            )}
          </Card>
        </form>

        <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6">
          <Card title="Avant de lancer : la marge">
            {chosen.length === 0 ? <p className="text-sm text-[#52525b]">Cochez des produits : leur prix promo et la marge qui reste s’affichent ici.</p> : (
              <Table head={['Produit', 'Prix initial', 'Prix promo', 'Marge par unité']} minWidth={420}>
                {chosen.map((p) => {
                  const promo = validPercent ? discountedPrice(p.price, value) : p.price
                  const m = p.cost_price === null ? null : productMargin(promo, p.cost_price)
                  return (
                    <tr key={p.id}>
                      <td>{[p.name, p.unit_size].filter(Boolean).join(' ')}</td>
                      <td className="whitespace-nowrap">{formatPrice(p.price)}</td>
                      <td className="whitespace-nowrap font-semibold">{formatPrice(promo)}</td>
                      <td className={cn('whitespace-nowrap', m === null ? 'text-gold-text' : m.loss ? 'font-semibold text-[#b91c1c]' : 'text-[#14532d]')}>
                        {m === null ? 'inconnue (coût à calculer)' : m.loss ? `vendu à perte : ${formatPrice(-m.amount)}` : `${formatPrice(m.amount)} · ${m.rate.toLocaleString('fr-FR')} %`}
                      </td>
                    </tr>
                  )
                })}
              </Table>
            )}
            {chosen.some((p) => p.cost_price === null) && (
              <p className="rounded-xl border border-[#f5d58a] bg-[#fff8e6] p-3 text-sm text-gold-text">
                {chosen.filter((p) => p.cost_price === null).map((p) => p.name).join(', ')} : coût de revient inconnu, la marge ne peut pas être calculée. Enregistrez une réception ou un lot d’abord, ou retirez-le.
              </p>
            )}
          </Card>
          {preview && validPercent && (
            <Card title="Sur le site">
              <div className="flex flex-wrap items-start gap-4">
                <div inert aria-hidden="true" className="w-52 rounded-2xl bg-ink p-2 text-ivory">
                  <ProductCard product={{
                    id: 0, slug: 'apercu', sku: '', name: preview.name, brand: preview.brand ? { name: preview.brand, slug: '' } : null, unit_size: preview.unit_size,
                    price: preview.price, compare_at_price: null, stock_status: 'in_stock', stock_left: null, is_featured: false,
                    category: { id: 0, name: preview.category, slug: '' }, image_url: preview.images[0]?.url ?? null,
                    promotion: { percent: value, price: discountedPrice(preview.price, value), ends_on: endsOn || todayIso(), audience, applies: true },
                  }} />
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-[#3f3f46]">
                  <li>Badge « −{value} % », prix barré, date de fin</li>
                  <li>Panier : « Promotion −{value} % » sur la ligne</li>
                  <li>Facture : prix initial, remise, prix payé</li>
                  <li>Après {endsOn ? `le ${shortDate(endsOn)}` : 'la date de fin'} : prix initial, sans rien toucher</li>
                </ul>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 3. Résultats
/** La phrase qui résume : la promo a-t-elle fait vendre plus, et la marge du jour a-t-elle tenu ? */
export function verdict(r: Pick<PromotionResults, 'days_during' | 'totals' | 'products'>): string {
  if (r.days_during < 3) return 'Trop tôt pour conclure : les résultats sont fiables à partir de 3 jours de promotion.'
  const { units, margin } = r.totals.change
  if (units === null || margin === null) return 'Pas de ventes les 7 jours d’avant : la comparaison n’est pas possible. Gardez ces chiffres comme point de départ.'
  const best = [...r.products].filter((p) => p.change.units !== null).sort((a, b) => (b.change.units ?? 0) - (a.change.units ?? 0))[0]
  const bestText = best && r.products.length > 1 ? ` ${best.name} réagit le plus (${pct(best.change.units)}) : candidat pour la prochaine promotion.` : ''
  if (units <= 0) return `Pas d’effet sur les ventes (${pct(units)} par jour) : la remise n’a pas fait venir plus de clientes. Essayez d’autres produits ou d’autres dates.`
  if (margin >= 0) return `La promotion fait vendre plus (${pct(units)}) et la marge du jour augmente quand même (${pct(margin)}) : la remise est compensée par le volume. À refaire.${bestText}`
  return `La promotion fait vendre plus (${pct(units)}) mais la marge du jour baisse (${pct(margin)}) : la remise coûte plus que ce que le volume rapporte. À réserver au déstockage.${bestText}`
}

export function PromotionResultsPage() {
  const id = Number(useParams().id)
  const results = usePromotionResults(id)
  const stop = useStopPromotion()
  const canManage = useCan('products.manage')

  if (results.isError) return <QueryError message={apiErrorMessage(results.error)} onRetry={() => results.refetch()} />
  if (results.isPending) return <Skeleton className="h-96 bg-[#e4e4e7]" />
  const r = results.data
  const { before, during, change } = r.totals
  const max = Math.max(1, ...r.series.map((s) => s.units))
  const status = r.status === 'current' ? `en cours depuis ${r.days_during} jour${r.days_during > 1 ? 's' : ''}` : r.status === 'ended' ? (r.stopped_at ? 'arrêtée' : 'terminée') : 'à venir'

  return (
    <>
      <Seo title={`ERP — Résultats : ${r.name}`} />
      <nav aria-label="Fil d'Ariane" className="text-sm text-[#52525b]"><Link to="/admin/promotions" className="underline">Promotions</Link> / Résultats</nav>
      <PageHeader
        title={`${r.name} : résultats`}
        subtitle={`−${r.percent} % · ${r.products.map((p) => p.name).join(', ')} · du ${shortDate(r.starts_on)} au ${shortDate(r.last_day)} · ${status}`}
        actions={canManage && r.status !== 'ended' && <>
          <Button variant="subtle" disabled={stop.isPending} onClick={() => window.confirm(`Arrêter « ${r.name} » maintenant ? Le prix initial revient tout de suite sur le site.`) && stop.mutate(r.id)}>Arrêter maintenant</Button>
          <Button asChild variant="subtle"><Link to={`/admin/promotions/${r.id}/modifier`}>Modifier</Link></Button>
        </>}
      />
      {stop.isError && <Feedback kind="error">{firstError(stop.error)}</Feedback>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ventes par jour" value={`${(during?.units ?? 0).toLocaleString('fr-FR')} unité${(during?.units ?? 0) >= 2 ? 's' : ''}`} hint={`avant : ${before.units.toLocaleString('fr-FR')} · ${pct(change.units)}`} tone={change.units !== null && change.units < 0 ? 'warn' : 'good'} />
        <Kpi label="Chiffre d’affaires par jour" value={formatPrice(during?.revenue ?? 0)} hint={`avant : ${formatPrice(before.revenue)} · ${pct(change.revenue)}`} tone={change.revenue !== null && change.revenue < 0 ? 'warn' : 'good'} />
        <Kpi label="Marge par jour" value={formatPrice(during?.margin ?? 0)} hint={`avant : ${formatPrice(before.margin)} · ${pct(change.margin)}${during?.margin_partial || before.margin_partial ? ' (coûts incomplets)' : ''}`} tone={change.margin !== null && change.margin < 0 ? 'warn' : 'good'} />
        <Kpi label="Remise accordée par jour" value={formatPrice(during?.discount ?? 0)} hint="ce que la promotion a coûté" tone="warn" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Card title={`Unités vendues par jour (${r.products.length} produit${r.products.length > 1 ? 's' : ''})`}>
          <p className="flex gap-4 text-xs text-[#52525b]">
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm bg-[#a1a1aa]" />{r.days_before} jours avant</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm bg-gold" />pendant</span>
          </p>
          <ol aria-label="Unités vendues par jour" className="flex h-56 items-end gap-1.5 border-b border-[#e4e4e7] pt-4">
            {r.series.map((s) => (
              <li key={s.date} className="flex flex-1 flex-col items-center gap-1" aria-label={`${shortDate(s.date)} : ${s.units} unité${s.units > 1 ? 's' : ''}${s.during ? ', pendant la promotion' : ''}`}>
                <span aria-hidden="true" className="text-[11px] text-[#52525b]">{s.units}</span>
                <span aria-hidden="true" className={cn('w-full max-w-9 rounded-t-md', s.during ? 'bg-gold' : 'bg-[#a1a1aa]')} style={{ height: `${(150 * s.units) / max}px` }} />
                <span aria-hidden="true" className="text-[11px] text-[#52525b]">{new Date(`${s.date}T12:00:00`).getDate()}</span>
              </li>
            ))}
          </ol>
        </Card>
        <section aria-labelledby="verdict" className="flex flex-col gap-3 rounded-2xl border border-[#f5d58a] bg-[#fffbeb] p-5">
          <h2 id="verdict" className="text-[17px] font-semibold">Ce que disent les chiffres</h2>
          <p className="text-[15px] leading-relaxed">{verdict(r)}</p>
          <p className="text-xs text-[#52525b]">Comparaison : {r.days_before} jours avant le début, et les jours écoulés de la promotion. Les commandes annulées ne comptent pas.</p>
        </section>
      </div>
      <Card title="Par produit">
        <Table head={['Produit', 'Avant (par jour)', 'Pendant (par jour)', 'Évolution', 'Stock restant']} minWidth={640}>
          {r.products.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.before.units.toLocaleString('fr-FR')}</td>
              <td>{(p.during?.units ?? 0).toLocaleString('fr-FR')}</td>
              <td className={p.change.units !== null && p.change.units < 0 ? 'text-[#b91c1c]' : 'text-[#14532d]'}>{pct(p.change.units)}</td>
              <td>{p.stock}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  )
}
