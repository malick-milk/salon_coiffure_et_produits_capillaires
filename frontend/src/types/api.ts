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

// ---------- Authentification (Sanctum, cookie de session HttpOnly — ADR-003) ----------
export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  roles: string[] // 'customer', 'manager'…
  permissions: string[] // sert à AFFICHER les menus de l'ERP ; chaque route de l'API revérifie (sécurité)
}

export interface LoginRequest {
  email: string
  password: string
  remember: boolean
}

export interface RegisterRequest {
  first_name: string
  last_name: string
  email: string
  phone: string
  password: string
  password_confirmation: string
  consent: boolean
}

// ---------- Commandes ----------
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type FulfillmentMethod = 'pickup' | 'delivery'

export interface DeliveryZone {
  id: number
  name: string
  fee: Money
}

export interface ShippingAddress {
  city: string
  district: string | null
  address_line: string
  landmark: string | null // point de repère, très utile pour le livreur
}

/** Ce que le navigateur envoie : des IDENTIFIANTS et des quantités, JAMAIS de prix (RG-COM-04) */
export interface CheckoutRequest {
  items: { product_id: number; quantity: number }[]
  fulfillment_method: FulfillmentMethod
  delivery_zone_id: number | null
  customer: { first_name: string; last_name: string; phone: string; email: string | null }
  shipping_address: ShippingAddress | null
  notes: string | null
  consent: boolean
}

/** Erreur 409 de stock : quels produits posent problème et combien il en reste */
export interface StockConflict {
  message: string
  items: { product_id: number; name: string; requested: number; available: number }[]
}

export interface OrderLine {
  product_slug: string | null
  product_name: string
  unit_price: Money // prix FIGÉ au moment de la commande
  quantity: number
  line_total: Money
}

export interface OrderSummary {
  reference: string
  status: OrderStatus
  payment_status: PaymentStatus
  fulfillment_method: FulfillmentMethod
  total: Money
  items_count: number
  placed_at: string
}

export interface OrderDetail extends OrderSummary {
  items: OrderLine[]
  subtotal: Money
  discount_total: Money
  shipping_fee: Money
  delivery_zone: string | null
  shipping_address: ShippingAddress | null
  invoice_available: boolean // facture PDF disponible une fois la commande payée (RG-FAC-01)
  can_cancel: boolean // le client peut annuler tant que la commande est « en attente » (RG-COM-05)
}

// ---------- Réservations du client ----------
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface CustomerBooking {
  reference: string
  status: BookingStatus
  service_name: string
  stylist_name: string
  starts_at: string
  duration_minutes: number
  price: Money
  can_cancel: boolean // jusqu'à 24 h avant (RG-RES-04)
  cancelled_by: 'customer' | 'staff' | 'system' | null
  cancellation_reason: string | null // motif donné par le salon (étape 13)
}

// ---------- Étape 13 : avis clients et enquête de satisfaction ----------
export interface PublicReview {
  id: number
  author: string // « Aïssatou D. » : jamais le nom complet
  kind: 'booking' | 'order'
  subject_label: string
  rating: number // 1 à 5
  comment: string | null
  reply: string | null // réponse publique du salon
  date: string // AAAA-MM-JJ
}

export interface ReviewsSummary {
  average: number | null // moyenne de TOUTES les réponses, publiées ou non
  answered_count: number
  published_count: number
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>
}

export interface ReviewsResponse {
  data: PublicReview[]
  summary: ReviewsSummary
  meta: { current_page: number; last_page: number; total: number }
}

export interface SurveyInfo {
  kind: 'booking' | 'order'
  subject_label: string
  first_name: string | null
  state: 'open' | 'answered' | 'expired'
}

export interface SurveyAnswer {
  rating: number
  nps: number | null
  comment: string | null
  publish_consent: boolean
}
