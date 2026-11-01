/**
 * CONTRAT DE L'API (version 1).
 *
 * Ces types décrivent exactement le JSON que l'API Laravel renverra (API Resources, étape 6).
 * Ils sont écrits AVANT le backend : c'est l'approche « contrat d'abord ».
 * Le frontend et le backend se mettent d'accord sur la forme des données, puis chacun avance.
 *
 * Convention (ADR-012) : les clés JSON sont en snake_case, comme les colonnes MySQL et la
 * convention Laravel. Aucune couche de traduction = moins de bugs.
 * Montants : entiers en XOF. Dates : chaînes ISO 8601.
 */

export type Money = number

export interface Paginated<T> {
  data: T[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

// ---------- Catalogue ----------
export interface CategoryRef {
  id: number
  name: string
  slug: string
}

export interface Category extends CategoryRef {
  parent_id: number | null
  product_count: number
}

export interface HairType {
  name: string
  slug: string
}

/** Le stock exact n'est jamais exposé au public : seulement un statut (et un indice si faible) */
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface ProductSummary {
  id: number
  slug: string
  sku: string
  name: string
  brand: { name: string; slug: string } | null
  unit_size: string | null
  price: Money
  compare_at_price: Money | null
  stock_status: StockStatus
  stock_left: number | null // renseigné seulement si low_stock ("Plus que 4 en stock")
  is_featured: boolean
  category: CategoryRef
  image_url: string | null
}

export interface ProductVariant {
  slug: string
  unit_size: string | null
  price: Money
  stock_status: StockStatus
  is_current: boolean
}

export interface ProductDetail extends ProductSummary {
  short_description: string | null
  description: string | null
  hair_types: HairType[]
  images: { url: string; alt: string }[]
  variants: ProductVariant[] // autres contenances (products.variant_of_id)
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'name'

export interface ProductFilters {
  category?: string
  hair_type?: string
  min_price?: number
  max_price?: number
  in_stock?: boolean
  featured?: boolean
  search?: string
  sort?: ProductSort
  page?: number
}

// ---------- Salon ----------
export interface Service {
  id: number
  slug: string
  name: string
  category: string
  description: string | null
  duration_minutes: number
  price: Money
}

export interface Stylist {
  id: number
  display_name: string
  service_ids: number[]
}

export interface BusinessHour {
  day_of_week: number // 1 = lundi … 7 = dimanche
  is_closed: boolean
  opens_at: string | null // "09:00"
  closes_at: string | null
  break_start: string | null
  break_end: string | null
}

export interface Slot {
  time: string // "10:30"
  available: boolean
}

export interface DayAvailability {
  date: string // "2026-11-14"
  is_open: boolean
  closed_reason: string | null
  slots: Slot[]
}

export interface BookingRequest {
  service_id: number
  stylist_id: number | null // null = « peu importe »
  date: string
  time: string
  customer: { first_name: string; last_name: string; phone: string; email: string | null }
  notes: string | null
  consent: boolean
}

export interface BookingConfirmation {
  reference: string
  status: 'pending'
  service_name: string
  stylist_name: string
  starts_at: string
  ends_at: string
  price: Money
}
