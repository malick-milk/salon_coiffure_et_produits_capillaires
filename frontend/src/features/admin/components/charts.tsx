/**
 * Graphiques du tableau de bord BI (Recharts).
 *
 * Règles de visualisation appliquées partout :
 * - couleur = IDENTITÉ, attribuée dans un ordre fixe (produits = or de la marque, prestations = bleu),
 *   palette vérifiée par calcul (daltonisme, contraste) et non « à l'œil » ;
 * - un seul axe des ordonnées, barres fines (24 px max), coin arrondi uniquement côté donnée ;
 * - grille et axes discrets (traits pleins très clairs) : seules les données sont « fortes » ;
 * - le texte n'est jamais coloré comme la série : la pastille de couleur porte l'identité ;
 * - chaque graphique a sa version TABLEAU (lecteurs d'écran, impression, besoin du chiffre exact).
 */
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { formatPrice } from '@/lib/format'
import type { Analytics, Granularity } from '@/types/analytics'

export const SERIES = { products: '#b8860b', services: '#2a78d6' } as const
const GRID = '#e4e4e7'
const AXIS = '#71717a'
/** Rampe séquentielle bleue (une seule teinte, du clair au foncé) pour la heatmap */
const BLUE_RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']

/** 1 250 000 -> « 1,25 M » ; 45 000 -> « 45 k » (axes uniquement ; les tableaux gardent le montant exact) */
export function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`
  return value.toLocaleString('fr-FR')
}

export function bucketLabel(iso: string, granularity: Granularity, long = false): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (granularity === 'month') return d.toLocaleDateString('fr-FR', { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' })
  const day = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return granularity === 'week' ? `${long ? 'Semaine du ' : ''}${day}` : day
}

/** Légende : pastille rectangulaire (comme la barre) + libellé en couleur de texte */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[#3f3f46]">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-[3px]" style={{ background: i.color }} />{i.label}</li>
      ))}
    </ul>
  )
}

/** Version tableau d'un graphique, repliée par défaut */
export function DataTable({ summary, head, rows }: { summary: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <details className="text-sm">
      <summary className="w-fit cursor-pointer font-semibold text-[#3f3f46] underline-offset-4 hover:underline">{summary}</summary>
      <div className="mt-2 max-h-72 overflow-auto">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead className="sticky top-0 bg-white"><tr className="border-b border-[#e4e4e7] text-left text-[#52525b]">{head.map((h) => <th key={h} scope="col" className="px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-[#f4f4f5]">{r.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  )
}

/** Infobulle : la VALEUR est mise en avant, le nom de la série est secondaire, clé = petit trait de couleur */
function RevenueTooltip({ active, payload, label, granularity }: TooltipContentProps<ValueType, NameType> & { granularity: Granularity }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, p) => sum + Number(p.value ?? 0), 0)
  return (
    <div className="min-w-48 rounded-xl border border-[#e4e4e7] bg-white px-3.5 py-2.5 text-[13px] shadow-lg">
      <p className="mb-1.5 font-semibold text-ink">{bucketLabel(String(label), granularity, true)}</p>
      {[...payload].reverse().map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-3 rounded" style={{ background: p.color }} />
          <strong className="tabular-nums text-ink">{formatPrice(Number(p.value))}</strong>
          <span className="text-[#52525b]">{p.name}</span>
        </p>
      ))}
      <p className="mt-1.5 border-t border-[#f4f4f5] pt-1.5 text-[#52525b]">Total <strong className="text-ink">{formatPrice(total)}</strong></p>
    </div>
  )
}

/** Évolution du CA : colonnes empilées produits + prestations (on lit le total ET sa composition) */
export function RevenueChart({ data, granularity }: { data: Analytics['series']; granularity: Granularity }) {
  return (
    <div className="h-72 w-full" role="img" aria-label={`Évolution du chiffre d’affaires, ${data.length} périodes. Détail dans le tableau ci-dessous.`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tickFormatter={(d: string) => bucketLabel(d, granularity)} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
          <YAxis tickFormatter={compact} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={52} />
          <Tooltip content={(p) => <RevenueTooltip {...p} granularity={granularity} />} cursor={{ fill: '#f4f4f5' }} />
          {/* Le trait blanc de 2 px sépare les segments empilés (« espace de surface ») */}
          <Bar dataKey="products" name="Produits" stackId="ca" fill={SERIES.products} stroke="#fff" strokeWidth={2} maxBarSize={24} />
          <Bar dataKey="services" name="Prestations" stackId="ca" fill={SERIES.services} stroke="#fff" strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Produits classés par CA : barres horizontales d'UNE seule couleur (catégories sans ordre naturel) */
export function TopProductsChart({ data }: { data: Analytics['top_products'] }) {
  return (
    <div className="w-full" style={{ height: Math.max(120, data.length * 40) }} role="img" aria-label="Classement des produits par chiffre d’affaires. Détail dans le tableau ci-dessous.">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap="30%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={170} tick={{ fill: '#3f3f46', fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: '#f4f4f5' }} formatter={(v) => [formatPrice(Number(v)), 'Chiffre d’affaires']} contentStyle={{ borderRadius: 12, borderColor: GRID, fontSize: 13 }} />
          <Bar dataKey="revenue" fill={SERIES.products} maxBarSize={20} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="revenue" position="right" formatter={(v) => compact(Number(v))} style={{ fill: '#3f3f46', fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** Heatmap jour × heure : où se concentre la demande de rendez-vous (pour planifier les coiffeuses) */
export function BookingHeatmap({ data }: { data: Analytics['booking_heatmap'] }) {
  if (data.length === 0) return <p className="text-sm text-[#52525b]">Aucun rendez-vous sur la période.</p>
  const max = Math.max(...data.map((d) => d.bookings))
  const hours = Array.from({ length: Math.max(...data.map((d) => d.hour)) - Math.min(...data.map((d) => d.hour)) + 1 }, (_, i) => Math.min(...data.map((d) => d.hour)) + i)
  const days = [...new Set(data.map((d) => d.day_of_week))].sort()
  const value = (dow: number, h: number) => data.find((d) => d.day_of_week === dow && d.hour === h)?.bookings ?? 0
  const step = (v: number) => (v === 0 ? -1 : Math.min(BLUE_RAMP.length - 1, Math.floor((v / max) * BLUE_RAMP.length)))

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs tabular-nums" aria-label="Rendez-vous par jour et par heure de début">
          <thead><tr><th />{hours.map((h) => <th key={h} scope="col" className="px-1 pb-1 font-medium text-[#71717a]">{h} h</th>)}</tr></thead>
          <tbody>
            {days.map((dow) => (
              <tr key={dow}>
                <th scope="row" className="pr-2 text-left font-medium text-[#3f3f46]">{DAYS[dow - 1]}</th>
                {hours.map((h) => {
                  const v = value(dow, h)
                  const s = step(v)
                  return (
                    <td key={h} title={`${DAYS[dow - 1]} ${h} h : ${v} rendez-vous`}
                      className="h-8 min-w-10 rounded-[4px] text-center font-semibold"
                      style={{ background: s < 0 ? '#f4f4f5' : BLUE_RAMP[s], color: s >= 3 ? '#fff' : '#0b0b0b' }}>
                      {v || ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-xs text-[#52525b]" aria-hidden="true">
        Moins<span className="flex">{BLUE_RAMP.map((c) => <span key={c} className="h-2.5 w-6" style={{ background: c }} />)}</span>Plus
      </div>
    </div>
  )
}
