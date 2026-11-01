import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { ImagePlaceholder } from '@/components/common/Placeholder'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCart } from '@/features/cart/store'
import { formatPrice } from '@/lib/format'
import type { ProductSummary } from '@/types/api'

export function stockLabel(p: Pick<ProductSummary, 'stock_status' | 'stock_left'>): string {
  if (p.stock_status === 'out_of_stock') return 'Rupture de stock'
  if (p.stock_status === 'low_stock') return `Plus que ${p.stock_left} en stock`
  return 'En stock'
}

/** Carte produit réutilisée sur l'accueil, le catalogue et les « produits associés » */
export function ProductCard({ product }: { product: ProductSummary }) {
  const add = useCart((s) => s.add)
  const soldOut = product.stock_status === 'out_of_stock'
  const href = `/produits/${product.slug}`

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-ink-line bg-ink-soft motion-safe:animate-fade-up">
      <Link to={href} className="relative block" tabIndex={-1} aria-hidden="true">
        {product.image_url ? (
          <img src={product.image_url} alt="" className="aspect-[4/5] w-full object-cover" loading="lazy" />
        ) : (
          <ImagePlaceholder label="Photo produit" className="aspect-[4/5] border-0" />
        )}
        {product.is_featured && !soldOut && <Badge tone="gold" className="absolute top-3 left-3">Produit phare</Badge>}
        {product.stock_status === 'low_stock' && <Badge tone="warning" className="absolute top-3 left-3">Stock limité</Badge>}
        {soldOut && <Badge tone="neutral" className="absolute top-3 left-3">Rupture</Badge>}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-[18px]">
        {product.brand && <p className="text-xs tracking-[0.14em] text-gold uppercase">{product.brand.name}</p>}
        <h3 className="font-display text-xl leading-snug">
          <Link to={href} className="hover:text-gold">
            {product.name}
            {product.unit_size && <span className="text-muted"> {product.unit_size}</span>}
          </Link>
        </h3>
        <p className="text-[13px] text-muted">{stockLabel(product)}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <strong className="text-lg">{formatPrice(product.price)}</strong>
          <Button
            size="icon"
            disabled={soldOut}
            aria-label={`Ajouter ${product.name} ${product.unit_size ?? ''} au panier`}
            onClick={() => add({ productId: product.id, slug: product.slug, name: product.name, unitSize: product.unit_size, price: product.price })}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  )
}
