/**
 * VALIDATION DE COMMANDE (EF-CLI-05, commande invité autorisée — ADR-011).
 * Le navigateur n'envoie que des identifiants de produits et des quantités : le serveur
 * recalcule prix, frais et total (RG-COM-04) et vérifie le stock (RG-STK-01).
 */
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { Check, MapPin, Store, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, Navigate } from 'react-router'
import { applyServerErrors, Field } from '@/components/common/FormField'
import { Seo } from '@/components/common/Seo'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { useMe } from '@/features/auth/hooks'
import { useCart, useCartSubtotal } from '@/features/cart/store'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage, apiErrorStatus, type ValidationErrorBody } from '@/lib/http'
import { cn } from '@/lib/utils'
import type { OrderDetail, StockConflict } from '@/types/api'
import { useDeliveryZones, usePickupPoints, usePlaceOrder } from '../api'
import { checkoutSchema, type CheckoutInput, type CheckoutValues } from '../schema'

const FORM_ID = 'checkout-form'

export function CheckoutPage() {
  const items = useCart((s) => s.items)
  const clear = useCart((s) => s.clear)
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)
  const subtotal = useCartSubtotal()
  const { data: user } = useMe()
  const zones = useDeliveryZones()
  const points = usePickupPoints()
  const placeOrder = usePlaceOrder()
  const [confirmed, setConfirmed] = useState<OrderDetail | null>(null)
  const [conflict, setConflict] = useState<StockConflict | null>(null)

  const { register, handleSubmit, control, setError, reset, formState: { errors } } = useForm<CheckoutInput, unknown, CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fulfillment_method: 'pickup', delivery_zone_id: '', pickup_point_id: '', first_name: '', last_name: '', phone: '', email: '',
      city: 'Dakar', district: '', address_line: '', landmark: '', notes: '', consent: false as unknown as true,
    },
    mode: 'onTouched',
  })

  // Client connecté : on préremplit ses coordonnées (il peut les modifier pour cette commande).
  // keepDirtyValues : si le client a déjà commencé à taper, sa saisie n'est pas écrasée.
  useEffect(() => {
    if (user) reset((v) => ({ ...v, first_name: user.first_name, last_name: user.last_name, phone: user.phone ?? '', email: user.email }), { keepDirtyValues: true })
  }, [user, reset])

  const method = useWatch({ control, name: 'fulfillment_method' })
  const zoneId = useWatch({ control, name: 'delivery_zone_id' })
  const zone = zones.data?.find((z) => String(z.id) === zoneId)
  const pointId = useWatch({ control, name: 'pickup_point_id' })
  const point = points.data?.find((p) => String(p.id) === pointId)
  const shippingFee = method === 'delivery' ? (zone?.fee ?? 0) : 0

  if (confirmed) return <OrderConfirmation order={confirmed} isGuest={!user} />
  if (items.length === 0) return <Navigate to="/panier" replace />

  const onSubmit = (v: CheckoutValues) => {
    setConflict(null)
    placeOrder.mutate(
      {
        items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })), // AUCUN prix envoyé
        fulfillment_method: v.fulfillment_method,
        delivery_zone_id: v.fulfillment_method === 'delivery' ? Number(v.delivery_zone_id) : null,
        pickup_point_id: v.fulfillment_method === 'pickup_point' ? Number(v.pickup_point_id) : null,
        customer: { first_name: v.first_name, last_name: v.last_name, phone: v.phone, email: v.email || null },
        shipping_address: v.fulfillment_method === 'delivery' ? { city: v.city, district: v.district || null, address_line: v.address_line, landmark: v.landmark || null } : null,
        notes: v.notes || null,
        consent: v.consent,
      },
      {
        onSuccess: (order) => {
          clear()
          setConfirmed(order)
          window.scrollTo({ top: 0 })
        },
        onError: (error) => {
          const status = apiErrorStatus(error)
          if (status === 409 && axios.isAxiosError<StockConflict>(error) && error.response) setConflict(error.response.data)
          if (status === 422 && axios.isAxiosError<ValidationErrorBody>(error)) {
            applyServerErrors(error.response?.data.errors, setError, 'customer.')
            applyServerErrors(Object.fromEntries(Object.entries(error.response?.data.errors ?? {}).filter(([k]) => k.startsWith('shipping_address.'))), setError, 'shipping_address.')
          }
        },
      },
    )
  }

  return (
    <div className="px-4 pt-10 pb-24 sm:px-6">
      <Seo title="Validation de la commande" />
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Validation de la commande</h1>
          {!user && (
            <p className="text-muted">
              Commande possible sans compte.{' '}
              <Link to="/connexion?redirect=/commande" className="font-semibold text-gold underline underline-offset-4">Se connecter</Link> pour retrouver vos coordonnées et suivre la commande.
            </p>
          )}
        </div>

        {conflict && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-[#b45309] bg-[#2a1a05] p-5">
            <p className="font-semibold">{conflict.message}</p>
            <ul className="flex flex-col gap-2">
              {conflict.items.map((c) => (
                <li key={c.product_id} className="flex flex-wrap items-center gap-3 text-[15px]">
                  <span className="flex-1">{c.name} : {c.requested} demandé{c.requested > 1 ? 's' : ''}, {c.available === 0 ? 'plus aucun en stock' : `${c.available} disponible${c.available > 1 ? 's' : ''}`}</span>
                  {c.available > 0 && <Button size="sm" variant="outline" onClick={() => { setQuantity(c.product_id, c.available); setConflict(null) }}>Passer à {c.available}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => { remove(c.product_id); setConflict(null) }}>Retirer</Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <form id={FORM_ID} noValidate onSubmit={handleSubmit(onSubmit)} className="flex min-w-0 flex-1 flex-col gap-6">
            <fieldset className="flex flex-col gap-4 rounded-[20px] border border-ink-line bg-ink-soft p-5 sm:p-7">
              <legend className="sr-only">Mode de réception</legend>
              <h2 className="font-display text-2xl font-semibold" aria-hidden="true">1. Mode de réception</h2>
              <div className={cn('grid gap-3', points.data?.length ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                {([
                  ['pickup', Store, 'Retrait au salon', 'Dakar · gratuit, prêt sous 24 h'],
                  ['delivery', Truck, 'Livraison', 'Dakar et environs · frais selon la zone'],
                  // Étape 14 : affiché seulement s'il existe au moins un point de retrait partenaire actif
                  ...(points.data?.length ? [['pickup_point', MapPin, 'Point de retrait', 'Dans votre région · gratuit'] as const] : []),
                ] as const).map(([value, Icon, title, hint]) => (
                  <label key={value} className={cn('flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4', method === value ? 'border-gold bg-gold-soft' : 'border-[#2a2a2a]')}>
                    <input type="radio" value={value} className="mt-1 size-[18px] accent-gold" {...register('fulfillment_method')} />
                    <span className="flex flex-col gap-1"><span className="flex items-center gap-2 font-semibold"><Icon className="size-5 text-gold" aria-hidden="true" />{title}</span><span className="text-sm text-muted">{hint}</span></span>
                  </label>
                ))}
              </div>
              {method === 'pickup_point' && (
                <div className="flex flex-col gap-3 pt-2">
                  <Field label="Point de retrait de votre région *" error={errors.pickup_point_id?.message}>
                    {(id, d) => (
                      <select id={id} aria-invalid={!!errors.pickup_point_id} aria-describedby={d} className="min-h-12 rounded-[10px] border border-[#3a3a3a] bg-ink px-3.5" {...register('pickup_point_id')}>
                        <option value="">Choisir votre région…</option>
                        {points.data?.map((p) => <option key={p.id} value={p.id}>{p.regions.join(', ')} — {p.city}</option>)}
                      </select>
                    )}
                  </Field>
                  {point && (
                    <div className="flex flex-col gap-1 rounded-2xl border border-gold-dark bg-ink p-4 text-sm">
                      <strong className="text-[15px]">{point.name}</strong>
                      <span>{point.address}, {point.city}</span>
                      {point.opening_hours && <span className="text-muted">{point.opening_hours}</span>}
                      <span className="pt-1 text-muted">Quand votre commande est prête, vous recevez un SMS avec un code de retrait à donner au partenaire. Paiement sur place (espèces ou Wave), au prix du site.</span>
                    </div>
                  )}
                </div>
              )}
              {method === 'delivery' && (
                <div className="grid gap-5 pt-2 sm:grid-cols-2">
                  <Field label="Zone de livraison *" error={errors.delivery_zone_id?.message}>
                    {(id, d) => (
                      <select id={id} aria-invalid={!!errors.delivery_zone_id} aria-describedby={d} className="min-h-12 rounded-[10px] border border-[#3a3a3a] bg-ink px-3.5" {...register('delivery_zone_id')}>
                        <option value="">Choisir…</option>
                        {zones.data?.map((z) => <option key={z.id} value={z.id}>{z.name} — {formatPrice(z.fee)}</option>)}
                      </select>
                    )}
                  </Field>
                  <Field label="Ville *" error={errors.city?.message}>{(id, d) => <Input id={id} autoComplete="address-level2" aria-invalid={!!errors.city} aria-describedby={d} {...register('city')} />}</Field>
                  <Field label="Quartier" error={errors.district?.message}>{(id, d) => <Input id={id} aria-describedby={d} {...register('district')} />}</Field>
                  <Field label="Adresse *" error={errors.address_line?.message}>{(id, d) => <Input id={id} autoComplete="street-address" aria-invalid={!!errors.address_line} aria-describedby={d} {...register('address_line')} />}</Field>
                  <div className="sm:col-span-2">
                    <Field label="Point de repère" hint="Exemple : en face de la pharmacie, immeuble bleu, 2e étage.">{(id, d) => <Input id={id} aria-describedby={d} {...register('landmark')} />}</Field>
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-5 rounded-[20px] border border-ink-line bg-ink-soft p-5 sm:p-7">
              <legend className="sr-only">Vos coordonnées</legend>
              <h2 className="font-display text-2xl font-semibold" aria-hidden="true">2. Vos coordonnées</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Prénom *" error={errors.first_name?.message}>{(id, d) => <Input id={id} autoComplete="given-name" aria-invalid={!!errors.first_name} aria-describedby={d} {...register('first_name')} />}</Field>
                <Field label="Nom *" error={errors.last_name?.message}>{(id, d) => <Input id={id} autoComplete="family-name" aria-invalid={!!errors.last_name} aria-describedby={d} {...register('last_name')} />}</Field>
                <Field label="Téléphone mobile *" hint="Pour vous prévenir quand la commande est prête." error={errors.phone?.message}>{(id, d) => <Input id={id} type="tel" inputMode="tel" autoComplete="tel" placeholder="77 123 45 67" aria-invalid={!!errors.phone} aria-describedby={d} {...register('phone')} />}</Field>
                <Field label="Email (facultatif)" error={errors.email?.message}>{(id, d) => <Input id={id} type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={d} {...register('email')} />}</Field>
              </div>
              <Field label="Remarque (facultatif)" error={errors.notes?.message}>{(id, d) => <Textarea id={id} rows={2} maxLength={500} aria-describedby={d} {...register('notes')} />}</Field>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-start gap-3 text-sm leading-relaxed text-[#d9d9d9]">
                  <input type="checkbox" className="mt-0.5 size-[18px] accent-gold" aria-invalid={!!errors.consent} {...register('consent')} />
                  J'accepte les conditions de vente et l'utilisation de mes données pour traiter la commande.
                </label>
                {errors.consent && <p role="alert" className="text-sm font-medium text-[#f87171]">{errors.consent.message}</p>}
              </div>
            </fieldset>
          </form>

          <aside aria-label="Récapitulatif de la commande" className="flex flex-col gap-4 rounded-[20px] bg-ivory p-7 text-ink lg:sticky lg:top-24 lg:w-[360px] lg:shrink-0">
            <h2 className="font-display text-[22px] font-semibold">Récapitulatif</h2>
            <ul className="flex flex-col gap-2.5 border-b border-[#e4e4e7] pb-4 text-[15px]">
              {items.map((i) => (
                <li key={i.productId} className="flex justify-between gap-3">
                  <span>{i.quantity} × {[i.name, i.unitSize].filter(Boolean).join(' ')}</span>
                  <span className="whitespace-nowrap">{formatPrice(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-2 text-[15px]">
              <div className="flex justify-between"><dt className="text-[#52525b]">Sous-total</dt><dd>{formatPrice(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#52525b]">Livraison</dt><dd>{method !== 'delivery' ? 'Gratuite' : zone ? formatPrice(shippingFee) : 'Choisir une zone'}</dd></div>
              <div className="flex justify-between border-t border-[#e4e4e7] pt-3 text-lg"><dt>Total</dt><dd className="font-semibold">{formatPrice(subtotal + shippingFee)}</dd></div>
            </dl>
            <p className="text-[13px] leading-relaxed text-[#52525b]">Paiement à la réception : espèces, Wave, Orange Money ou Free Money. Montant définitif confirmé par le serveur.</p>
            {placeOrder.isError && ![409, 422].includes(apiErrorStatus(placeOrder.error) ?? 0) && <p role="alert" className="text-sm text-[#b91c1c]">{apiErrorMessage(placeOrder.error)}</p>}
            <Button type="submit" form={FORM_ID} variant="dark" disabled={placeOrder.isPending}>{placeOrder.isPending ? 'Envoi…' : 'Confirmer la commande'}</Button>
          </aside>
        </div>
      </div>
    </div>
  )
}

function OrderConfirmation({ order, isGuest }: { order: OrderDetail; isGuest: boolean }) {
  return (
    <div className="px-4 py-16 sm:px-6">
      <Seo title="Commande enregistrée" />
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center motion-safe:animate-fade-up">
        <span className="flex size-[72px] items-center justify-center rounded-full bg-gold text-ink"><Check className="size-9" aria-hidden="true" /></span>
        <h1 className="font-display text-4xl font-semibold">Commande enregistrée</h1>
        <p className="leading-relaxed text-muted">
          {order.items_count} article{order.items_count > 1 ? 's' : ''} · <span className="text-ivory">{formatPrice(order.total)}</span>
          {order.fulfillment_method === 'pickup' ? ' · retrait au salon' : order.fulfillment_method === 'pickup_point' ? ` · retrait chez ${order.pickup_point?.name ?? 'notre partenaire'}, ${order.pickup_point?.city ?? ''}` : ` · livraison ${order.delivery_zone}`}.
          {order.fulfillment_method === 'pickup_point' ? ' Vous recevrez votre code de retrait par SMS dès que la commande sera prête.' : ' Nous vous prévenons par SMS.'}
        </p>
        <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-gold px-7 py-4">
          <span className="text-[13px] text-muted">Référence de commande</span>
          <strong className="text-2xl tracking-[0.08em] text-gold">{order.reference}</strong>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {isGuest
            ? <Button asChild variant="outline"><Link to="/inscription">Créer un compte pour suivre mes commandes</Link></Button>
            : <Button asChild variant="outline"><Link to={`/compte/commandes/${order.reference}`}>Suivre ma commande</Link></Button>}
          <Button asChild><Link to="/boutique">Continuer mes achats</Link></Button>
        </div>
      </div>
    </div>
  )
}
