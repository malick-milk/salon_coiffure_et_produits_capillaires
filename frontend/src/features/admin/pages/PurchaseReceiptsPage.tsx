/**
 * RÉCEPTIONS D'ACHAT (maquette validée le 16 novembre 2026) : le stock des produits « achetés et revendus ».
 * Le calcul (coût par unité, nouveau coût moyen, marge) s'affiche EN DIRECT avant d'enregistrer.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan } from '@/features/auth/permissions'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import { useAdminProducts, useCreatePurchaseReceipt, usePurchaseReceipts } from '../api'
import { AdminField, AdminInput, AdminSelect, Card, Feedback, PageHeader, Table } from '../components/ui'
import { previewReceipt } from '../purchaseMath'
import { firstError } from './OrdersPages'

const today = () => new Date().toISOString().slice(0, 10)
const money = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} F`
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

export function PurchaseReceiptsPage() {
  const products = useAdminProducts()
  const receipts = usePurchaseReceipts()
  const create = useCreatePurchaseReceipt()
  const canRecord = useCan('purchases.manage')

  const empty = { product_id: '', supplier_name: '', supplier_invoice: '', received_on: today(), quantity: '', unit_price: '', extra_costs: '' }
  const [form, setForm] = useState(empty)
  const [done, setDone] = useState<string | null>(null)
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const resold = products.data?.filter((p) => p.origin === 'resold') ?? []
  const product = resold.find((p) => String(p.id) === form.product_id)
  const preview = product ? previewReceipt({
    quantity: Number(form.quantity), unitPrice: Number(form.unit_price), extraCosts: Number(form.extra_costs || 0),
    stockBefore: product.stock_quantity, costBefore: product.cost_price, salePrice: product.price,
  }) : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!product) return
    setDone(null)
    create.mutate({
      product_id: product.id, supplier_name: form.supplier_name.trim(), supplier_invoice: form.supplier_invoice.trim() || null,
      received_on: form.received_on, quantity: Number(form.quantity), unit_price: Number(form.unit_price), extra_costs: form.extra_costs ? Number(form.extra_costs) : null,
    }, {
      onSuccess: () => {
        setDone(`${form.quantity} × ${[product.name, product.unit_size].filter(Boolean).join(' ')} reçus : stock et coût de revient mis à jour.`)
        setForm({ ...empty, supplier_name: form.supplier_name }) // même fournisseur probable pour la réception suivante
      },
    })
  }

  return (
    <>
      <Seo title="ERP — Réceptions d’achat" />
      <PageHeader title="Réceptions d’achat" subtitle="Pour les produits achetés et revendus. Les produits Dabo Hair entrent par « Fabrication »." />
      {products.isError && <QueryError message={apiErrorMessage(products.error)} onRetry={() => products.refetch()} />}

      <div className="grid gap-5 2xl:grid-cols-2 2xl:items-start">
        {canRecord && (
          <Card title="Nouvelle réception">
            {products.isPending ? <Skeleton className="h-64 bg-[#e4e4e7]" /> : resold.length === 0 ? (
              <p className="text-sm text-[#52525b]">
                Aucun produit « acheté et revendu » pour l’instant. Créez-le d’abord : <Link to="/admin/produits/nouveau" className="font-semibold text-ink underline">Nouveau produit</Link>, origine « Acheté et revendu ».
              </p>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <AdminField label="Produit (seulement les produits « achetés et revendus »)" htmlFor="r-product">
                  <AdminSelect id="r-product" value={form.product_id} onChange={set('product_id')} required>
                    <option value="">Choisir…</option>
                    {resold.map((p) => <option key={p.id} value={p.id}>{[p.name, p.unit_size].filter(Boolean).join(' ')}{p.brand ? ` · ${p.brand}` : ''}</option>)}
                  </AdminSelect>
                </AdminField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminField label="Fournisseur" htmlFor="r-supplier"><AdminInput id="r-supplier" value={form.supplier_name} onChange={set('supplier_name')} required minLength={2} maxLength={150} /></AdminField>
                  <AdminField label="N° de facture du fournisseur (facultatif)" htmlFor="r-invoice"><AdminInput id="r-invoice" value={form.supplier_invoice} onChange={set('supplier_invoice')} maxLength={60} /></AdminField>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <AdminField label="Date de réception" htmlFor="r-date"><AdminInput id="r-date" type="date" max={today()} value={form.received_on} onChange={set('received_on')} required /></AdminField>
                  <AdminField label="Quantité reçue" htmlFor="r-qty"><AdminInput id="r-qty" type="number" min={1} value={form.quantity} onChange={set('quantity')} required /></AdminField>
                  <AdminField label="Prix d’achat unitaire (F)" htmlFor="r-price"><AdminInput id="r-price" type="number" min={0} value={form.unit_price} onChange={set('unit_price')} required /></AdminField>
                </div>
                <AdminField label="Frais du lot : transport, douane (F, facultatif)" htmlFor="r-extra"><AdminInput id="r-extra" type="number" min={0} value={form.extra_costs} onChange={set('extra_costs')} /></AdminField>

                {product && preview && (
                  <dl aria-live="polite" className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-4 text-sm">
                    <dt className="text-[#52525b]">Achat : {form.quantity} × {money(Number(form.unit_price))}</dt><dd className="text-right">{money(preview.subtotal)}</dd>
                    <dt className="text-[#52525b]">+ Frais du lot</dt><dd className="text-right">{money(preview.total - preview.subtotal)}</dd>
                    <dt className="border-t border-[#e4e4e7] pt-2 font-semibold">Coût de revient de cette réception, par unité</dt><dd className="border-t border-[#e4e4e7] pt-2 text-right font-semibold">{money(preview.unitCost)}</dd>
                    <dt className="text-[#52525b]">Stock</dt><dd className="text-right">{product.stock_quantity} → <strong>{preview.stockAfter}</strong></dd>
                    <dt className="text-[#52525b]">Nouveau coût moyen du stock</dt><dd className="text-right">{money(preview.newCost)}</dd>
                    <dt className="text-[#52525b]">Marge par unité (prix de vente {formatPrice(product.price)} − coût)</dt>
                    <dd className={`text-right font-semibold ${preview.unitMargin !== null && preview.unitMargin < 0 ? 'text-[#b91c1c]' : 'text-[#14532d]'}`}>{preview.unitMargin !== null ? money(preview.unitMargin) : '—'}</dd>
                  </dl>
                )}
                {preview && preview.unitMargin !== null && preview.unitMargin < 0 && (
                  <Feedback kind="error">Attention : à ce prix d’achat, le produit est vendu à perte. Vérifiez le prix de vente dans « Produits et stock ».</Feedback>
                )}
                {create.isError && <Feedback kind="error">{firstError(create.error)}</Feedback>}
                {done && <Feedback kind="success">{done}</Feedback>}
                <Button type="submit" disabled={create.isPending || !product}>{create.isPending ? 'Enregistrement…' : 'Enregistrer la réception'}</Button>
                <p className="text-xs text-[#52525b]">Inscrite au grand livre du stock et au journal d’audit (qui, quand, combien).</p>
              </form>
            )}
          </Card>
        )}

        <Card title="Dernières réceptions">
          {receipts.isError ? <QueryError message={apiErrorMessage(receipts.error)} onRetry={() => receipts.refetch()} />
            : receipts.isPending ? <Skeleton className="h-40 bg-[#e4e4e7]" />
              : receipts.data.length === 0 ? <p className="text-sm text-[#52525b]">Aucune réception enregistrée.</p> : (
                <Table head={['Date', 'Produit', 'Fournisseur', 'Qté', 'Prix unit.', 'Coût unit.']} minWidth={620}>
                  {receipts.data.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">{shortDate(r.received_on)}</td>
                      <td>{r.product_name}{r.brand && <><br /><span className="text-xs text-[#52525b]">{r.brand}</span></>}</td>
                      <td>{r.supplier_name}{r.supplier_invoice && <><br /><span className="text-xs text-[#52525b]">Facture {r.supplier_invoice}</span></>}</td>
                      <td>{r.quantity}</td>
                      <td className="whitespace-nowrap">{money(r.unit_price)}</td>
                      <td className="whitespace-nowrap">{money(r.unit_cost)}</td>
                    </tr>
                  ))}
                </Table>
              )}
          <p className="rounded-xl bg-[#fafafa] p-3 text-sm text-[#3f3f46]">
            Si le prix d’achat change d’une commande à l’autre, le coût de revient devient la <strong>moyenne pondérée</strong> :
            10 unités à 2 000 F + 20 unités à 2 600 F = 2 400 F l’unité. La marge des Analyses reste juste.
          </p>
        </Card>
      </div>
    </>
  )
}
