/**
 * Données du faux serveur (MSW). Elles reprennent database/sample_data.sql :
 * catalogue RÉEL Dabo Hair (noms, contenances, prix de vente), prestations et horaires de démo.
 * Ce fichier disparaîtra de l'usage quand l'API Laravel répondra (VITE_ENABLE_MOCKS=false).
 */
import type { BusinessHour, Category, ProductDetail, Service, Stylist } from '@/types/api'
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
  { ...base, id: 14, slug: 'serum-booster-30-ml', sku: 'DAB-SBO-030', name: 'Sérum Booster', unit_size: '30 ml', price: 3000, stock: 24, low_stock_threshold: 6, is_featured: false, category: cat.serums, variant_of: null },
  { ...base, id: 7, slug: 'spray-hydratant-250-ml', sku: 'DAB-SPH-250', name: 'Spray hydratant', unit_size: '250 ml', price: 5000, stock: 24, low_stock_threshold: 12, is_featured: true, category: cat.hydratants, variant_of: null },
  { ...base, id: 8, slug: 'hydratant-100-ml', sku: 'DAB-HYD-100', name: 'Hydratant', unit_size: '100 ml', price: 2500, stock: 24, low_stock_threshold: 12, is_featured: false, category: cat.hydratants, variant_of: null },
  { ...base, id: 9, slug: 'creme-capillaire', sku: 'DAB-CRE-001', name: 'Crème capillaire', unit_size: null, price: 3000, stock: 24, low_stock_threshold: 12, is_featured: true, category: cat.hydratants, variant_of: null },
  { ...base, id: 12, slug: 'spray-anti-chute', sku: 'DAB-SAC-001', name: 'Spray anti-chute', unit_size: null, price: 5000, stock: 24, low_stock_threshold: 6, is_featured: false, category: cat.traitants, variant_of: null },
  { ...base, id: 13, slug: 'masque-capillaire', sku: 'DAB-MAS-001', name: 'Masque capillaire', unit_size: null, price: 3000, stock: 24, low_stock_threshold: 6, is_featured: false, category: cat.traitants, variant_of: null },
  { ...base, id: 6, slug: 'shampooing-dabo-hair', sku: 'DAB-SHA-001', name: 'Shampooing', unit_size: null, price: 3000, stock: 24, low_stock_threshold: 12, is_featured: true, category: cat.shampoings, variant_of: null },
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

export const db = {
  bookings: seedBookings(),
  nextBookingNumber: 11,
}
