/**
 * NOUVEAU PRODUIT (maquette validée le 16 novembre 2026).
 * 1. Origine : fabriqué par Dabo Hair (stock par la Fabrication) ou acheté et revendu (stock par une Réception d'achat).
 * 2. Fiche. 3. Photos (1 à 4, la première est la principale). À droite : l'aperçu RÉEL de la carte de la boutique.
 * « Enregistrer en brouillon » : invisible sur le site. « Publier » : exige au moins une photo.
 */
import { ImagePlus, Star, X } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { formatPrice } from '@/lib/format'
import { resizeImage } from '@/lib/resizeImage'
import { cn } from '@/lib/utils'
import type { ProductOrigin } from '@/types/admin'
import { useAdminCategories, useBrands, useCreateBrand, useCreateProduct, useUpdateProduct, useUploadProductImage } from '../api'
import { AdminField, AdminInput, AdminSelect, AdminTextarea, Card, Feedback, PageHeader } from '../components/ui'
import { productMargin } from '../purchaseMath'
import { firstError } from './OrdersPages'

const MAX_PHOTOS = 4
const NEW_BRAND = 'new'

interface LocalPhoto {
  file: File
  url: string // aperçu local (URL.createObjectURL), libéré quand la photo est retirée
}

export function NewProductPage() {
  const navigate = useNavigate()
  const brands = useBrands()
  const categories = useAdminCategories()
  const createBrand = useCreateBrand()
  const createProduct = useCreateProduct()
  const uploadImage = useUploadProductImage()
  const updateProduct = useUpdateProduct()

  const [origin, setOrigin] = useState<ProductOrigin>('made')
  const [name, setName] = useState('')
  const [brandId, setBrandId] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unitSize, setUnitSize] = useState('')
  const [price, setPrice] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [threshold, setThreshold] = useState('6')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null)

  // La marque maison est proposée d'office pour un produit fabriqué
  useEffect(() => {
    if (!brandId && brands.data) {
      const house = brands.data.find((b) => b.is_house_brand)
      if (house && origin === 'made') setBrandId(String(house.id))
    }
  }, [brands.data, brandId, origin])

  // Libérer les aperçus locaux en quittant la page
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const brand = brands.data?.find((b) => String(b.id) === brandId)
  const category = categories.data?.find((c) => String(c.id) === categoryId)
  const ready = name.trim().length >= 2 && Boolean(brand) && Boolean(category) && price !== '' && Number(price) >= 0
    && purchasePrice !== '' && Number(purchasePrice) >= 0
  // Marge par unité, en direct (même calcul que le serveur : (prix de vente − coût) ÷ prix de vente)
  const margin = price !== '' && purchasePrice !== '' ? productMargin(Number(price), Number(purchasePrice)) : null
  const canPublish = ready && photos.length > 0

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const room = MAX_PHOTOS - photos.length
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room)
    setPhotos((prev) => [...prev, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))])
    if (files.length > room) setError(`4 photos au plus : ${files.length - room} photo(s) ignorée(s).`)
  }
  const removePhoto = (index: number) => setPhotos((prev) => {
    URL.revokeObjectURL(prev[index]!.url)
    return prev.filter((_, i) => i !== index)
  })
  const makeFirst = (index: number) => setPhotos((prev) => [prev[index]!, ...prev.filter((_, i) => i !== index)])

  const addBrand = () => {
    setError(null)
    createBrand.mutate({ name: newBrand.trim() }, {
      onSuccess: (b) => { setBrandId(String(b.id)); setNewBrand('') },
      onError: (e) => setError(firstError(e)),
    })
  }

  const save = async (publish: boolean) => {
    if (!brand || !category) return
    setError(null)
    setSaving(publish ? 'publish' : 'draft')
    let createdId: number | null = null
    try {
      const product = await createProduct.mutateAsync({
        origin, name: name.trim(), brand_id: brand.id, category_id: category.id, unit_size: unitSize.trim() || null,
        price: Number(price), purchase_price: Number(purchasePrice), low_stock_threshold: Number(threshold || 0),
        short_description: shortDescription.trim() || null, description: description.trim() || null,
      })
      createdId = product.id
      // Les photos partent une par une, dans l'ordre : la première devient la photo principale
      for (const photo of photos) {
        await uploadImage.mutateAsync({ productId: product.id, image: await resizeImage(photo.file) })
      }
      if (publish) await updateProduct.mutateAsync({ id: product.id, is_active: true })
      navigate('/admin/produits', { state: { created: [product.name, product.unit_size].filter(Boolean).join(' '), published: publish } })
    } catch (e) {
      const message = e instanceof Error && !('isAxiosError' in e) ? e.message : firstError(e)
      // Produit déjà créé mais une photo refusée : il reste en brouillon, on le dit clairement
      setError(createdId ? `Le produit est enregistré en brouillon, mais : ${message} Ajoutez la photo depuis « Produits et stock » → Photos.` : message)
    } finally {
      setSaving(null)
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); void save(false) }

  return (
    <>
      <Seo title="ERP — Nouveau produit" />
      <nav aria-label="Fil d'Ariane" className="text-sm text-[#52525b]"><Link to="/admin/produits" className="underline">Produits et stock</Link> / Nouveau produit</nav>
      <PageHeader
        title="Nouveau produit"
        actions={<>
          <Button type="submit" form="new-product" variant="subtle" disabled={!ready || saving !== null}>{saving === 'draft' ? 'Enregistrement…' : 'Enregistrer en brouillon'}</Button>
          <Button type="button" variant="dark" disabled={!canPublish || saving !== null} onClick={() => void save(true)}>{saving === 'publish' ? 'Publication…' : 'Publier'}</Button>
        </>}
      />
      {error && <Feedback kind="error">{error}</Feedback>}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <form id="new-product" onSubmit={submit} className="flex min-w-0 flex-col gap-5">
          <Card title="1. Origine du produit">
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Origine du produit</legend>
              <OriginChoice value="made" current={origin} onChange={setOrigin} title="Fabriqué par Dabo Hair" text="Le stock entre par « Fabrication » (lot, coûts de production)" />
              <OriginChoice value="resold" current={origin} onChange={setOrigin} title="Acheté et revendu" text="Le stock entre par « Réceptions d’achat » (fournisseur, prix d’achat)" />
            </fieldset>
          </Card>

          <Card title="2. Fiche">
            <AdminField label="Nom du produit" htmlFor="np-name"><AdminInput id="np-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="Ex. Huile de croissance" /></AdminField>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <AdminField label="Marque" htmlFor="np-brand">
                  <AdminSelect id="np-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)} required>
                    <option value="">Choisir…</option>
                    {brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    <option value={NEW_BRAND}>+ Nouvelle marque…</option>
                  </AdminSelect>
                </AdminField>
                {brandId === NEW_BRAND && (
                  <div className="flex gap-2">
                    <label htmlFor="np-new-brand" className="sr-only">Nom de la nouvelle marque</label>
                    <AdminInput id="np-new-brand" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Ex. Virgin Hair Fertilizer" maxLength={80} />
                    <Button type="button" variant="dark" size="sm" disabled={newBrand.trim().length < 2 || createBrand.isPending} onClick={addBrand}>Ajouter</Button>
                  </div>
                )}
              </div>
              <AdminField label="Catégorie" htmlFor="np-category">
                <AdminSelect id="np-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  <option value="">Choisir…</option>
                  {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </AdminSelect>
              </AdminField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Contenance" htmlFor="np-size"><AdminInput id="np-size" value={unitSize} onChange={(e) => setUnitSize(e.target.value)} maxLength={50} placeholder="Ex. 120 ml" /></AdminField>
              <AdminField label="Seuil d’alerte de stock" htmlFor="np-threshold"><AdminInput id="np-threshold" type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} /></AdminField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <AdminField label="Prix d’achat unitaire (F) · obligatoire" htmlFor="np-purchase">
                  <AdminInput id="np-purchase" type="number" min={0} step={50} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required aria-describedby="np-purchase-aide" />
                </AdminField>
                <p id="np-purchase-aide" className="text-xs text-[#52525b]">{origin === 'resold' ? 'Prix payé au fournisseur pour une unité' : 'Coût estimé d’une unité (ingrédients, flacon, étiquette)'}</p>
              </div>
              <AdminField label="Prix de vente (F CFA)" htmlFor="np-price"><AdminInput id="np-price" type="number" min={0} step={100} value={price} onChange={(e) => setPrice(e.target.value)} required /></AdminField>
            </div>
            {margin && (
              <p aria-live="polite" className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3.5 text-[15px] ${margin.loss ? 'border-[#fca5a5] bg-[#fef2f2] text-[#b91c1c]' : 'border-[#86efac] bg-[#f0fdf4] text-[#14532d]'}`}>
                {margin.loss
                  ? <><span>Attention : vendu à perte</span><strong>{formatPrice(-margin.amount)} de perte par unité</strong></>
                  : <><span>Marge par unité</span><strong>{formatPrice(margin.amount)} · {margin.rate.toLocaleString('fr-FR')} % du prix de vente</strong></>}
              </p>
            )}
            <AdminField label={`Description courte (sur la carte, ${shortDescription.length}/160)`} htmlFor="np-short">
              <AdminInput id="np-short" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} maxLength={160} placeholder="À quoi sert le produit, en une phrase" />
            </AdminField>
            <AdminField label="Description complète" htmlFor="np-desc">
              <AdminTextarea id="np-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} placeholder="Utilisation, ingrédients, pour quels cheveux" />
            </AdminField>
          </Card>

          <Card title="3. Photos">
            <PhotoPicker photos={photos} onAdd={addPhotos} onRemove={removePhoto} onMakeFirst={makeFirst} />
          </Card>
        </form>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card title="Aperçu dans la boutique">
            {/* La VRAIE carte de la boutique. « inert » : ses boutons ne réagissent pas (rien ne part au panier).
                aria-hidden : simple copie visuelle du formulaire, les lecteurs d'écran ne la lisent pas deux fois. */}
            <div inert aria-hidden="true" className="rounded-2xl bg-ink p-3 text-ivory">
              <ProductCard product={{
                id: 0, slug: 'apercu', sku: '', name: name.trim() || 'Nom du produit', brand: brand ? { name: brand.name, slug: '' } : null,
                unit_size: unitSize.trim() || null, price: Number(price) || 0, compare_at_price: null,
                stock_status: 'in_stock', stock_left: null, is_featured: false, // aspect une fois le stock reçu
                category: { id: category?.id ?? 0, name: category?.name ?? '', slug: '' }, image_url: photos[0]?.url ?? null,
              }} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-[#52525b]">Référence</dt><dd className="text-right">créée à l’enregistrement</dd>
              <dt className="text-[#52525b]">Stock</dt><dd className="text-right">0 · {origin === 'resold' ? 'à recevoir par un achat' : 'à saisir par la Fabrication'}</dd>
              <dt className="text-[#52525b]">Marge estimée</dt>
              <dd className={`text-right ${margin?.loss ? 'text-[#b91c1c]' : 'text-[#14532d]'}`}>{margin ? `${formatPrice(margin.amount)} par unité (${margin.rate.toLocaleString('fr-FR')} %)` : '—'}</dd>
            </dl>
            <p className="rounded-xl border border-[#f5d58a] bg-[#fff8e6] p-3 text-sm text-gold-text">
              « Publier » reste grisé tant qu’il manque une photo. En brouillon, le produit est invisible sur le site.
            </p>
          </Card>
        </aside>
      </div>
    </>
  )
}

function OriginChoice({ value, current, onChange, title, text }: { value: ProductOrigin; current: ProductOrigin; onChange: (v: ProductOrigin) => void; title: string; text: string }) {
  const id = useId()
  const checked = value === current
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer gap-3 rounded-xl border p-4', checked ? 'border-2 border-gold bg-[#fffbeb]' : 'border-[#d4d4d8]')}>
      <input id={id} type="radio" name="origin" value={value} checked={checked} onChange={() => onChange(value)} className="mt-1 size-[18px] accent-ink" />
      <span className="flex flex-col gap-1"><strong className="text-[15px] text-ink">{title}</strong><span className="text-sm text-[#52525b]">{text}</span></span>
    </label>
  )
}

/** Choix des photos AVANT l'enregistrement : aperçu local, la première est la principale */
function PhotoPicker({ photos, onAdd, onRemove, onMakeFirst }: { photos: LocalPhoto[]; onAdd: (f: FileList | null) => void; onRemove: (i: number) => void; onMakeFirst: (i: number) => void }) {
  const [over, setOver] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[#52525b]">1 à 4 photos · la première est la photo principale. JPG, PNG ou WebP : elles sont réduites avant l’envoi, puis recadrées en carré.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((p, i) => (
          <figure key={p.url} className="relative overflow-hidden rounded-xl border border-[#e4e4e7]">
            <img src={p.url} alt={`Choix ${i + 1} : ${p.file.name}`} className="aspect-square w-full object-cover" />
            {i === 0 && <span className="absolute bottom-2 left-2 rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-gold">Principale</span>}
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              {i > 0 && <button type="button" onClick={() => onMakeFirst(i)} aria-label={`Faire de la photo ${i + 1} la photo principale`} className="grid size-9 place-items-center rounded-full bg-white/90 text-ink"><Star className="size-4" aria-hidden="true" /></button>}
              <button type="button" onClick={() => onRemove(i)} aria-label={`Retirer la photo ${i + 1}`} className="grid size-9 place-items-center rounded-full bg-white/90 text-[#b91c1c]"><X className="size-4" aria-hidden="true" /></button>
            </div>
          </figure>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); onAdd(e.dataTransfer.files) }}
            className={cn('flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-center text-sm font-medium text-gold-text', over ? 'border-gold bg-[#fffbeb]' : 'border-[#a1a1aa]')}
          >
            <ImagePlus className="size-6" aria-hidden="true" />
            Ajouter ou glisser des photos
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { onAdd(e.target.files); e.target.value = '' }} />
          </label>
        )}
      </div>
    </div>
  )
}
