/** FICHE PRODUIT : photos, prix, contenances (variantes), quantité, ajout au panier */
import { Check, Minus, Plus, ShoppingBag, Store, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ImagePlaceholder } from '@/components/common/Placeholder'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MAX_QUANTITY_PER_ITEM, useCart } from '@/features/cart/store'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage, apiErrorStatus } from '@/lib/http'
import { cn } from '@/lib/utils'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { stockLabel } from '../components/ProductCard'
import { useProduct } from '../hooks'

export function ProductPage() {
  const { slug = '' } = useParams()
  const { data: product, isPending, isError, error, refetch } = useProduct(slug)
  const add = useCart((s) => s.add)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  if (isError) {
    if (apiErrorStatus(error) === 404) return <NotFoundPage />
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <QueryError message={apiErrorMessage(error)} onRetry={() => refetch()} />
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2" aria-busy="true">
        <Skeleton className="aspect-square" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-28" />
        </div>
      </div>
    )
  }

  const soldOut = product.stock_status === 'out_of_stock'
  const fullName = [product.name, product.unit_size].filter(Boolean).join(' ')

  const addToCart = () => {
    add({ productId: product.id, slug: product.slug, name: product.name, unitSize: product.unit_size, price: product.price }, quantity)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 2500)
  }

  return (
    <div className="px-4 pt-8 pb-24 sm:px-6">
      <Seo title={fullName} description={product.short_description ?? `${fullName} — ${formatPrice(product.price)}. Soin capillaire Dabo Hair.`} />
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-2 text-sm text-[#a3a3a3]">
          <Link to="/" className="hover:text-gold">Accueil</Link>
          <span aria-hidden="true">/</span>
          <Link to="/boutique" className="hover:text-gold">Boutique</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/boutique?category=${product.category.slug}`} className="hover:text-gold">{product.category.name}</Link>
          <span aria-hidden="true">/</span>
          <span className="text-ivory" aria-current="page">{fullName}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-4">
            {product.images[0] ? (
              <img src={product.images[0].url} alt={product.images[0].alt} className="aspect-square w-full rounded-[20px] object-cover" />
            ) : (
              <ImagePlaceholder label="Photo principale" hint="1200 × 1200 px · fond uni" className="aspect-square rounded-[20px]" />
            )}
          </div>

          <div className="flex flex-col gap-6">
            {product.brand && <p className="text-[13px] font-semibold tracking-[0.16em] text-gold uppercase">{product.brand.name} · fabrication maison</p>}
            <h1 className="font-display text-4xl leading-tight font-semibold sm:text-5xl">{product.name}</h1>
            <p className="flex items-baseline gap-3">
              <strong className="text-3xl font-semibold">{formatPrice(product.price)}</strong>
              <span className="text-sm text-[#a3a3a3]">TTC{product.unit_size && ` · ${product.unit_size}`}</span>
            </p>

            {product.variants.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <p id="variant-label" className="text-sm text-muted">Contenance</p>
                <div role="group" aria-labelledby="variant-label" className="flex flex-wrap gap-2.5">
                  {product.variants.map((v) => (
                    <Link
                      key={v.slug}
                      to={`/produits/${v.slug}`}
                      aria-current={v.is_current ? 'true' : undefined}
                      onClick={() => setQuantity(1)}
                      className={cn(
                        'flex min-h-12 flex-col justify-center rounded-xl px-5 text-[15px]',
                        v.is_current ? 'border-2 border-gold bg-gold-soft font-semibold' : 'border border-[#3a3a3a] hover:border-gold',
                      )}
                    >
                      {v.unit_size}
                      <span className={cn('text-xs', v.is_current ? 'text-gold' : 'text-[#a3a3a3]')}>{formatPrice(v.price)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <p className={cn('flex items-center gap-2.5 text-[15px]', soldOut ? 'text-[#a3a3a3]' : 'text-[#86efac]')}>
              <span aria-hidden="true" className={cn('size-2.5 rounded-full', soldOut ? 'bg-[#6b6b6b]' : 'bg-[#22c55e]')} />
              {stockLabel(product)}
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <div role="group" aria-label="Quantité" className="flex min-h-[52px] items-center rounded-full border border-[#3a3a3a]">
                <Button variant="ghost" size="icon" aria-label="Diminuer la quantité" disabled={quantity <= 1 || soldOut} onClick={() => setQuantity((q) => q - 1)}>
                  <Minus aria-hidden="true" />
                </Button>
                <span aria-live="polite" className="min-w-9 text-center text-lg font-semibold">{quantity}</span>
                <Button variant="ghost" size="icon" aria-label="Augmenter la quantité" disabled={quantity >= MAX_QUANTITY_PER_ITEM || soldOut} onClick={() => setQuantity((q) => q + 1)}>
                  <Plus aria-hidden="true" />
                </Button>
              </div>
              <Button className="min-h-[52px] flex-1 basis-60" disabled={soldOut} onClick={addToCart}>
                {added ? <Check aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />}
                {soldOut ? 'Indisponible' : added ? 'Ajouté au panier' : 'Ajouter au panier'}
              </Button>
            </div>
            {/* Annonce vocale pour les lecteurs d'écran */}
            <p className="sr-only" aria-live="polite">{added ? `${quantity} ${fullName} ajouté au panier` : ''}</p>
            {added && (
              <Link to="/panier" className="w-fit text-sm font-semibold text-gold underline underline-offset-4">Voir le panier</Link>
            )}

            <ul className="flex flex-col gap-3.5 border-y border-ink-line py-5 text-[15px] text-[#d9d9d9]">
              <li className="flex items-center gap-3"><Store className="size-5 text-gold" aria-hidden="true" />Retrait gratuit en boutique</li>
              <li className="flex items-center gap-3"><Truck className="size-5 text-gold" aria-hidden="true" />Livraison à Dakar selon la zone</li>
              <li className="flex items-center gap-3"><Check className="size-5 text-gold" aria-hidden="true" />Paiement à la réception (espèces, Wave, Orange Money)</li>
            </ul>
            <p className="text-[13px] text-[#a3a3a3]">Référence : {product.sku} · Numéro de lot et date de péremption imprimés sur le flacon</p>
          </div>
        </div>

        <section aria-labelledby="description-title" className="flex max-w-3xl flex-col gap-4">
          <h2 id="description-title" className="font-display text-3xl font-semibold">Description</h2>
          {/* Texte affiché comme TEXTE (jamais en HTML brut) : protection contre le XSS */}
          <p className="leading-relaxed whitespace-pre-line text-[#d9d9d9]">
            {product.description ?? '[Description à fournir par l’entreprise : bienfaits, conseils d’utilisation, composition.]'}
          </p>
        </section>
      </div>
    </div>
  )
}
