/**
 * NOUVELLE GAMME (maquette validée le 24 novembre 2026) : plusieurs produits vendus ensemble, à un prix unique.
 * 1. La gamme. 2. Ce qu'il y a dedans (produits et quantités). 3. Les prix (économie et marge en direct,
 * prix membre facultatif). 4. Photos. À droite : « Combien je peux en vendre » et l'aperçu de la carte.
 * La gamme n'a pas de stock à elle : le produit le plus rare limite tout. Brouillon d'abord, publication avec une photo.
 */
import { X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { formatPrice } from '@/lib/format'
import { resizeImage } from '@/lib/resizeImage'
import { useAdminProducts, useCreateBundle, useUpdateProduct, useUploadProductImage } from '../api'
import { AdminField, AdminInput, AdminSelect, AdminTextarea, Card, Feedback, PageHeader, Table } from '../components/ui'
import { bundleSummary } from '../purchaseMath'
import { type LocalPhoto, MAX_PHOTOS, PhotoPicker } from './NewProductPage'
import { firstError } from './OrdersPages'

interface Line { productId: number; quantity: number }

export function NewBundlePage() {
  const navigate = useNavigate()
  const products = useAdminProducts()
  const createBundle = useCreateBundle()
  const uploadImage = useUploadProductImage()
  const updateProduct = useUpdateProduct()

  const [name, setName] = useState('')
  const [threshold, setThreshold] = useState('10')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [pick, setPick] = useState('')
  const [pickQty, setPickQty] = useState('1')
  const [price, setPrice] = useState('')
  const [memberOn, setMemberOn] = useState(false)
  const [memberPrice, setMemberPrice] = useState('')
  const [memberLimit, setMemberLimit] = useState('200')
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null)

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Une gamme ne contient que des produits simples (jamais une autre gamme)
  const catalog = (products.data ?? []).filter((p) => !p.is_bundle)
  const label = (p: { name: string; unit_size: string | null }) => [p.name, p.unit_size].filter(Boolean).join(' ')
  const chosen = lines.flatMap((l) => {
    const p = catalog.find((c) => c.id === l.productId)
    return p ? [{ ...l, product: p }] : []
  })
  const priceN = Number(price)
  const memberN = memberOn && memberPrice !== '' ? Number(memberPrice) : null
  const target = memberOn && memberLimit !== '' ? Number(memberLimit) : null
  const sum = bundleSummary(
    chosen.map((c) => ({ name: label(c.product), price: c.product.price, cost: c.product.cost_price, stock: c.product.stock_quantity, quantity: c.quantity })),
    priceN, memberN, target,
  )
  const memberInvalid = memberOn && (memberN === null || memberN >= priceN || !target || target < 1)
  const ready = name.trim().length >= 2 && chosen.length >= 2 && price !== '' && priceN >= 0 && !memberInvalid
  const canPublish = ready && photos.length > 0

  const addLine = () => {
    const id = Number(pick)
    if (!id) return
    const qty = Math.max(1, Math.min(20, Number(pickQty) || 1))
    setLines((prev) => prev.some((l) => l.productId === id) ? prev.map((l) => l.productId === id ? { ...l, quantity: qty } : l) : [...prev, { productId: id, quantity: qty }])
    setPick('')
    setPickQty('1')
  }
  const setQty = (id: number, qty: number) => setLines((prev) => prev.map((l) => l.productId === id ? { ...l, quantity: Math.max(1, Math.min(20, qty || 1)) } : l))
  const removeLine = (id: number) => setLines((prev) => prev.filter((l) => l.productId !== id))

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const room = MAX_PHOTOS - photos.length
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room)
    setPhotos((prev) => [...prev, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))])
    if (files.length > room) setError(`4 photos au plus : ${files.length - room} photo(s) ignorée(s).`)
  }
  const removePhoto = (index: number) => setPhotos((prev) => { URL.revokeObjectURL(prev[index]!.url); return prev.filter((_, i) => i !== index) })
  const makeFirst = (index: number) => setPhotos((prev) => [prev[index]!, ...prev.filter((_, i) => i !== index)])

  const save = async (publish: boolean) => {
    setError(null)
    setSaving(publish ? 'publish' : 'draft')
    let createdId: number | null = null
    try {
      const bundle = await createBundle.mutateAsync({
        name: name.trim(), price: priceN, member_price: memberN, member_price_limit: memberN !== null ? target : null,
        low_stock_threshold: Number(threshold || 0), short_description: shortDescription.trim() || null, description: description.trim() || null,
        items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
      })
      createdId = bundle.id
      for (const photo of photos) await uploadImage.mutateAsync({ productId: bundle.id, image: await resizeImage(photo.file) })
      if (publish) await updateProduct.mutateAsync({ id: bundle.id, is_active: true })
      navigate('/admin/produits', { state: { created: bundle.name, published: publish, bundle: true } })
    } catch (e) {
      const message = e instanceof Error && !('isAxiosError' in e) ? e.message : firstError(e)
      setError(createdId ? `La gamme est enregistrée en brouillon, mais : ${message} Ajoutez la photo depuis « Produits et stock » → Photos.` : message)
    } finally {
      setSaving(null)
    }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void save(false) }

  return (
    <>
      <Seo title="ERP — Nouvelle gamme" />
      <nav aria-label="Fil d'Ariane" className="text-sm text-[#52525b]"><Link to="/admin/produits" className="underline">Produits et stock</Link> / Nouvelle gamme</nav>
      <PageHeader
        title="Nouvelle gamme"
        subtitle="Une gamme regroupe plusieurs produits vendus ensemble, à un prix unique."
        actions={<>
          <Button type="submit" form="new-bundle" variant="subtle" disabled={!ready || saving !== null}>{saving === 'draft' ? 'Enregistrement…' : 'Enregistrer en brouillon'}</Button>
          <Button type="button" variant="dark" disabled={!canPublish || saving !== null} onClick={() => void save(true)}>{saving === 'publish' ? 'Publication…' : 'Publier la gamme'}</Button>
        </>}
      />
      {error && <Feedback kind="error">{error}</Feedback>}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <form id="new-bundle" onSubmit={submit} className="flex min-w-0 flex-col gap-5">
          <Card title="1. La gamme">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <AdminField label="Nom de la gamme" htmlFor="nb-name"><AdminInput id="nb-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="Ex. Gamme à l’avocat" /></AdminField>
              <AdminField label="Seuil d’alerte" htmlFor="nb-threshold"><AdminInput id="nb-threshold" type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} /></AdminField>
            </div>
            <AdminField label={`Description courte (sur la carte, ${shortDescription.length}/160)`} htmlFor="nb-short">
              <AdminInput id="nb-short" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} maxLength={160} placeholder="À quoi sert la gamme, pour quels cheveux, en une phrase" />
            </AdminField>
            <AdminField label="Description complète (facultatif)" htmlFor="nb-desc">
              <AdminTextarea id="nb-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} placeholder="Comment utiliser la gamme, dans quel ordre" />
            </AdminField>
          </Card>

          <Card title="2. Ce qu’il y a dedans">
            {chosen.length > 0 && (
              <Table head={['Produit', 'Quantité', 'Prix seul', 'Coût de revient', 'En stock', '']} minWidth={620}>
                {chosen.map((c) => (
                  <tr key={c.productId}>
                    <td>{label(c.product)}</td>
                    <td><AdminInput aria-label={`Quantité de ${label(c.product)}`} type="number" min={1} max={20} value={c.quantity} onChange={(e) => setQty(c.productId, Number(e.target.value))} className="w-20" /></td>
                    <td>{formatPrice(c.product.price)}</td>
                    <td>{c.product.cost_price !== null ? formatPrice(Math.round(c.product.cost_price)) : <span className="text-[#b45309]">inconnu</span>}</td>
                    <td className={sum.limiting.includes(label(c.product)) ? 'font-semibold text-[#b45309]' : ''}>{c.product.stock_quantity}</td>
                    <td><button type="button" onClick={() => removeLine(c.productId)} aria-label={`Retirer ${label(c.product)}`} className="grid size-9 place-items-center rounded-full text-[#52525b] hover:bg-[#f4f4f5]"><X className="size-4" aria-hidden="true" /></button></td>
                  </tr>
                ))}
              </Table>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <AdminField label="Ajouter un produit" htmlFor="nb-pick">
                  <AdminSelect id="nb-pick" value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">Choisir un produit…</option>
                    {catalog.map((p) => <option key={p.id} value={p.id}>{label(p)} · {formatPrice(p.price)} · stock {p.stock_quantity}</option>)}
                  </AdminSelect>
                </AdminField>
              </div>
              <div className="w-28"><AdminField label="Quantité" htmlFor="nb-qty"><AdminInput id="nb-qty" type="number" min={1} max={20} value={pickQty} onChange={(e) => setPickQty(e.target.value)} /></AdminField></div>
              <Button type="button" variant="subtle" disabled={!pick} onClick={addLine}>Ajouter</Button>
            </div>
            {chosen.length < 2 && <p className="text-sm text-[#52525b]">Une gamme contient au moins 2 produits.</p>}
            {chosen.length > 0 && (
              <p className="text-sm text-[#52525b]">
                Acheter ces produits un par un : <strong className="text-ink">{formatPrice(sum.separate)}</strong>
                {sum.cost !== null && <> · coût de revient total : <strong className="text-ink">{formatPrice(sum.cost)}</strong></>}
              </p>
            )}
            {sum.unknownCost.length > 0 && (
              <p className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3 text-sm text-[#78350f]">
                Coût inconnu pour {sum.unknownCost.join(', ')} : la marge ne peut pas être calculée. Saisissez un lot de fabrication ou une réception d’achat pour ces produits.
              </p>
            )}
          </Card>

          <Card title="3. Les prix">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <AdminField label="Prix de la gamme (F CFA)" htmlFor="nb-price"><AdminInput id="nb-price" type="number" min={0} step={100} value={price} onChange={(e) => setPrice(e.target.value)} required /></AdminField>
                {price !== '' && chosen.length > 0 && (
                  <p aria-live="polite" className={`text-sm ${sum.saving > 0 ? 'text-[#166534]' : 'text-[#b45309]'}`}>
                    {sum.saving > 0 ? `La cliente économise ${formatPrice(sum.saving)} (${sum.savingRate.toLocaleString('fr-FR')} %) par rapport aux produits seuls` : 'La gamme n’est pas moins chère que les produits seuls'}
                  </p>
                )}
              </div>
              <MarginBox label="Marge par gamme" margin={price !== '' ? sum.margin : null} />
            </div>
            <label className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
              <input type="checkbox" checked={memberOn} onChange={(e) => setMemberOn(e.target.checked)} className="size-[18px] shrink-0 accent-ink" />
              Prix membre (réservé aux clientes avec un compte)
            </label>
            {memberOn && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <AdminField label="Prix membre (F CFA)" htmlFor="nb-member"><AdminInput id="nb-member" type="number" min={0} step={100} value={memberPrice} onChange={(e) => setMemberPrice(e.target.value)} aria-invalid={memberN !== null && memberN >= priceN} /></AdminField>
                  {memberN !== null && memberN >= priceN && <p className="text-sm text-[#b91c1c]">Doit être inférieur au prix de la gamme.</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <AdminField label="Nombre de gammes au prix membre" htmlFor="nb-limit"><AdminInput id="nb-limit" type="number" min={1} value={memberLimit} onChange={(e) => setMemberLimit(e.target.value)} /></AdminField>
                  <p className="text-xs text-[#52525b]">Une par compte</p>
                </div>
                <MarginBox label="Marge au prix membre" margin={memberN !== null ? sum.memberMargin : null} />
              </div>
            )}
          </Card>

          <Card title="4. Photos">
            <PhotoPicker photos={photos} onAdd={addPhotos} onRemove={removePhoto} onMakeFirst={makeFirst} />
          </Card>
        </form>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card title="Combien je peux en vendre">
            {chosen.length < 2 ? <p className="text-sm text-[#52525b]">Ajoutez au moins 2 produits.</p> : (
              <>
                <p className="text-4xl font-bold leading-none text-ink">{sum.possible} <span className="text-[15px] font-medium text-[#52525b]">gamme{sum.possible > 1 ? 's' : ''} possible{sum.possible > 1 ? 's' : ''} aujourd’hui</span></p>
                {sum.limiting.length > 0 && (
                  <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3 text-sm leading-relaxed text-[#78350f]">
                    Limité par <strong>{sum.limiting.join(' et ')}</strong>.
                    {sum.shortfalls.length > 0 && <>
                      {' '}Pour {target} gammes, il faut encore :
                      <ul className="my-1 list-disc pl-5">{sum.shortfalls.map((s) => <li key={s.name}><strong>{s.missing}</strong> {s.name}</li>)}</ul>
                    </>}
                    <Link to="/admin/fabrication" className="font-semibold underline">Aller à Fabrication</Link>
                  </div>
                )}
                <p className="text-sm text-[#52525b]">Le stock de la gamme n’existe pas à part : chaque gamme vendue retire ses produits. Il se recalcule tout seul.</p>
              </>
            )}
          </Card>
          <Card title="Aperçu dans la boutique">
            <div inert aria-hidden="true" className="rounded-2xl bg-ink p-3 text-ivory">
              <ProductCard product={{
                id: 0, slug: 'apercu', sku: '', name: name.trim() || 'Nom de la gamme', brand: { name: 'Dabo Hair', slug: '' },
                unit_size: chosen.length ? `${chosen.reduce((s, c) => s + c.quantity, 0)} soins` : null, price: priceN || 0, compare_at_price: null,
                stock_status: 'in_stock', stock_left: null, is_featured: false, is_bundle: true,
                category: { id: 0, name: 'Gammes', slug: '' }, image_url: photos[0]?.url ?? null,
              }} />
            </div>
            {memberN !== null && <p className="text-sm text-[#52525b]">Pour les membres connectées : <strong className="text-ink">{formatPrice(memberN)}</strong></p>}
            <p className="rounded-xl border border-[#f5d58a] bg-[#fff8e6] p-3 text-sm text-gold-text">
              « Publier la gamme » reste grisé tant qu’il manque une photo. En brouillon, la gamme est invisible sur le site. Une fois vendue, sa composition ne change plus : pour la modifier, créez une nouvelle gamme.
            </p>
          </Card>
        </aside>
      </div>
    </>
  )
}

function MarginBox({ label, margin }: { label: string; margin: { amount: number; rate: number; loss: boolean } | null }) {
  return (
    <div aria-live="polite" className={`flex flex-col justify-center gap-1 rounded-xl border p-3 text-sm ${margin?.loss ? 'border-[#fca5a5] bg-[#fef2f2]' : 'border-[#bbf7d0] bg-[#f0fdf4]'}`}>
      <span className="text-[#52525b]">{label}</span>
      <strong className={`text-lg ${margin?.loss ? 'text-[#b91c1c]' : 'text-[#166534]'}`}>
        {margin ? `${margin.loss ? '−' : ''}${formatPrice(Math.abs(margin.amount))} · ${margin.rate.toLocaleString('fr-FR')} %` : '—'}
      </strong>
    </div>
  )
}
