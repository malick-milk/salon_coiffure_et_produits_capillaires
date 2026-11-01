/**
 * PAGE CATALOGUE.
 * Les filtres vivent dans l'URL (?category=serums&sort=price_asc) et non dans un état React :
 * - une recherche filtrée se partage par lien ou WhatsApp ;
 * - le bouton « Retour » du navigateur revient au filtre précédent ;
 * - la page reste correcte après un rechargement.
 */
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { EmptyState, QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/http'
import type { ProductFilters, ProductSort } from '@/types/api'
import { ProductCard } from '../components/ProductCard'
import { useCategories, useProducts } from '../hooks'

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Nouveautés' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'name', label: 'Nom (A à Z)' },
]

/** Lit les filtres depuis l'URL, en ignorant les valeurs invalides */
function readFilters(params: URLSearchParams): ProductFilters {
  const num = (key: string) => {
    const v = Number(params.get(key))
    return params.get(key) && Number.isFinite(v) && v >= 0 ? v : undefined
  }
  const sort = params.get('sort') as ProductSort | null
  return {
    category: params.get('category') ?? undefined,
    search: params.get('search') ?? undefined,
    min_price: num('min_price'),
    max_price: num('max_price'),
    in_stock: params.get('in_stock') === '1' || undefined,
    sort: sort && SORTS.some((s) => s.value === sort) ? sort : 'newest',
    page: num('page') ?? 1,
  }
}

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const products = useProducts(filters)
  const categories = useCategories()

  /** Modifie un paramètre d'URL ; tout changement de filtre ramène à la page 1 */
  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  // Champ de recherche : on valide à l'envoi du formulaire, pas à chaque lettre tapée
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  useEffect(() => setSearchInput(filters.search ?? ''), [filters.search])
  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    update({ search: searchInput.trim() || undefined })
  }

  const activeCategory = categories.data?.find((c) => c.slug === filters.category)
  const hasFilters = Boolean(filters.category || filters.search || filters.min_price || filters.max_price || filters.in_stock)
  const meta = products.data?.meta

  const filterPanel = (
    <div className="flex flex-col gap-7">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-3 text-[13px] font-semibold tracking-[0.14em] text-gold uppercase">Catégories</legend>
        <CategoryOption label="Toutes" active={!filters.category} onSelect={() => update({ category: undefined })} />
        {categories.data?.map((c) => (
          <CategoryOption
            key={c.id}
            label={c.name}
            count={c.product_count}
            indent={c.parent_id !== null}
            active={filters.category === c.slug}
            onSelect={() => update({ category: c.slug })}
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-[13px] font-semibold tracking-[0.14em] text-gold uppercase">Prix (F CFA)</legend>
        <div className="grid grid-cols-2 gap-2.5">
          <PriceInput id="min-price" label="Min" value={filters.min_price} onCommit={(v) => update({ min_price: v })} />
          <PriceInput id="max-price" label="Max" value={filters.max_price} onCommit={(v) => update({ max_price: v })} />
        </div>
      </fieldset>

      <label className="flex min-h-8 items-center gap-2.5 text-[15px]">
        <input
          type="checkbox"
          className="size-[18px] accent-gold"
          checked={Boolean(filters.in_stock)}
          onChange={(e) => update({ in_stock: e.target.checked ? '1' : undefined })}
        />
        En stock uniquement
      </label>
    </div>
  )

  return (
    <div className="px-4 pt-10 pb-24 sm:px-6">
      <Seo title={activeCategory ? activeCategory.name : 'Boutique'} description="Soins capillaires Dabo Hair : sérums, hydratants, soins traitants et shampooing." />
      <div className="mx-auto flex max-w-7xl flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-4xl font-semibold sm:text-5xl">{activeCategory?.name ?? 'Boutique'}</h1>
            <p className="text-muted" aria-live="polite">
              {meta ? `${meta.total} produit${meta.total > 1 ? 's' : ''}` : 'Chargement…'}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
            <form role="search" onSubmit={submitSearch} className="flex flex-1 flex-col gap-1.5 sm:w-72 sm:flex-none">
              <Label htmlFor="catalog-search" className="font-normal text-muted">Rechercher</Label>
              <div className="flex min-h-12 items-center gap-2.5 rounded-full border border-[#3a3a3a] bg-ink-soft px-3.5">
                <Search className="size-[18px] text-[#a3a3a3]" aria-hidden="true" />
                <input
                  id="catalog-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Sérum, spray, crème…"
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                />
              </div>
            </form>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="catalog-sort" className="font-normal text-muted">Trier par</Label>
              <select
                id="catalog-sort"
                value={filters.sort}
                onChange={(e) => update({ sort: e.target.value })}
                className="min-h-12 rounded-full border border-[#3a3a3a] bg-ink-soft px-4 text-[15px]"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm text-muted">Filtres actifs :</span>
            {activeCategory && <Chip label={activeCategory.name} onRemove={() => update({ category: undefined })} />}
            {filters.search && <Chip label={`« ${filters.search} »`} onRemove={() => update({ search: undefined })} />}
            {filters.min_price !== undefined && <Chip label={`Min ${filters.min_price} F`} onRemove={() => update({ min_price: undefined })} />}
            {filters.max_price !== undefined && <Chip label={`Max ${filters.max_price} F`} onRemove={() => update({ max_price: undefined })} />}
            {filters.in_stock && <Chip label="En stock" onRemove={() => update({ in_stock: undefined })} />}
            <Button variant="link" size="sm" onClick={() => setParams(new URLSearchParams())}>Tout effacer</Button>
          </div>
        )}

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Mobile : filtres repliables. <details> est accessible au clavier sans JavaScript. */}
          <details className="rounded-2xl border border-ink-line bg-ink-soft p-5 lg:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
              <SlidersHorizontal className="size-5" aria-hidden="true" /> Filtres
            </summary>
            <div className="pt-5">{filterPanel}</div>
          </details>
          <aside aria-label="Filtres" className="hidden w-72 shrink-0 rounded-2xl border border-ink-line bg-ink-soft p-6 lg:block">
            {filterPanel}
          </aside>

          <section aria-label="Résultats" className="flex min-w-0 flex-1 flex-col gap-8" aria-busy={products.isFetching}>
            {products.isError ? (
              <QueryError message={apiErrorMessage(products.error)} onRetry={() => products.refetch()} />
            ) : products.isPending ? (
              <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[4/6]" />)}
              </div>
            ) : products.data.data.length === 0 ? (
              <EmptyState title="Aucun produit ne correspond">
                <p className="text-muted">Essayez de retirer un filtre.</p>
                <Button variant="outline" size="sm" onClick={() => setParams(new URLSearchParams())}>Voir tous les produits</Button>
              </EmptyState>
            ) : (
              <div className={`grid grid-cols-2 gap-4 transition-opacity sm:gap-6 xl:grid-cols-3 ${products.isPlaceholderData ? 'opacity-60' : ''}`}>
                {products.data.data.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}

            {meta && meta.last_page > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-center gap-3">
                <Button variant="ghost" size="icon" aria-label="Page précédente" disabled={meta.current_page <= 1} onClick={() => update({ page: String(meta.current_page - 1) })}>
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <span className="text-sm">Page {meta.current_page} sur {meta.last_page}</span>
                <Button variant="ghost" size="icon" aria-label="Page suivante" disabled={meta.current_page >= meta.last_page} onClick={() => update({ page: String(meta.current_page + 1) })}>
                  <ChevronRight aria-hidden="true" />
                </Button>
              </nav>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function CategoryOption({ label, count, indent, active, onSelect }: { label: string; count?: number; indent?: boolean; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`flex min-h-10 items-center rounded-lg px-2 text-left text-[15px] hover:bg-ink ${indent ? 'pl-6' : ''} ${active ? 'font-semibold text-gold' : ''}`}
    >
      {label}
      {count !== undefined && <span className="ml-auto text-[13px] text-[#a3a3a3]">{count}</span>}
    </button>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Retirer le filtre ${label}`}
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-gold bg-gold-soft px-3.5 text-sm font-medium text-gold"
    >
      {label}
      <X className="size-3.5" aria-hidden="true" />
    </button>
  )
}

/** Champ de prix : la valeur n'est appliquée qu'en quittant le champ ou avec Entrée */
function PriceInput({ id, label, value, onCommit }: { id: string; label: string; value?: number; onCommit: (v: string | undefined) => void }) {
  const [draft, setDraft] = useState(value?.toString() ?? '')
  useEffect(() => setDraft(value?.toString() ?? ''), [value])
  const commit = () => onCommit(draft.trim() === '' ? undefined : String(Math.max(0, Math.floor(Number(draft)))))
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="font-normal text-muted">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={500}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="min-h-11"
      />
    </div>
  )
}
