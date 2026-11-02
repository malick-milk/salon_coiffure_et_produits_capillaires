/**
 * FAUX SERVEUR — authentification, espace client, validation de commande.
 *
 * La « session » imite le cookie HttpOnly de Sanctum : elle est gardée dans le localStorage
 * du faux serveur (le vrai cookie ne sera JAMAIS lisible par le JavaScript de l'application).
 */
import { delay, http, HttpResponse } from 'msw'
import type { CheckoutRequest, CustomerBooking, LoginRequest, OrderDetail, OrderSummary, RegisterRequest, User } from '@/types/api'
import { db, deliveryZones, persistDb, products, users, type MockCustomerBooking, type MockOrder, type MockUser } from './db'
import { priceOrder } from './orders'

const API = '/api/v1'
const SESSION_KEY = 'msw-session-user-id'
const PHONE_SN = /^(\+221)?7[05678]\d{7}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ATTEMPTS = 5 // RG-SEC-02 : verrouillage temporaire après 5 échecs
const LOCK_MS = 60_000

export const currentUser = (): MockUser | undefined => {
  const id = Number(localStorage.getItem(SESSION_KEY))
  return users.find((u) => u.id === id)
}
// Le faux serveur n'a pas d'ERP : ses comptes n'ont aucune permission d'administration
const toUser = ({ password: _p, ...u }: MockUser): User => ({ ...u, permissions: [] })
const unauthenticated = () => HttpResponse.json({ message: 'Non authentifié.' }, { status: 401 })
const invalid = (errors: Record<string, string[]>) =>
  HttpResponse.json({ message: 'Certaines informations sont invalides.', errors }, { status: 422 })

/** Droits calculés au moment de la lecture (jamais stockés : ils dépendent de l'heure) */
const withCancel = (b: MockCustomerBooking): CustomerBooking => {
  const { user_id: _u, ...rest } = b
  const in24h = Date.parse(`${b.starts_at}Z`) - Date.now() > 24 * 3_600_000
  return { ...rest, can_cancel: (b.status === 'pending' || b.status === 'confirmed') && in24h }
}
const toDetail = ({ user_id: _u, ...o }: MockOrder): OrderDetail => ({ ...o, can_cancel: o.status === 'pending' })
const toSummary = (o: MockOrder): OrderSummary => {
  const { reference, status, payment_status, fulfillment_method, total, items_count, placed_at } = o
  return { reference, status, payment_status, fulfillment_method, total, items_count, placed_at }
}

export const accountHandlers = [
  // Étape préalable de Sanctum : le serveur dépose le cookie XSRF-TOKEN (protection CSRF)
  http.get('/sanctum/csrf-cookie', () => new HttpResponse(null, { status: 204 })),

  http.get(`${API}/auth/me`, async () => {
    await delay(150)
    const u = currentUser()
    return u ? HttpResponse.json({ data: toUser(u) }) : unauthenticated()
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as LoginRequest
    const email = (body.email ?? '').trim().toLowerCase()

    const lock = db.failedLogins.get(email)
    if (lock && lock.count >= MAX_ATTEMPTS && lock.until > Date.now()) {
      return HttpResponse.json({ message: 'Trop de tentatives. Réessayez dans une minute.' }, { status: 429 })
    }
    // Piège fréquent : le compte du personnel n'existe que dans Laravel. Message d'aide, en développement seulement
    if (email.endsWith('@dabohair.test')) {
      return invalid({ email: ['Le faux serveur (MSW) est actif et ne connaît pas les comptes du personnel. VITE_ENABLE_MOCKS=true est défini dans un fichier .env de frontend/ (ls -a pour voir les fichiers cachés) ou dans une variable d’environnement : mettez false, puis relancez npm run dev.'] })
    }
    const user = users.find((u) => u.email === email)
    if (!user || user.password !== body.password) {
      const count = (lock && lock.until > Date.now() ? lock.count : 0) + 1
      db.failedLogins.set(email, { count, until: Date.now() + LOCK_MS })
      persistDb()
      // Message volontairement VAGUE : ne pas révéler si l'email existe (anti-énumération des comptes)
      return invalid({ email: ['Ces identifiants ne correspondent à aucun compte.'] })
    }
    db.failedLogins.delete(email)
    persistDb()
    localStorage.setItem(SESSION_KEY, String(user.id))
    return HttpResponse.json({ data: toUser(user) })
  }),

  http.post(`${API}/auth/register`, async ({ request }) => {
    await delay(500)
    const b = (await request.json()) as RegisterRequest
    const errors: Record<string, string[]> = {}
    const email = (b.email ?? '').trim().toLowerCase()
    const phone = (b.phone ?? '').replace(/\s/g, '')
    if ((b.first_name ?? '').trim().length < 2) errors.first_name = ['Le prénom est obligatoire.']
    if ((b.last_name ?? '').trim().length < 2) errors.last_name = ['Le nom est obligatoire.']
    if (!EMAIL.test(email)) errors.email = ['Adresse email invalide.']
    else if (users.some((u) => u.email === email)) errors.email = ['Un compte existe déjà avec cette adresse.']
    if (!PHONE_SN.test(phone)) errors.phone = ['Numéro mobile invalide.']
    else if (users.some((u) => u.phone === phone)) errors.phone = ['Ce numéro est déjà utilisé.']
    if ((b.password ?? '').length < 8) errors.password = ['8 caractères minimum.']
    if (b.password !== b.password_confirmation) errors.password_confirmation = ['Les mots de passe ne correspondent pas.']
    if (!b.consent) errors.consent = ['Le consentement est obligatoire.']
    if (Object.keys(errors).length) return invalid(errors)

    const user: MockUser = { id: Math.max(...users.map((u) => u.id)) + 1, first_name: b.first_name.trim(), last_name: b.last_name.trim(), email, phone, password: b.password, roles: ['customer'] }
    users.push(user)
    persistDb()
    localStorage.setItem(SESSION_KEY, String(user.id))
    return HttpResponse.json({ data: toUser(user) }, { status: 201 })
  }),

  http.post(`${API}/auth/logout`, async () => {
    localStorage.removeItem(SESSION_KEY)
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(`${API}/me/profile`, async ({ request }) => {
    await delay(300)
    const u = currentUser()
    if (!u) return unauthenticated()
    const b = (await request.json()) as Pick<User, 'first_name' | 'last_name' | 'phone'>
    const phone = (b.phone ?? '').replace(/\s/g, '')
    const errors: Record<string, string[]> = {}
    if ((b.first_name ?? '').trim().length < 2) errors.first_name = ['Le prénom est obligatoire.']
    if ((b.last_name ?? '').trim().length < 2) errors.last_name = ['Le nom est obligatoire.']
    if (!PHONE_SN.test(phone)) errors.phone = ['Numéro mobile invalide.']
    if (Object.keys(errors).length) return invalid(errors)
    Object.assign(u, { first_name: b.first_name.trim(), last_name: b.last_name.trim(), phone })
    persistDb()
    return HttpResponse.json({ data: toUser(u) })
  }),

  http.get(`${API}/me/orders`, async () => {
    await delay(250)
    const u = currentUser()
    if (!u) return unauthenticated()
    // Seules les commandes DE CET utilisateur : le filtre est fait par le serveur, jamais par le navigateur
    const list = db.orders.filter((o) => o.user_id === u.id).sort((a, b) => b.placed_at.localeCompare(a.placed_at))
    return HttpResponse.json({ data: list.map(toSummary) })
  }),

  http.get(`${API}/me/orders/:reference`, async ({ params }) => {
    await delay(200)
    const u = currentUser()
    if (!u) return unauthenticated()
    const o = db.orders.find((x) => x.reference === params.reference)
    if (!o) return HttpResponse.json({ message: 'Commande introuvable.' }, { status: 404 })
    // Protection IDOR (OWASP A01) : connaître une référence ne suffit pas, il faut en être le propriétaire
    if (o.user_id !== u.id) return HttpResponse.json({ message: 'Accès refusé.' }, { status: 403 })
    return HttpResponse.json({ data: toDetail(o) })
  }),

  http.get(`${API}/me/bookings`, async () => {
    await delay(250)
    const u = currentUser()
    if (!u) return unauthenticated()
    const list = db.customerBookings.filter((b) => b.user_id === u.id).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    return HttpResponse.json({ data: list.map(withCancel) })
  }),

  http.post(`${API}/me/bookings/:reference/cancel`, async ({ params }) => {
    await delay(300)
    const u = currentUser()
    if (!u) return unauthenticated()
    const b = db.customerBookings.find((x) => x.reference === params.reference && x.user_id === u.id)
    if (!b) return HttpResponse.json({ message: 'Réservation introuvable.' }, { status: 404 })
    if (!withCancel(b).can_cancel) {
      return HttpResponse.json({ message: 'Annulation impossible à moins de 24 h du rendez-vous. Merci d’appeler le salon.' }, { status: 422 })
    }
    b.status = 'cancelled'
    // Libère aussi le créneau dans le planning (sinon il resterait bloqué)
    const [date, time] = b.starts_at.split('T') as [string, string]
    db.bookings = db.bookings.filter((x) => !(x.date === date && x.start === time.slice(0, 5)))
    persistDb()
    return HttpResponse.json({ data: withCancel(b) })
  }),

  http.get(`${API}/delivery-zones`, async () => HttpResponse.json({ data: deliveryZones })),

  http.post(`${API}/orders`, async ({ request }) => {
    await delay(600)
    const b = (await request.json()) as CheckoutRequest
    const u = currentUser() // null = commande invité (autorisée, ADR-011)

    const errors: Record<string, string[]> = {}
    if ((b.customer?.first_name ?? '').trim().length < 2) errors['customer.first_name'] = ['Le prénom est obligatoire.']
    if ((b.customer?.last_name ?? '').trim().length < 2) errors['customer.last_name'] = ['Le nom est obligatoire.']
    if (!PHONE_SN.test((b.customer?.phone ?? '').replace(/\s/g, ''))) errors['customer.phone'] = ['Numéro mobile invalide.']
    if (b.fulfillment_method === 'delivery' && !(b.shipping_address?.address_line ?? '').trim()) errors['shipping_address.address_line'] = ['L’adresse est obligatoire pour une livraison.']
    if (!b.consent) errors.consent = ['Le consentement est obligatoire.']
    if (Object.keys(errors).length) return invalid(errors)

    const zone = deliveryZones.find((z) => z.id === b.delivery_zone_id) ?? null
    const priced = priceOrder({ items: b.items ?? [], products, method: b.fulfillment_method, zone })
    if (!priced.ok) {
      return priced.status === 409
        ? HttpResponse.json(priced.conflict, { status: 409 })
        : HttpResponse.json({ message: priced.message }, { status: 422 })
    }

    // Équivalent de la TRANSACTION Laravel : décrément du stock et création de la commande ensemble
    for (const line of priced.lines) {
      const p = products.find((x) => x.id === line.product_id)!
      p.stock -= line.quantity
    }
    const order: MockOrder = {
      user_id: u?.id ?? null,
      reference: `CMD-2026-${String(db.nextOrderNumber++).padStart(6, '0')}`,
      status: 'pending',
      payment_status: 'unpaid',
      fulfillment_method: b.fulfillment_method,
      placed_at: new Date().toISOString().slice(0, 19),
      items: priced.lines.map(({ product_id: _id, ...l }) => l),
      items_count: priced.lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: priced.subtotal,
      discount_total: priced.discount_total,
      shipping_fee: priced.shipping_fee,
      total: priced.total,
      delivery_zone: b.fulfillment_method === 'delivery' ? (zone?.name ?? null) : null,
      shipping_address: b.fulfillment_method === 'delivery' ? b.shipping_address : null,
      invoice_available: false,
      can_cancel: true,
    }
    db.orders.push(order)
    persistDb()
    return HttpResponse.json({ data: toDetail(order) }, { status: 201 })
  }),
]
