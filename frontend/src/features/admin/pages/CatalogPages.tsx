/** Produits et stock, fabrication (EF-COM-01 à 05). Le coût de revient est visible ici (personnel autorisé). */
import { Minus, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan } from '@/features/auth/permissions'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import type { AdminProduct, CostCategory } from '@/types/admin'
import { type NewBatch, useAdjustStock, useAdminProducts, useBatches, useCreateBatch, useStockMovements, useUpdateProduct } from '../api'
import { AdminField, AdminInput, AdminSelect, Card, dateTime, Feedback, PageHeader, Table } from '../components/ui'
import { firstError } from './OrdersPages'

const label = (p: Pick<AdminProduct, 'name' | 'unit_size'>) => [p.name, p.unit_size].filter(Boolean).join(' ')
const MOVEMENT_LABELS: Record<string, string> = {
  initial: 'Stock initial', production: 'Fabrication', purchase: 'Achat', sale: 'Vente', sale_cancellation: 'Annulation de vente',
  customer_return: 'Retour client', loss: 'Perte', adjustment: 'Ajustement',
}

export function ProductsPage() {
  const products = useAdminProducts()
  const update = useUpdateProduct()
  const canManage = useCan('products.manage')
  const canAdjust = useCan('stock.adjust')
  const [selected, setSelected] = useState<AdminProduct | null>(null)

  return (
    <>
      <Seo title="ERP — Produits et stock" />
      <PageHeader title="Produits et stock" subtitle="Le stock ne se modifie jamais directement : chaque variation passe par le grand livre." />
      {update.isError && <Feedback kind="error">{firstError(update.error)}</Feedback>}
      <Card>
        {products.isError ? <QueryError message={apiErrorMessage(products.error)} onRetry={() => products.refetch()} />
          : products.isPending ? <Skeleton className="h-80 bg-[#e4e4e7]" /> : (
            <Table head={['Produit', 'Prix de vente', 'Coût de revient', 'Taux de marge', 'Stock', 'En vente', '']} minWidth={900}>
              {products.data.map((p) => (
                <tr key={p.id} className={selected?.id === p.id ? 'bg-[#fffbeb]' : ''}>
                  <td><strong>{label(p)}</strong><br /><span className="text-xs text-[#52525b]">{p.sku} · {p.category}</span></td>
                  <td>{canManage ? <PriceEditor product={p} onSave={(price) => update.mutate({ id: p.id, price })} /> : formatPrice(p.price)}</td>
                  <td className="whitespace-nowrap">{p.cost_price !== null ? `${p.cost_price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} F` : <span className="text-gold-text">à calculer</span>}</td>
                  <td>{p.margin_rate !== null ? `${p.margin_rate.toLocaleString('fr-FR')} %` : '—'}</td>
                  <td>
                    <span className="font-semibold">{p.stock_quantity}</span>{' '}
                    {p.stock_status === 'out_of_stock' ? <Badge tone="neutral">Rupture</Badge> : p.stock_status === 'low_stock' ? <Badge tone="warning">Faible</Badge> : null}
                    <br /><span className="text-xs text-[#52525b]">seuil {p.low_stock_threshold}</span>
                  </td>
                  <td>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="size-[18px] accent-ink" checked={p.is_active} disabled={!canManage || update.isPending} onChange={(e) => update.mutate({ id: p.id, is_active: e.target.checked })} />
                      {p.is_active ? 'Oui' : 'Non'}
                    </label>
                  </td>
                  <td><Button variant="subtle" size="sm" onClick={() => setSelected(p)}>Stock</Button></td>
                </tr>
              ))}
            </Table>
          )}
      </Card>
      {selected && <StockPanel product={products.data?.find((p) => p.id === selected.id) ?? selected} canAdjust={canAdjust} onClose={() => setSelected(null)} />}
    </>
  )
}

function PriceEditor({ product, onSave }: { product: AdminProduct; onSave: (price: number) => void }) {
  const [value, setValue] = useState(String(product.price))
  const changed = Number(value) !== product.price && Number(value) >= 0
  return (
    <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (changed) onSave(Number(value)) }}>
      <label className="sr-only" htmlFor={`price-${product.id}`}>Prix de {label(product)}</label>
      <AdminInput id={`price-${product.id}`} type="number" min={0} step={100} value={value} onChange={(e) => setValue(e.target.value)} className="min-h-9 w-24" />
      {changed && <Button type="submit" size="sm" variant="dark">OK</Button>}
    </form>
  )
}

function StockPanel({ product, canAdjust, onClose }: { product: AdminProduct; canAdjust: boolean; onClose: () => void }) {
  const movements = useStockMovements(product.id)
  const adjust = useAdjustStock()
  const [type, setType] = useState<'loss' | 'adjustment' | 'customer_return'>('loss')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setDone(false)
    adjust.mutate({ id: product.id, type, quantity: Number(quantity), reason }, { onSuccess: () => { setDone(true); setReason('') } })
  }

  return (
    <Card title={`Stock — ${label(product)} (${product.stock_quantity})`} actions={<Button variant="subtle" size="sm" onClick={onClose}>Fermer</Button>}>
      {canAdjust && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_120px_2fr_auto] sm:items-end">
          <AdminField label="Opération" htmlFor="adj-type">
            <AdminSelect id="adj-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="loss">Perte (casse, péremption…)</option>
              <option value="customer_return">Retour client</option>
              <option value="adjustment">Ajustement d’inventaire (+ ou −)</option>
            </AdminSelect>
          </AdminField>
          <AdminField label="Quantité" htmlFor="adj-qty"><AdminInput id="adj-qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></AdminField>
          <AdminField label="Motif (obligatoire)" htmlFor="adj-reason"><AdminInput id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} /></AdminField>
          <Button type="submit" variant="dark" size="sm" disabled={adjust.isPending}>Enregistrer</Button>
        </form>
      )}
      {adjust.isError && <Feedback kind="error">{firstError(adjust.error)}</Feedback>}
      {done && <Feedback kind="success">Mouvement enregistré dans le grand livre et le journal d’audit.</Feedback>}
      <h3 className="text-sm font-semibold">Grand livre (100 derniers mouvements)</h3>
      {movements.isPending ? <Skeleton className="h-32 bg-[#e4e4e7]" /> : (
        <Table head={['Date', 'Type', 'Quantité', 'Stock après', 'Motif / origine']} minWidth={560}>
          {movements.data?.map((m, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap">{dateTime(m.created_at)}</td>
              <td>{MOVEMENT_LABELS[m.type] ?? m.type}</td>
              <td className={`font-semibold ${m.quantity < 0 ? 'text-[#b91c1c]' : 'text-[#14532d]'}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
              <td>{m.stock_after}</td>
              <td>{m.reason ?? m.reference ?? '—'}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}

const COST_LABELS: Record<CostCategory, string> = { ingredients: 'Ingrédients', packaging: 'Flacons / emballage', labels: 'Étiquettes', labor: 'Main-d’œuvre', other: 'Autre' }
const today = () => new Date().toISOString().slice(0, 10)

export function ProductionPage() {
  const batches = useBatches()
  const products = useAdminProducts()
  const create = useCreateBatch()
  const canCreate = useCan('production.manage')
  const empty = { product_id: '', batch_number: '', quantity_produced: '96', produced_on: today(), expires_on: '', notes: '' }
  const [form, setForm] = useState(empty)
  const [costs, setCosts] = useState<{ category: CostCategory; label: string; amount: string }[]>([{ category: 'ingredients', label: '', amount: '' }])
  const [result, setResult] = useState<string | null>(null)

  const total = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0)
  const qty = Number(form.quantity_produced) || 0
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setResult(null)
    const payload: NewBatch = {
      product_id: Number(form.product_id), batch_number: form.batch_number.trim(), quantity_produced: qty, produced_on: form.produced_on,
      expires_on: form.expires_on || null, notes: form.notes || null,
      costs: costs.filter((c) => c.label.trim() && Number(c.amount) > 0).map((c) => ({ category: c.category, label: c.label.trim(), amount: Number(c.amount) })),
    }
    create.mutate(payload, {
      onSuccess: (res) => {
        const unit = res.data.data.unit_cost
        setResult(`Lot enregistré. ${qty} unités entrées en stock${unit !== null ? `, coût de revient : ${unit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} F par unité` : ''}.`)
        setForm(empty)
        setCosts([{ category: 'ingredients', label: '', amount: '' }])
      },
    })
  }

  return (
    <>
      <Seo title="ERP — Fabrication" />
      <PageHeader title="Fabrication" subtitle="Chaque lot fait entrer du stock et met à jour le coût de revient du produit." />
      {canCreate && (
        <Card title="Nouveau lot de fabrication">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <AdminField label="Produit" htmlFor="b-product">
                <AdminSelect id="b-product" value={form.product_id} onChange={set('product_id')} required>
                  <option value="">Choisir…</option>
                  {products.data?.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
                </AdminSelect>
              </AdminField>
              <AdminField label="Numéro de lot (imprimé sur le flacon)" htmlFor="b-number"><AdminInput id="b-number" value={form.batch_number} onChange={set('batch_number')} placeholder="LOT-2611-SAC" required maxLength={40} /></AdminField>
              <AdminField label="Quantité fabriquée (unités)" htmlFor="b-qty"><AdminInput id="b-qty" type="number" min={1} value={form.quantity_produced} onChange={set('quantity_produced')} required /></AdminField>
              <AdminField label="Date de fabrication" htmlFor="b-produced"><AdminInput id="b-produced" type="date" max={today()} value={form.produced_on} onChange={set('produced_on')} required /></AdminField>
              <AdminField label="Date de péremption" htmlFor="b-expires"><AdminInput id="b-expires" type="date" min={form.produced_on} value={form.expires_on} onChange={set('expires_on')} /></AdminField>
              <AdminField label="Remarque" htmlFor="b-notes"><AdminInput id="b-notes" value={form.notes} onChange={set('notes')} /></AdminField>
            </div>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-1 text-sm font-semibold">Coûts du lot (poste par poste)</legend>
              {costs.map((c, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[200px_1fr_150px_auto] sm:items-center">
                  <AdminSelect aria-label={`Poste ${i + 1}`} value={c.category} onChange={(e) => setCosts(costs.map((x, j) => (j === i ? { ...x, category: e.target.value as CostCategory } : x)))}>
                    {(Object.keys(COST_LABELS) as CostCategory[]).map((k) => <option key={k} value={k}>{COST_LABELS[k]}</option>)}
                  </AdminSelect>
                  <AdminInput aria-label={`Description du poste ${i + 1}`} placeholder="Ex. beurre de karité 2 kg" value={c.label} onChange={(e) => setCosts(costs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <AdminInput aria-label={`Montant du poste ${i + 1} en F CFA`} type="number" min={1} placeholder="Montant F" value={c.amount} onChange={(e) => setCosts(costs.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                  <Button type="button" variant="subtle" size="icon" aria-label={`Retirer le poste ${i + 1}`} disabled={costs.length === 1} onClick={() => setCosts(costs.filter((_, j) => j !== i))}><Minus aria-hidden="true" /></Button>
                </div>
              ))}
              <Button type="button" variant="subtle" size="sm" className="w-fit" onClick={() => setCosts([...costs, { category: 'packaging', label: '', amount: '' }])}><Plus aria-hidden="true" />Ajouter un poste</Button>
            </fieldset>
            <p className="text-sm text-[#3f3f46]">
              Total du lot : <strong>{formatPrice(total)}</strong>
              {total > 0 && qty > 0 && <> · coût unitaire estimé : <strong>{(total / qty).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} F</strong> (calcul définitif fait par la base)</>}
            </p>
            {create.isError && <Feedback kind="error">{firstError(create.error)}</Feedback>}
            {result && <Feedback kind="success">{result}</Feedback>}
            <Button type="submit" variant="dark" className="w-fit" disabled={create.isPending}>{create.isPending ? 'Enregistrement…' : 'Enregistrer le lot'}</Button>
          </form>
        </Card>
      )}
      <Card title="Lots fabriqués">
        {batches.isError ? <QueryError message={apiErrorMessage(batches.error)} onRetry={() => batches.refetch()} />
          : batches.isPending ? <Skeleton className="h-60 bg-[#e4e4e7]" /> : (
            <Table head={['Lot', 'Produit', 'Unités', 'Coût du lot', 'Coût unitaire', 'Marge potentielle', 'Péremption']} minWidth={860}>
              {batches.data.map((b) => (
                <tr key={b.id}>
                  <td className="font-semibold">{b.batch_number}</td>
                  <td>{b.product_name}</td>
                  <td>{b.quantity_produced}{b.quantity_produced % 12 === 0 && <span className="text-xs text-[#52525b]"> ({b.quantity_produced / 12} douz.)</span>}</td>
                  <td className="whitespace-nowrap">{b.total_cost !== null ? formatPrice(b.total_cost) : <span className="text-gold-text">à compléter</span>}</td>
                  <td>{b.unit_cost !== null ? `${b.unit_cost.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} F` : '—'}</td>
                  <td className="whitespace-nowrap">{b.potential_margin !== null ? formatPrice(b.potential_margin) : '—'}</td>
                  <td>{b.expires_on ?? '—'}{b.days_before_expiry !== null && b.days_before_expiry < 90 && <> <Badge tone={b.days_before_expiry < 0 ? 'neutral' : 'warning'}>{b.days_before_expiry < 0 ? 'Périmé' : `${b.days_before_expiry} j`}</Badge></>}</td>
                </tr>
              ))}
            </Table>
          )}
      </Card>
    </>
  )
}
