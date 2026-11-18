/**
 * MODIFIER UN PRODUIT (maquette validée le 18 novembre 2026).
 * Règles : la référence et l'adresse web ne changent jamais ; l'origine et le coût de revient se verrouillent
 * dès le premier lot fabriqué ou la première réception d'achat ; la marge s'affiche AVANT et APRÈS un changement
 * de prix ; chaque modification va au journal d'audit ; les commandes passées gardent leur prix (figé à l'achat).
 * Seuls les champs réellement modifiés sont envoyés : le journal ne garde que de vrais changements.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import { cn } from '@/lib/utils'
import type { AdminProduct, ProductChanges, ProductHistoryEntry, ProductOrigin } from '@/types/admin'
import { useAdminCategories, useAdminProducts, useBrands, useProductHistory, useUpdateProduct } from '../api'
import { AdminField, AdminInput, AdminSelect, AdminTextarea, Card, dateTime, Feedback, PageHeader } from '../components/ui'
import { productMargin } from '../purchaseMath'
import { PhotosPanel } from './CatalogPages'
import { firstError } from './OrdersPages'

const label = (p: Pick<AdminProduct, 'name' | 'unit_size'>) => [p.name, p.unit_size].filter(Boolean).join(' ')

/** Les valeurs du formulaire, en texte (comme les champs) */
interface Form {
  origin: ProductOrigin
  name: string
  brandId: string
  categoryId: string
  unitSize: string
  threshold: string
  cost: string
  price: string
  compareAt: string
  shortDescription: string
  description: string
}

const toForm = (p: AdminProduct): Form => ({
  origin: p.origin, name: p.name, brandId: String(p.brand_id ?? ''), categoryId: String(p.category_id), unitSize: p.unit_size ?? '',
  threshold: String(p.low_stock_threshold), cost: p.cost_price !== null ? String(Math.round(p.cost_price)) : '', price: String(p.price),
  compareAt: p.compare_at_price !== null ? String(p.compare_at_price) : '', shortDescription: p.short_description ?? '', description: p.description ?? '',
})

/** Ne garde que ce qui a changé par rapport au produit enregistré */
function changes(p: AdminProduct, f: Form): ProductChanges {
  const out: ProductChanges = {}
  const text = (v: string) => v.trim() || null
  if (!p.stock_entries_locked && f.origin !== p.origin) out.origin = f.origin
  if (f.name.trim() !== p.name) out.name = f.name.trim()
  if (Number(f.brandId) !== p.brand_id) out.brand_id = Number(f.brandId)
  if (Number(f.categoryId) !== p.category_id) out.category_id = Number(f.categoryId)
  if (text(f.unitSize) !== p.unit_size) out.unit_size = text(f.unitSize)
  if (Number(f.threshold) !== p.low_stock_threshold) out.low_stock_threshold = Number(f.threshold)
  if (!p.stock_entries_locked && f.cost !== '' && Number(f.cost) !== p.cost_price) out.cost_price = Number(f.cost)
  if (Number(f.price) !== p.price) out.price = Number(f.price)
  const compareAt = f.compareAt === '' ? null : Number(f.compareAt)
  if (compareAt !== p.compare_at_price) out.compare_at_price = compareAt
  if (text(f.shortDescription) !== p.short_description) out.short_description = text(f.shortDescription)
  if (text(f.description) !== p.description) out.description = text(f.description)
  return out
}

export function EditProductPage() {
  const id = Number(useParams().id)
  const products = useAdminProducts()
  const product = products.data?.find((p) => p.id === id)

  if (products.isError) return <QueryError message={apiErrorMessage(products.error)} onRetry={() => products.refetch()} />
  if (products.isPending) return <Skeleton className="h-96 bg-[#e4e4e7]" />
  if (!product) return <Feedback kind="error">Ce produit n’existe pas (ou plus). <Link to="/admin/produits" className="underline">Retour aux produits</Link></Feedback>
  // key : si on passe d'un produit à un autre, le formulaire repart des bonnes valeurs
  return <EditProductForm key={product.id} product={product} />
}

function EditProductForm({ product }: { product: AdminProduct }) {
  const navigate = useNavigate()
  const brands = useBrands()
  const categories = useAdminCategories()
  const update = useUpdateProduct()
  const [form, setForm] = useState<Form>(() => toForm(product))
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Une photo ajoutée met la liste à jour : le formulaire, lui, garde ce qui est en cours de saisie
  useEffect(() => setError(null), [product.images.length])

  const locked = product.stock_entries_locked
  const diff = changes(product, form)
  const dirty = Object.keys(diff).length > 0
  const ready = form.name.trim().length >= 2 && form.brandId !== '' && form.categoryId !== '' && form.price !== '' && Number(form.price) >= 0
  const cost = locked ? product.cost_price : form.cost === '' ? null : Number(form.cost)
  const after = cost !== null && form.price !== '' ? productMargin(Number(form.price), cost) : null
  const before = product.cost_price !== null ? productMargin(product.price, product.cost_price) : null
  const marginChanged = Boolean(after && before && (after.amount !== before.amount))
  const brand = brands.data?.find((b) => String(b.id) === form.brandId)
  const category = categories.data?.find((c) => String(c.id) === form.categoryId)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    update.mutate({ id: product.id, ...diff }, {
      onSuccess: (saved) => navigate('/admin/produits', { state: { updated: label(saved) } }),
      onError: (err) => setError(firstError(err)),
    })
  }

  return (
    <>
      <Seo title={`ERP — Modifier ${label(product)}`} />
      <nav aria-label="Fil d'Ariane" className="text-sm text-[#52525b]"><Link to="/admin/produits" className="underline">Produits et stock</Link> / Modifier</nav>
      <PageHeader
        title={`Modifier · ${label(product)}`}
        actions={<>
          <Button asChild variant="subtle"><Link to="/admin/produits">Annuler</Link></Button>
          <Button type="submit" form="edit-product" variant="dark" disabled={!dirty || !ready || update.isPending}>{update.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}</Button>
        </>}
      />
      {error && <Feedback kind="error">{error}</Feedback>}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <form id="edit-product" onSubmit={submit} className="flex min-w-0 flex-col gap-5">
            <Card title="1. Origine du produit">
              {locked ? (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-[#d4d4d8] p-4">
                  <span className="flex flex-col gap-1">
                    <strong className="text-[15px] text-ink">{product.origin === 'resold' ? 'Acheté et revendu' : 'Fabriqué par Dabo Hair'}</strong>
                    <span className="text-sm text-[#52525b]">Ne peut plus changer : du stock est déjà entré par {product.origin === 'resold' ? 'une réception d’achat' : 'un lot fabriqué'} (le stock et le coût en dépendent).</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-[#d4d4d8] px-2.5 py-0.5 text-xs text-[#52525b]">verrouillé</span>
                </div>
              ) : (
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="sr-only">Origine du produit</legend>
                  {(['made', 'resold'] as const).map((value) => (
                    <label key={value} className={cn('flex cursor-pointer gap-3 rounded-xl border p-4', form.origin === value ? 'border-2 border-gold bg-[#fffbeb]' : 'border-[#d4d4d8]')}>
                      <input type="radio" name="origin" value={value} checked={form.origin === value} onChange={() => set('origin')(value)} className="mt-1 size-[18px] accent-ink" />
                      <span className="flex flex-col gap-1">
                        <strong className="text-[15px] text-ink">{value === 'made' ? 'Fabriqué par Dabo Hair' : 'Acheté et revendu'}</strong>
                        <span className="text-sm text-[#52525b]">Modifiable tant qu’aucun {value === 'made' ? 'lot' : 'achat'} n’est enregistré</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </Card>

            <Card title="2. Fiche">
              <AdminField label="Nom du produit" htmlFor="ep-name"><AdminInput id="ep-name" value={form.name} onChange={(e) => set('name')(e.target.value)} required minLength={2} maxLength={120} /></AdminField>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField label="Marque" htmlFor="ep-brand">
                  <AdminSelect id="ep-brand" value={form.brandId} onChange={(e) => set('brandId')(e.target.value)} required>
                    <option value="">Choisir…</option>
                    {brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </AdminSelect>
                </AdminField>
                <AdminField label="Catégorie" htmlFor="ep-category">
                  <AdminSelect id="ep-category" value={form.categoryId} onChange={(e) => set('categoryId')(e.target.value)} required>
                    <option value="">Choisir…</option>
                    {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </AdminSelect>
                </AdminField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField label="Contenance" htmlFor="ep-size"><AdminInput id="ep-size" value={form.unitSize} onChange={(e) => set('unitSize')(e.target.value)} maxLength={50} /></AdminField>
                <AdminField label="Seuil d’alerte de stock" htmlFor="ep-threshold"><AdminInput id="ep-threshold" type="number" min={0} value={form.threshold} onChange={(e) => set('threshold')(e.target.value)} /></AdminField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {locked ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-ink">Coût de revient actuel</span>
                    <span className="rounded-lg border border-dashed border-[#a1a1aa] bg-[#fafafa] px-3 py-2.5">{product.cost_price !== null ? `${product.cost_price.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} F` : '—'}</span>
                    <span className="text-xs text-[#52525b]">{product.origin === 'resold' ? 'Moyenne des réceptions d’achat' : 'Moyenne des lots fabriqués'} : il se met à jour tout seul</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <AdminField label="Coût de revient (F)" htmlFor="ep-cost"><AdminInput id="ep-cost" type="number" min={0} step={50} value={form.cost} onChange={(e) => set('cost')(e.target.value)} aria-describedby="ep-cost-aide" /></AdminField>
                    <span id="ep-cost-aide" className="text-xs text-[#52525b]">Se verrouille au premier {form.origin === 'resold' ? 'achat' : 'lot'} enregistré</span>
                  </div>
                )}
                <AdminField label="Prix de vente (F CFA)" htmlFor="ep-price"><AdminInput id="ep-price" type="number" min={0} step={100} value={form.price} onChange={(e) => set('price')(e.target.value)} required /></AdminField>
                <div className="flex flex-col gap-1.5">
                  <AdminField label="Prix barré (facultatif)" htmlFor="ep-compare"><AdminInput id="ep-compare" type="number" min={1} step={100} value={form.compareAt} onChange={(e) => set('compareAt')(e.target.value)} aria-describedby="ep-compare-aide" /></AdminField>
                  <span id="ep-compare-aide" className="text-xs text-[#52525b]">Ancien prix, affiché barré sur le site</span>
                </div>
              </div>
              {after && (
                <p aria-live="polite" className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3.5 text-[15px] ${after.loss ? 'border-[#fca5a5] bg-[#fef2f2] text-[#b91c1c]' : 'border-[#86efac] bg-[#f0fdf4] text-[#14532d]'}`}>
                  <span>{after.loss ? 'Attention : vendu à perte' : marginChanged ? 'Marge par unité (nouveau prix)' : 'Marge par unité'}</span>
                  <strong>
                    {after.loss ? `${formatPrice(-after.amount)} de perte par unité` : `${formatPrice(after.amount)} · ${after.rate.toLocaleString('fr-FR')} %`}
                    {marginChanged && before && ` · avant : ${formatPrice(before.amount)} · ${before.rate.toLocaleString('fr-FR')} %`}
                  </strong>
                </p>
              )}
              <AdminField label={`Description courte (sur la carte, ${form.shortDescription.length}/160)`} htmlFor="ep-short">
                <AdminInput id="ep-short" value={form.shortDescription} onChange={(e) => set('shortDescription')(e.target.value)} maxLength={160} />
              </AdminField>
              <AdminField label="Description complète" htmlFor="ep-desc">
                <AdminTextarea id="ep-desc" value={form.description} onChange={(e) => set('description')(e.target.value)} maxLength={10000} />
              </AdminField>
            </Card>
          </form>

          {/* Les photos s'enregistrent tout de suite (comme dans « Produits et stock ») : pas besoin du bouton Enregistrer */}
          <PhotosPanel product={product} canManage title={`3. Photos (${product.images.length} sur 4)`} />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card title="Aperçu dans la boutique">
            <div inert aria-hidden="true" className="rounded-2xl bg-ink p-3 text-ivory">
              <ProductCard product={{
                id: 0, slug: 'apercu', sku: '', name: form.name.trim() || product.name, brand: brand ? { name: brand.name, slug: '' } : null,
                unit_size: form.unitSize.trim() || null, price: Number(form.price) || 0, compare_at_price: form.compareAt === '' ? null : Number(form.compareAt),
                stock_status: product.stock_status, stock_left: null, is_featured: product.is_featured,
                category: { id: category?.id ?? 0, name: category?.name ?? '', slug: '' },
                image_url: (product.images.find((i) => i.is_primary) ?? product.images[0])?.url ?? null,
              }} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-[#52525b]">Référence (ne change pas)</dt><dd className="text-right">{product.sku}</dd>
              <dt className="text-[#52525b]">Adresse (ne change pas)</dt><dd className="text-right break-all">/produits/{product.slug}</dd>
              <dt className="text-[#52525b]">Stock</dt>
              <dd className="text-right">{product.stock_quantity} · <Link to="/admin/produits" state={{ stockOf: product.id }} className="text-gold-text underline">gérer le stock</Link></dd>
              <dt className="text-[#52525b]">Statut</dt>
              <dd className={`text-right ${product.is_active ? 'text-[#14532d]' : 'text-[#52525b]'}`}>{product.is_active ? 'En vente' : 'Brouillon (invisible)'}</dd>
            </dl>
          </Card>
          <History productId={product.id} />
        </aside>
      </div>
    </>
  )
}

const FIELD_LABELS: Record<string, string> = {
  origin: 'origine', name: 'nom', brand_id: 'marque', category_id: 'catégorie', unit_size: 'contenance', price: 'prix', compare_at_price: 'prix barré',
  cost_price: 'coût', is_active: 'en vente', is_featured: 'mis en avant', low_stock_threshold: 'seuil', short_description: 'description courte', description: 'description',
}
const MONEY = new Set(['price', 'compare_at_price', 'cost_price'])
const FEMININE = new Set(['origin', 'brand_id', 'category_id', 'unit_size', 'short_description', 'description'])
const EVENT_LABELS: Record<string, string> = { created: 'fiche créée', image_added: 'photo ajoutée', image_removed: 'photo retirée', deleted: 'fiche supprimée' }

/** « prix 5 500 → 6 000 F », « description courte modifiée » : une phrase courte par ligne du journal */
export function describeEntry(e: Pick<ProductHistoryEntry, 'event' | 'changes'>): string {
  if (e.event !== 'updated') return EVENT_LABELS[e.event] ?? e.event
  return e.changes.map(({ field, old, new: value }) => {
    const name = FIELD_LABELS[field] ?? field
    if (MONEY.has(field)) {
      const f = (v: unknown) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 }))
      return `${name} ${f(old)} → ${f(value)} F`
    }
    if (field === 'is_active' || field === 'is_featured') return `${name} : ${value ? 'oui' : 'non'}`
    if (field === 'low_stock_threshold') return `${name} ${String(old)} → ${String(value)}`
    return `${name} modifié${FEMININE.has(field) ? 'e' : ''}`
  }).join(', ') || 'modification'
}

function History({ productId }: { productId: number }) {
  const history = useProductHistory(productId)
  return (
    <Card title="Dernières modifications">
      {history.isPending ? <Skeleton className="h-16 bg-[#e4e4e7]" />
        : history.isError ? <p className="text-sm text-[#52525b]">Historique indisponible.</p>
          : history.data.length === 0 ? <p className="text-sm text-[#52525b]">Aucune modification pour l’instant.</p> : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {history.data.map((e) => <li key={e.id}><span className="text-[#52525b]">{e.created_at ? dateTime(e.created_at) : ''} · {e.causer}</span> · {describeEntry(e)}</li>)}
            </ul>
          )}
      <Link to="/admin/audit" className="text-sm text-gold-text underline">Tout est dans le Journal d’audit</Link>
    </Card>
  )
}
