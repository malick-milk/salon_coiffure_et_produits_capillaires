/** PAGE PANIER : modifier les quantités, retirer un article, voir le sous-total */
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { ImagePlaceholder } from '@/components/common/Placeholder'
import { Seo } from '@/components/common/Seo'
import { EmptyState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { useMe } from '@/features/auth/hooks'
import { useMemberPricing } from '../memberPrice'
import { MAX_QUANTITY_PER_ITEM, useCart, useCartCount, useCartSubtotal } from '../store'

export function CartPage() {
  const items = useCart((s) => s.items)
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)
  const count = useCartCount()
  const subtotal = useCartSubtotal()
  const member = useMemberPricing()
  const me = useMe()
  const total = subtotal - member.discount
  // Retour de l'inscription (ou de la connexion) : on confirme que le prix membre est appliqué
  const welcome = (useLocation().state as { welcome?: boolean } | null)?.welcome && member.applied.length > 0

  return (
    <div className="px-4 pt-10 pb-24 sm:px-6">
      <Seo title="Panier" />
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        {welcome && (
          <p role="status" className="rounded-xl border border-[#1f4d2b] bg-[#0f1f14] px-4 py-3 text-sm text-[#a7e3bd]">
            Bienvenue{me.data ? ` ${me.data.first_name}` : ''} : votre prix membre est appliqué.
          </p>
        )}
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
                const saving = member.savingFor(item.productId)
                const status = member.lines.find((l) => l.item.productId === item.productId)?.offer?.status
                return (
                  <li key={item.productId} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                    <ImagePlaceholder label="Photo" className="size-20 shrink-0 rounded-xl border-0 bg-ink" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link to={`/produits/${item.slug}`} className="font-display text-lg hover:text-gold">{label}</Link>
                      <span className="text-sm text-muted">{formatPrice(item.price)} l'unité</span>
                      {saving > 0 && <span className="text-sm font-semibold text-gold">1 au prix membre : <span className="whitespace-nowrap">{formatPrice(item.price - saving)}</span></span>}
                      {status === 'already_used' && <span className="text-xs text-muted">Prix membre déjà utilisé sur ce compte (une gamme par compte)</span>}
                      {status === 'sold_out' && <span className="text-xs text-muted">Les gammes au prix membre sont toutes parties</span>}
                    </div>
                    <div role="group" aria-label={`Quantité de ${label}`} className="flex items-center rounded-full border border-[#3a3a3a]">
                      <Button variant="ghost" size="icon" aria-label="Diminuer" disabled={item.quantity <= 1} onClick={() => setQuantity(item.productId, item.quantity - 1)}><Minus aria-hidden="true" /></Button>
                      <span className="min-w-8 text-center font-semibold" aria-live="polite">{item.quantity}</span>
                      <Button variant="ghost" size="icon" aria-label="Augmenter" disabled={item.quantity >= MAX_QUANTITY_PER_ITEM} onClick={() => setQuantity(item.productId, item.quantity + 1)}><Plus aria-hidden="true" /></Button>
                    </div>
                    <strong className={`w-28 text-right ${saving > 0 ? 'text-gold' : ''}`}>{formatPrice(item.price * item.quantity - saving)}</strong>
                    <Button variant="ghost" size="icon" aria-label={`Retirer ${label} du panier`} onClick={() => remove(item.productId)}><Trash2 aria-hidden="true" /></Button>
                  </li>
                )
              })}
            </ul>

            <div className="flex flex-col gap-4 lg:w-80">
            {member.signIn && (
              <section aria-labelledby="offre-membre" className="flex flex-col gap-3 rounded-[18px] border-2 border-gold bg-gold-soft p-5">
                <h2 id="offre-membre" className="text-[17px] font-semibold text-gold">Payez <span className="whitespace-nowrap">{formatPrice(member.signIn.memberPrice)}</span> au lieu de <span className="whitespace-nowrap">{formatPrice(member.signIn.item.price)}</span></h2>
                <p className="text-sm leading-relaxed text-[#e6e1d6]">Créez votre compte gratuit : le prix membre s’applique tout de suite à ce panier. Vos articles restent dedans.</p>
                <Button asChild><Link to="/inscription?redirect=/panier">Créer mon compte gratuit</Link></Button>
                <p className="text-center text-sm text-[#c9c4b8]">Déjà membre ? <Link to="/connexion?redirect=/panier" className="font-semibold text-gold underline underline-offset-4">Se connecter</Link></p>
              </section>
            )}
            <aside aria-label="Total" className="flex flex-col gap-4 rounded-[20px] bg-ivory p-7 text-ink">
              <h2 className="font-display text-[22px] font-semibold">Total</h2>
              <div className="flex justify-between text-[15px]"><span className="text-[#52525b]">{count} article{count > 1 ? 's' : ''}{member.discount > 0 ? ' · prix normal' : ''}</span><strong>{formatPrice(subtotal)}</strong></div>
              {member.discount > 0 && (
                <>
                  <div className="flex justify-between text-[15px] text-[#15803d]"><span>Prix membre</span><strong>−{formatPrice(member.discount)}</strong></div>
                  <div className="flex justify-between border-t border-[#e4e4e7] pt-3 text-lg"><span>Total</span><strong>{formatPrice(total)}</strong></div>
                </>
              )}
              <p className="text-[13px] leading-relaxed text-[#52525b]">Frais de livraison calculés à l'étape suivante selon votre zone. Retrait en boutique gratuit. Les prix sont confirmés par le serveur à la validation.</p>
              <Button asChild variant="dark"><Link to="/commande">{member.signIn ? `Commander sans compte · ${formatPrice(total)}` : 'Valider la commande'}</Link></Button>
              <p className="text-center text-xs text-[#52525b]">Commande possible sans compte. Paiement à la réception.</p>
            </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
