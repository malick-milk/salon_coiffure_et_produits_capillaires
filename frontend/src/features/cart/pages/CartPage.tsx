/** PAGE PANIER : modifier les quantités, retirer un article, voir le sous-total */
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { ImagePlaceholder } from '@/components/common/Placeholder'
import { Seo } from '@/components/common/Seo'
import { EmptyState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { MAX_QUANTITY_PER_ITEM, useCart, useCartCount, useCartSubtotal } from '../store'

export function CartPage() {
  const items = useCart((s) => s.items)
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)
  const count = useCartCount()
  const subtotal = useCartSubtotal()

  return (
    <div className="px-4 pt-10 pb-24 sm:px-6">
      <Seo title="Panier" />
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Panier</h1>

        {items.length === 0 ? (
          <EmptyState title="Votre panier est vide">
            <p className="text-muted">Découvrez les soins Dabo Hair.</p>
            <Button asChild><Link to="/boutique"><ShoppingBag aria-hidden="true" />Voir la boutique</Link></Button>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <ul className="flex flex-1 flex-col divide-y divide-ink-line rounded-2xl border border-ink-line bg-ink-soft" aria-label="Articles du panier">
              {items.map((item) => {
                const label = [item.name, item.unitSize].filter(Boolean).join(' ')
                return (
                  <li key={item.productId} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                    <ImagePlaceholder label="Photo" className="size-20 shrink-0 rounded-xl border-0 bg-ink" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link to={`/produits/${item.slug}`} className="font-display text-lg hover:text-gold">{label}</Link>
                      <span className="text-sm text-muted">{formatPrice(item.price)} l'unité</span>
                    </div>
                    <div role="group" aria-label={`Quantité de ${label}`} className="flex items-center rounded-full border border-[#3a3a3a]">
                      <Button variant="ghost" size="icon" aria-label="Diminuer" disabled={item.quantity <= 1} onClick={() => setQuantity(item.productId, item.quantity - 1)}><Minus aria-hidden="true" /></Button>
                      <span className="min-w-8 text-center font-semibold" aria-live="polite">{item.quantity}</span>
                      <Button variant="ghost" size="icon" aria-label="Augmenter" disabled={item.quantity >= MAX_QUANTITY_PER_ITEM} onClick={() => setQuantity(item.productId, item.quantity + 1)}><Plus aria-hidden="true" /></Button>
                    </div>
                    <strong className="w-28 text-right">{formatPrice(item.price * item.quantity)}</strong>
                    <Button variant="ghost" size="icon" aria-label={`Retirer ${label} du panier`} onClick={() => remove(item.productId)}><Trash2 aria-hidden="true" /></Button>
                  </li>
                )
              })}
            </ul>

            <aside aria-label="Total" className="flex flex-col gap-4 rounded-[20px] bg-ivory p-7 text-ink lg:w-80">
              <h2 className="font-display text-[22px] font-semibold">Total</h2>
              <div className="flex justify-between text-[15px]"><span className="text-[#52525b]">{count} article{count > 1 ? 's' : ''}</span><strong>{formatPrice(subtotal)}</strong></div>
              <p className="text-[13px] leading-relaxed text-[#52525b]">Frais de livraison calculés à l'étape suivante selon votre zone. Retrait en boutique gratuit. Les prix sont confirmés par le serveur à la validation.</p>
              <Button asChild variant="dark"><Link to="/commande">Valider la commande</Link></Button>
              <p className="text-center text-xs text-[#52525b]">Commande possible sans compte. Paiement à la réception.</p>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
