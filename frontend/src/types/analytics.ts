/** Contrat de GET /api/v1/admin/analytics (étape 8). Définitions des KPI : docs/08_ANALYTICS.md */

export interface KpiSet {
  revenue: number
  products_revenue: number
  services_revenue: number
  orders: number
  items_sold: number
  average_basket: number | null
  /** null = aucun CA dont le coût de revient est connu : on n'invente pas de marge */
  gross_margin: number | null
  margin_rate: number | null
  bookings: number
  bookings_completed: number
  no_show_rate: number | null
  new_customers: number
  active_customers: number
  returning_rate: number | null
}

export type Granularity = 'day' | 'week' | 'month'
export type StockStatus = 'out_of_stock' | 'below_threshold' | 'cover_under_14_days' | 'slow_moving' | 'ok'
export type ExportDataset = 'daily_sales' | 'product_daily' | 'order_lines'

export interface Analytics {
  period: { from: string; to: string; days: number; granularity: Granularity }
  previous_period: { from: string; to: string }
  kpis: { current: KpiSet; previous: KpiSet }
  series: { date: string; products: number; services: number; orders: number; bookings: number }[]
  top_products: { product_id: number; name: string; units: number; revenue: number; margin: number | null; margin_rate: number | null }[]
  stock: {
    product_id: number; name: string; stock: number; threshold: number; units_sold: number; turnover: number | null
    avg_daily_demand: number; days_of_cover: number | null; stockout_date: string | null; immobilized_value: number | null; status: StockStatus
  }[]
  top_customers: { customer_id: number; name: string; type: 'individual' | 'reseller'; period_spent: number; period_visits: number; lifetime_value: number; lifetime_visits: number; days_since_last_visit: number }[]
  /** day_of_week : 1 = lundi */
  booking_heatmap: { day_of_week: number; hour: number; bookings: number }[]
  payment_methods: { method: string; count: number; amount: number }[]
  data_quality: { products_without_cost: string[]; costed_revenue_share: number | null }
  computed_at: string
}
