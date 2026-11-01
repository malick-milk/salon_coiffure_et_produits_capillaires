/**
 * CONTRAT DE L'API D'ADMINISTRATION (/api/v1/admin/*), produit par les contrôleurs Laravel
 * de app/Http/Controllers/Api/V1/Admin. Montants en XOF (entiers), coûts unitaires décimaux.
 */
import type { BookingStatus, FulfillmentMethod, Money, OrderDetail, OrderStatus, PaymentStatus } from './api'

export interface PageMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface Dashboard {
  date: string
  revenue_today: Money | null // null si l'utilisateur n'a pas la permission analytics.view
  revenue_month: Money | null
  revenue_prev_month_same_period: Money | null
  orders_today: number
  orders_to_process: number
  bookings_today: number
  bookings_to_confirm: number
  new_customers_month: number
  agenda: { reference: string; time: string; service_name: string; customer_name: string; stylist_name: string; status: BookingStatus }[]
  stock_alerts: { id: number; name: string; stock: number; threshold: number }[]
  top_products: { name: string; units: number; revenue: Money | null; margin: Money | null }[]
  recent_orders: { reference: string; customer_name: string; channel: string; fulfillment_method: FulfillmentMethod; status: OrderStatus; payment_status: PaymentStatus; total: Money }[]
}

export interface AdminOrderRow {
  reference: string
  customer_name: string
  customer_phone: string
  customer_type: 'individual' | 'reseller'
  channel: 'online' | 'store'
  fulfillment_method: FulfillmentMethod
  status: OrderStatus
  payment_status: PaymentStatus
  items_count: number
  total: Money
  placed_at: string
}

export type PaymentMethod = 'cash' | 'wave' | 'orange_money' | 'free_money' | 'card' | 'bank_transfer'

export interface AdminOrderDetail extends OrderDetail {
  customer: { name: string; phone: string; email: string | null; type: 'individual' | 'reseller' }
  channel: 'online' | 'store'
  customer_notes: string | null
  cancellation_reason: string | null
  payments: { method: PaymentMethod; amount: Money; paid_at: string | null; provider_reference: string | null }[]
  invoice_number: string | null
  allowed_transitions: OrderStatus[] // la machine à états du serveur dit quels boutons afficher
}

export interface AdminBooking {
  reference: string
  status: BookingStatus
  service_name: string
  stylist_id: number
  stylist_name: string
  customer_name: string
  customer_phone: string
  starts_at: string
  duration_minutes: number
  price: Money
  customer_notes: string | null
  allowed_transitions: BookingStatus[]
}

export interface AdminProduct {
  id: number
  sku: string
  name: string
  unit_size: string | null
  slug: string
  category: string
  brand: string | null
  price: Money
  compare_at_price: Money | null
  cost_price: number | null // coût de revient unitaire (décimal) ; null = pas encore calculé
  margin_rate: number | null
  stock_quantity: number
  low_stock_threshold: number
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock'
  is_active: boolean
  is_featured: boolean
  short_description: string | null
  description: string | null
}

export interface StockMovementRow {
  type: string
  quantity: number
  stock_after: number
  reason: string | null
  reference: string | null
  created_at: string | null
}

export type CostCategory = 'ingredients' | 'packaging' | 'labels' | 'labor' | 'other'

export interface ProductionBatch {
  id: number
  batch_number: string
  product_id: number
  product_name: string
  quantity_produced: number
  total_cost: Money | null
  unit_cost: number | null
  produced_on: string
  expires_on: string | null
  days_before_expiry: number | null
  costs: { category: CostCategory; label: string; amount: Money }[]
  potential_revenue: Money
  potential_margin: Money | null
}

export interface AdminCustomer {
  id: number
  name: string
  phone: string
  email: string | null
  type: 'individual' | 'reseller'
  has_account: boolean
  orders_count: number
  bookings_count: number
  total_spent: Money
  since: string | null
}

export type StaffRole = 'super_admin' | 'manager' | 'cashier' | 'stylist' | 'stock_keeper'

export interface StaffUser {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  role: StaffRole | null
  is_active: boolean
  last_login_at: string | null
}

export interface RoleWithPermissions {
  name: StaffRole
  permissions: string[]
}

export interface AuditEntry {
  id: number
  log: string | null
  event: string | null
  description: string
  subject: string | null
  /** Libellé lisible (nom du produit, référence…), null si l'objet a été supprimé */
  subject_label: string | null
  causer: string
  changes: { old?: Record<string, unknown>; attributes?: Record<string, unknown>; [key: string]: unknown } | []
  created_at: string | null
}
