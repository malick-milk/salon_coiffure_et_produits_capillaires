/**
 * FAUX SERVEUR (Mock Service Worker).
 *
 * MSW intercepte les requêtes réseau du navigateur (fetch / axios) et répond à la place
 * de Laravel. Le code React appelle donc les VRAIES URLs (/api/v1/products) : le jour où
 * l'API existe, on désactive MSW et rien d'autre ne change.
 *
 * Ce faux serveur applique aussi les règles « serveur » : validation, recalcul des
 * disponibilités, conflit si le créneau vient d'être pris. Le frontend apprend ainsi
 * à gérer les vraies réponses d'erreur (422, 409) dès maintenant.
 */
import { delay, http, HttpResponse } from 'msw'
import type { BookingConfirmation, BookingRequest, ProductDetail, ProductSummary, StockStatus } from '@/types/api'
import { computeDayAvailability, toHHMM, toMinutes } from './availability'
import { bookingSettings, businessHours, categories, closures, db, persistDb, products, services, stylists, type MockProduct } from './db'
import { currentUser } from './handlers-account'

const API = '/api/v1'
const PER_PAGE = 12

/** Le stock exact reste côté serveur : on n'expose qu'un statut (comme le fera l'API Resource) */
function stockStatus(p: MockProduct): { stock_status: StockStatus; stock_left: number | null } {
  if (p.stock === 0) return { stock_status: 'out_of_stock', stock_left: null }
  if (p.stock <= p.low_stock_threshold) return { stock_status: 'low_stock', stock_left: p.stock }
  return { stock_status: 'in_stock', stock_left: null }
}

function toSummary(p: MockProduct): ProductSummary {
  const { id, slug, sku, name, brand, unit_size, price, compare_at_price, is_featured, category, image_url } = p
  return { id, slug, sku, name, brand, unit_size, price, compare_at_price, is_featured, category, image_url, ...stockStatus(p) }
}

/** Recherche insensible aux accents et à la casse : "serum" trouve "Sérum" */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function categoryAndChildren(slug: string): number[] {
  const root = categories.find((c) => c.slug === slug)
  if (!root) return []
  return [root.id, ...categories.filter((c) => c.parent_id === root.id).map((c) => c.id)]
}

const PHONE_SN = /^(\+221)?7[05678]\d{7}$/

export const handlers = [
  http.get(`${API}/categories`, async () => {
    await delay(150)
    return HttpResponse.json({ data: categories })
  }),

  http.get(`${API}/products`, async ({ request }) => {
    await delay(300) // simule le réseau : permet de voir les états de chargement
    const q = new URL(request.url).searchParams
    let list = [...products]

    const category = q.get('category')
    if (category) {
      const ids = categoryAndChildren(category)
      list = list.filter((p) => ids.includes(p.category.id))
    }
    const search = q.get('search')
    if (search) list = list.filter((p) => normalize(`${p.name} ${p.unit_size ?? ''}`).includes(normalize(search)))
    if (q.get('featured') === '1') list = list.filter((p) => p.is_featured)
    if (q.get('in_stock') === '1') list = list.filter((p) => p.stock > 0)
    const min = Number(q.get('min_price') ?? NaN)
    const max = Number(q.get('max_price') ?? NaN)
    if (!Number.isNaN(min)) list = list.filter((p) => p.price >= min)
    if (!Number.isNaN(max)) list = list.filter((p) => p.price <= max)

    const sort = q.get('sort') ?? 'newest'
    list.sort((a, b) =>
      sort === 'price_asc' ? a.price - b.price
      : sort === 'price_desc' ? b.price - a.price
      : sort === 'name' ? a.name.localeCompare(b.name, 'fr')
      : b.created_at.localeCompare(a.created_at) || a.id - b.id,
    )

    const page = Math.max(1, Number(q.get('page') ?? 1))
    const total = list.length
    return HttpResponse.json({
      data: list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(toSummary),
      meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / PER_PAGE)), per_page: PER_PAGE, total },
    })
  }),

  http.get(`${API}/products/:slug`, async ({ params }) => {
    await delay(250)
    const p = products.find((x) => x.slug === params.slug)
    if (!p) return HttpResponse.json({ message: 'Produit introuvable.' }, { status: 404 })

    // Les variantes = le produit principal + toutes ses autres contenances
    const rootSlug = p.variant_of ?? p.slug
    const family = products.filter((x) => x.slug === rootSlug || x.variant_of === rootSlug)
    const detail: ProductDetail = {
      ...toSummary(p),
      short_description: p.short_description,
      description: p.description,
      hair_types: p.hair_types,
      images: p.images,
      variants:
        family.length > 1
          ? family
              .map((x) => ({ slug: x.slug, unit_size: x.unit_size, price: x.price, stock_status: stockStatus(x).stock_status, is_current: x.slug === p.slug }))
              .sort((a, b) => b.price - a.price)
          : [],
    }
    return HttpResponse.json({ data: detail })
  }),

  http.get(`${API}/services`, async () => {
    await delay(150)
    return HttpResponse.json({ data: services.map(({ buffer_minutes: _b, ...s }) => s) })
  }),

  http.get(`${API}/stylists`, async ({ request }) => {
    await delay(150)
    const serviceId = Number(new URL(request.url).searchParams.get('service_id'))
    return HttpResponse.json({ data: serviceId ? stylists.filter((s) => s.service_ids.includes(serviceId)) : stylists })
  }),

  http.get(`${API}/business-hours`, async () => HttpResponse.json({ data: businessHours })),

  http.get(`${API}/availability`, async ({ request }) => {
    await delay(250)
    const q = new URL(request.url).searchParams
    const service = services.find((s) => s.id === Number(q.get('service_id')))
    const date = q.get('date') ?? ''
    if (!service || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return HttpResponse.json({ message: 'Paramètres invalides.' }, { status: 422 })
    }
    const stylistId = q.get('stylist_id') ? Number(q.get('stylist_id')) : null
    const result = computeDayAvailability({
      date,
      durationMinutes: service.duration_minutes,
      bufferMinutes: service.buffer_minutes,
      stylistIds: stylistId ? [stylistId] : stylists.filter((s) => s.service_ids.includes(service.id)).map((s) => s.id),
      hours: businessHours,
      closures,
      bookings: db.bookings,
      now: new Date(),
      ...bookingSettings,
    })
    // On ne divulgue pas quels coiffeurs sont libres : seulement disponible / indisponible
    return HttpResponse.json({ data: { ...result, slots: result.slots.map(({ time, available }) => ({ time, available })) } })
  }),

  http.post(`${API}/bookings`, async ({ request }) => {
    await delay(500)
    const body = (await request.json()) as BookingRequest

    // Validation serveur (l'équivalent d'une FormRequest Laravel) : on ne fait jamais confiance au navigateur
    const errors: Record<string, string[]> = {}
    if (!body.customer?.first_name?.trim()) errors['customer.first_name'] = ['Le prénom est obligatoire.']
    if (!body.customer?.last_name?.trim()) errors['customer.last_name'] = ['Le nom est obligatoire.']
    if (!PHONE_SN.test((body.customer?.phone ?? '').replace(/\s/g, ''))) errors['customer.phone'] = ['Numéro de téléphone sénégalais invalide.']
    if (!body.consent) errors.consent = ['Le consentement est obligatoire.']
    const service = services.find((s) => s.id === body.service_id)
    if (!service) errors.service_id = ['Prestation inconnue.']
    if (Object.keys(errors).length || !service) {
      return HttpResponse.json({ message: 'Certaines informations sont invalides.', errors }, { status: 422 })
    }

    // Revérification de la disponibilité au moment de l'envoi (RG-RES-02 : le créneau a pu être pris entre-temps)
    const allowed = stylists.filter((s) => s.service_ids.includes(service.id)).map((s) => s.id)
    const result = computeDayAvailability({
      date: body.date,
      durationMinutes: service.duration_minutes,
      bufferMinutes: service.buffer_minutes,
      stylistIds: body.stylist_id ? allowed.filter((id) => id === body.stylist_id) : allowed,
      hours: businessHours,
      closures,
      bookings: db.bookings,
      now: new Date(),
      ...bookingSettings,
    })
    const slot = result.slots.find((s) => s.time === body.time)
    const stylistId = slot?.freeStylistIds[0]
    if (!slot?.available || !stylistId) {
      return HttpResponse.json({ message: 'Ce créneau vient d’être réservé. Merci d’en choisir un autre.' }, { status: 409 })
    }

    const endMinutes = toMinutes(body.time) + service.duration_minutes
    db.bookings.push({ stylistId, date: body.date, start: body.time, end: toHHMM(endMinutes + service.buffer_minutes) })
    const confirmation: BookingConfirmation = {
      reference: `RDV-2026-${String(db.nextBookingNumber++).padStart(6, '0')}`,
      status: 'pending',
      service_name: service.name,
      stylist_name: stylists.find((s) => s.id === stylistId)?.display_name ?? '',
      starts_at: `${body.date}T${body.time}:00`,
      ends_at: `${body.date}T${toHHMM(endMinutes)}:00`,
      price: service.price,
    }
    const user = currentUser()
    if (user) {
      db.customerBookings.push({
        user_id: user.id, reference: confirmation.reference, status: 'pending', service_name: service.name,
        stylist_name: confirmation.stylist_name, starts_at: confirmation.starts_at, duration_minutes: service.duration_minutes,
        price: service.price, can_cancel: true,
      })
    }
    persistDb()
    return HttpResponse.json({ data: confirmation }, { status: 201 })
  }),
]
