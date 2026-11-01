/**
 * Données du faux serveur (MSW). Elles reprennent database/sample_data.sql (stocks APRÈS la
 * vente en gros n° 9 : la crème capillaire est en rupture) :
 * catalogue RÉEL Dabo Hair (noms, contenances, prix de vente), prestations et horaires de démo.
 * Ce fichier disparaîtra de l'usage quand l'API Laravel répondra (VITE_ENABLE_MOCKS=false).
 */
import type { BookingStatus, BusinessHour, Category, CustomerBooking, DeliveryZone, OrderDetail, ProductDetail, Service, Stylist } from '@/types/api'
import type { Closure, ExistingBooking } from './availability'

const dabo = { name: 'Dabo Hair', slug: 'dabo-hair' }
const cat = {
  shampoings: { id: 3, name: 'Shampoings', slug: 'shampoings' },
  hydratants: { id: 5, name: 'Hydratants et crèmes', slug: 'hydratants-et-cremes' },
  serums: { id: 6, name: 'Sérums', slug: 'serums' },
  traitants: { id: 7, name: 'Soins traitants', slug: 'soins-traitants' },
}

export const categories: Category[] = [
  { id: 1, name: 'Soins capillaires', slug: 'soins-capillaires', parent_id: null, product_count: 9 },
  { ...cat.serums, parent_id: 1, product_count: 3 },
  { ...cat.hydratants, parent_id: 1, product_count: 3 },
  { ...cat.traitants, parent_id: 1, product_count: 2 },
  { ...cat.shampoings, parent_id: 1, product_count: 1 },
]

/** Stock interne : jamais renvoyé tel quel au navigateur (seulement un statut) */
export interface MockProduct extends Omit<ProductDetail, 'stock_status' | 'stock_left' | 'variants'> {
  stock: number
  low_stock_threshold: number
  variant_of: string | null // slug du produit principal
  created_at: string
}

const base = {
  brand: dabo,
  compare_at_price: null,
  image_url: null,
  images: [],
  hair_types: [],
  short_description: null,
  description: null, // [DESCRIPTION À FOURNIR PAR L'ENTREPRISE]
  created_at: '2026-03-20',
}

export const products: MockProduct[] = [
  { ...base, id: 10, slug: 'serum-activ-pousse-30-ml', sku: 'DAB-SAP-030', name: 'Sérum Activ’Pousse', unit_size: '30 ml', price: 3000, stock: 24, low_stock_threshold: 12, is_featured: true, category: cat.serums, variant_of: null },
  { ...base, id: 11, slug: 'serum-activ-pousse-15-ml', sku: 'DAB-SAP-015', name: 'Sérum Activ’Pousse', unit_size: '15 ml', price: 1500, stock: 24, low_stock_threshold: 6, is_featured: false, category: cat.serums, variant_of: 'serum-activ-pousse-30-ml' },
  { ...base, id: 14, slug: 'serum-booster-30-ml', sku: 'DAB-SBO-030', name: 'Sérum Booster', unit_size: '30 ml', price: 3000, stock: 60, low_stock_threshold: 6, is_featured: false, category: cat.serums, variant_of: null },
  { ...base, id: 7, slug: 'spray-hydratant-250-ml', sku: 'DAB-SPH-250', name: 'Spray hydratant', unit_size: '250 ml', price: 5000, stock: 48, low_stock_threshold: 12, is_featured: true, category: cat.hydratants, variant_of: null },
  { ...base, id: 8, slug: 'hydratant-100-ml', sku: 'DAB-HYD-100', name: 'Hydratant', unit_size: '100 ml', price: 2500, stock: 24, low_stock_threshold: 12, is_featured: false, category: cat.hydratants, variant_of: null },
  { ...base, id: 9, slug: 'creme-capillaire', sku: 'DAB-CRE-001', name: 'Crème capillaire', unit_size: null, price: 3000, stock: 0, low_stock_threshold: 12, is_featured: true, category: cat.hydratants, variant_of: null },
  { ...base, id: 12, slug: 'spray-anti-chute', sku: 'DAB-SAC-001', name: 'Spray anti-chute', unit_size: null, price: 5000, stock: 72, low_stock_threshold: 6, is_featured: false, category: cat.traitants, variant_of: null },
  { ...base, id: 13, slug: 'masque-capillaire', sku: 'DAB-MAS-001', name: 'Masque capillaire', unit_size: null, price: 3000, stock: 24, low_stock_threshold: 6, is_featured: false, category: cat.traitants, variant_of: null },
  { ...base, id: 6, slug: 'shampooing-sans-sulfate', sku: 'DAB-SHA-001', name: 'Shampooing sans sulfate', unit_size: null, price: 3000, stock: 48, low_stock_threshold: 12, is_featured: true, category: cat.shampoings, variant_of: null },
]

export const services: (Service & { buffer_minutes: number })[] = [
  { id: 1, slug: 'tresses-africaines', name: 'Tresses africaines', category: 'Tresses', description: null, duration_minutes: 180, buffer_minutes: 15, price: 25000 },
  { id: 2, slug: 'nattes-collees', name: 'Nattes collées', category: 'Tresses', description: null, duration_minutes: 90, buffer_minutes: 15, price: 12000 },
  { id: 3, slug: 'soin-profond-karite', name: 'Soin profond au karité', category: 'Soins', description: null, duration_minutes: 60, buffer_minutes: 10, price: 8000 },
]

// Bineta ne réalise pas les nattes collées (table service_stylist)
export const stylists: Stylist[] = [
  { id: 1, display_name: 'Fatou', service_ids: [1, 2, 3] },
  { id: 2, display_name: 'Bineta', service_ids: [1, 3] },
]

export const businessHours: BusinessHour[] = [
  { day_of_week: 1, is_closed: false, opens_at: '09:00', closes_at: '19:00', break_start: '13:00', break_end: '14:00' },
  { day_of_week: 2, is_closed: false, opens_at: '09:00', closes_at: '19:00', break_start: '13:00', break_end: '14:00' },
  { day_of_week: 3, is_closed: false, opens_at: '09:00', closes_at: '19:00', break_start: '13:00', break_end: '14:00' },
  { day_of_week: 4, is_closed: false, opens_at: '09:00', closes_at: '19:00', break_start: '13:00', break_end: '14:00' },
  { day_of_week: 5, is_closed: false, opens_at: '09:00', closes_at: '19:00', break_start: '13:00', break_end: '15:00' },
  { day_of_week: 6, is_closed: false, opens_at: '09:00', closes_at: '20:00', break_start: null, break_end: null },
  { day_of_week: 7, is_closed: true, opens_at: null, closes_at: null, break_start: null, break_end: null },
]

export const closures: Closure[] = [
  { startsOn: '2026-12-25', endsOn: '2026-12-25', reason: 'Fermé : Noël' },
  { startsOn: '2027-01-01', endsOn: '2027-01-01', reason: 'Fermé : Jour de l’an' },
]

export const bookingSettings = { minNoticeMinutes: 120, maxHorizonDays: 60 }

/** Réservations existantes de démonstration, générées autour de la date du jour */
function seedBookings(): ExistingBooking[] {
  const list: ExistingBooking[] = []
  const today = new Date()
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i))
    const date = d.toISOString().slice(0, 10)
    const wd = d.getUTCDay() // 0 = dimanche, 6 = samedi
    if (wd === 6) {
      list.push({ stylistId: 1, date, start: '10:00', end: '13:15' }) // samedi matin chargé
      list.push({ stylistId: 2, date, start: '09:00', end: '12:15' })
    } else if (wd === 2 || wd === 4) {
      list.push({ stylistId: 1, date, start: '15:00', end: '16:45' })
    }
  }
  return list
}

export const deliveryZones: DeliveryZone[] = [
  { id: 1, name: 'Dakar Plateau', fee: 1000 },
  { id: 2, name: 'Parcelles Assainies', fee: 1500 },
  { id: 3, name: 'Rufisque', fee: 2500 },
]

/**
 * Comptes de démonstration. ATTENTION : faux serveur uniquement.
 * Dans Laravel, le mot de passe n'est JAMAIS stocké : seul son HACHAGE bcrypt l'est (Hash::make),
 * et la comparaison se fait avec Hash::check. Ici, la comparaison en clair sert seulement à la démo.
 */
export interface MockUser {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  password: string
  roles: string[]
}

export const users: MockUser[] = [
  { id: 3, first_name: 'Mariama', last_name: 'Sow', email: 'mariama@client.test', phone: '770000003', password: 'demo-dabo-2026', roles: ['customer'] },
]

export interface MockOrder extends OrderDetail {
  user_id: number | null
}

export interface MockCustomerBooking extends CustomerBooking {
  user_id: number
}

/** Date relative à aujourd'hui (pour que la démo reste cohérente quel que soit le jour) */
const relDay = (days: number, time: string) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.toISOString().slice(0, 10)}T${time}:00`
}

const order = (o: Omit<MockOrder, 'items_count' | 'total'>): MockOrder => ({
  ...o,
  items_count: o.items.reduce((n, l) => n + l.quantity, 0),
  total: o.subtotal - o.discount_total + o.shipping_fee,
})

function seedOrders(): MockOrder[] {
  return [
    order({
      user_id: 3, reference: 'CMD-2026-000102', status: 'confirmed', payment_status: 'unpaid', fulfillment_method: 'pickup',
      placed_at: relDay(-2, '18:20'), subtotal: 6000, discount_total: 0, shipping_fee: 0, delivery_zone: null, shipping_address: null,
      items: [{ product_slug: 'creme-capillaire', product_name: 'Crème capillaire', unit_price: 3000, quantity: 2, line_total: 6000 }],
      invoice_available: false, can_cancel: false,
    }),
    order({
      user_id: 3, reference: 'CMD-2026-000101', status: 'delivered', payment_status: 'paid', fulfillment_method: 'delivery',
      placed_at: relDay(-25, '10:15'), subtotal: 11000, discount_total: 0, shipping_fee: 1000, delivery_zone: 'Dakar Plateau',
      shipping_address: { city: 'Dakar', district: 'Plateau', address_line: 'Rue 10', landmark: 'Près de la pharmacie' },
      items: [
        { product_slug: 'serum-activ-pousse-30-ml', product_name: 'Sérum Activ’Pousse 30 ml', unit_price: 3000, quantity: 2, line_total: 6000 },
        { product_slug: 'spray-hydratant-250-ml', product_name: 'Spray hydratant 250 ml', unit_price: 5000, quantity: 1, line_total: 5000 },
      ],
      invoice_available: true, can_cancel: false,
    }),
  ]
}

function seedCustomerBookings(): MockCustomerBooking[] {
  const b = (reference: string, status: BookingStatus, service_name: string, days: number, time: string, duration_minutes: number, price: number): MockCustomerBooking =>
    ({ user_id: 3, reference, status, service_name, stylist_name: 'Fatou', starts_at: relDay(days, time), duration_minutes, price, can_cancel: false })
  return [
    b('RDV-2026-000201', 'confirmed', 'Tresses africaines', 10, '10:00', 180, 25000),
    b('RDV-2026-000105', 'completed', 'Soin profond au karité', -30, '16:00', 60, 8000),
  ]
}

export const db = {
  bookings: seedBookings(),
  nextBookingNumber: 11,
  orders: seedOrders(),
  customerBookings: seedCustomerBookings(),
  nextOrderNumber: 10, // CMD-2026-000009 existe déjà en base (vente en gros)
  failedLogins: new Map<string, { count: number; until: number }>(),
}

/**
 * PERSISTANCE du faux serveur. Sans elle, recharger la page remettrait le stock et les
 * commandes à zéro (MSW vit dans la mémoire de la page), ce que ne fait jamais un vrai serveur.
 * Pour repartir de zéro : vider le localStorage du site (outils de développement du navigateur).
 */
const DB_KEY = 'msw-db-v1'

export function persistDb() {
  localStorage.setItem(DB_KEY, JSON.stringify({
    ...db,
    failedLogins: [...db.failedLogins],
    stocks: products.map((p) => [p.id, p.stock]),
    users,
  }))
}

function restoreDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    Object.assign(db, { ...saved, failedLogins: new Map(saved.failedLogins) })
    for (const [id, stock] of saved.stocks as [number, number][]) {
      const p = products.find((x) => x.id === id)
      if (p) p.stock = stock
    }
    users.splice(0, users.length, ...(saved.users as MockUser[]))
  } catch {
    localStorage.removeItem(DB_KEY) // données corrompues : on repart des données initiales
  }
}
restoreDb()
