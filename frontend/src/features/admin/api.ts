/** Appels de l'API d'administration + hooks TanStack Query (un seul fichier : la recette reste lisible) */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'
import type { BookingStatus, OrderStatus } from '@/types/api'
import type {
  AdminBooking, AdminCustomer, AdminOrderDetail, AdminOrderRow, AdminProduct, AuditEntry, CostCategory, Dashboard,
  PageMeta, PaymentMethod, ProductionBatch, RoleWithPermissions, StaffRole, StaffUser, StockMovementRow,
} from '@/types/admin'
import type { Analytics, ExportDataset } from '@/types/analytics'

type Page<T> = { data: T[]; meta: PageMeta }
const get = async <T>(url: string, params?: object) => (await http.get<{ data: T }>(url, { params })).data.data
const getPage = async <T>(url: string, params?: object) => (await http.get<Page<T>>(url, { params })).data

const A = '/admin'

// ---------- Lectures ----------
export const useDashboard = () => useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => get<Dashboard>(`${A}/dashboard`), refetchInterval: 60_000 })

export const useAdminOrders = (filters: { status?: string; payment_status?: string; search?: string; page?: number }) =>
  useQuery({ queryKey: ['admin', 'orders', filters], queryFn: () => getPage<AdminOrderRow>(`${A}/orders`, filters), placeholderData: keepPreviousData })

export const useAdminOrder = (reference: string) =>
  useQuery({ queryKey: ['admin', 'order', reference], queryFn: () => get<AdminOrderDetail>(`${A}/orders/${encodeURIComponent(reference)}`) })

export const useAdminBookings = (from: string, to: string) =>
  useQuery({ queryKey: ['admin', 'bookings', from, to], queryFn: () => get<AdminBooking[]>(`${A}/bookings`, { from, to }), placeholderData: keepPreviousData })

export const useAdminProducts = () => useQuery({ queryKey: ['admin', 'products'], queryFn: () => get<AdminProduct[]>(`${A}/products`) })

export const useStockMovements = (productId: number | null) =>
  useQuery({ queryKey: ['admin', 'movements', productId], queryFn: () => get<StockMovementRow[]>(`${A}/products/${productId}/movements`), enabled: productId !== null })

export const useBatches = () => useQuery({ queryKey: ['admin', 'batches'], queryFn: () => get<ProductionBatch[]>(`${A}/production-batches`) })

export const useAdminCustomers = (filters: { search?: string; type?: string; page?: number }) =>
  useQuery({ queryKey: ['admin', 'customers', filters], queryFn: () => getPage<AdminCustomer>(`${A}/customers`, filters), placeholderData: keepPreviousData })

export const useStaff = () => useQuery({ queryKey: ['admin', 'users'], queryFn: () => get<StaffUser[]>(`${A}/users`) })
export const useRoles = () => useQuery({ queryKey: ['admin', 'roles'], queryFn: () => get<RoleWithPermissions[]>(`${A}/roles`), staleTime: 10 * 60_000 })

export const useAudit = (filters: { log?: string; page?: number }) =>
  useQuery({ queryKey: ['admin', 'audit', filters], queryFn: () => getPage<AuditEntry>(`${A}/audit`, filters), placeholderData: keepPreviousData })

// ---------- Écritures ----------
/** Après une action, on invalide ce qui a changé : les listes et le tableau de bord se rechargent */
function useAdminMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>, invalidate: string[][]) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate.forEach((key) => qc.invalidateQueries({ queryKey: key })) })
}

export const useChangeOrderStatus = (reference: string) =>
  useAdminMutation(
    (v: { status: OrderStatus; reason?: string }) => http.patch(`${A}/orders/${encodeURIComponent(reference)}/status`, v),
    [['admin', 'order', reference], ['admin', 'orders'], ['admin', 'dashboard'], ['admin', 'products']],
  )

export const useRecordPayment = (reference: string) =>
  useAdminMutation(
    (v: { method: PaymentMethod; provider_reference?: string }) => http.post(`${A}/orders/${encodeURIComponent(reference)}/payments`, v),
    [['admin', 'order', reference], ['admin', 'orders'], ['admin', 'dashboard']],
  )

export const useChangeBookingStatus = () =>
  useAdminMutation(
    (v: { reference: string; status: BookingStatus; reason?: string }) => http.patch(`${A}/bookings/${encodeURIComponent(v.reference)}/status`, { status: v.status, reason: v.reason }),
    [['admin', 'bookings'], ['admin', 'dashboard']],
  )

export const useUpdateProduct = () =>
  useAdminMutation((v: { id: number } & Partial<Pick<AdminProduct, 'price' | 'is_active' | 'is_featured' | 'low_stock_threshold'>>) => {
    const { id, ...body } = v
    return http.patch(`${A}/products/${id}`, body)
  }, [['admin', 'products'], ['products'], ['product']])

export const useAdjustStock = () =>
  useAdminMutation(
    (v: { id: number; type: 'loss' | 'adjustment' | 'customer_return'; quantity: number; reason: string }) =>
      http.post(`${A}/products/${v.id}/stock-adjustments`, { type: v.type, quantity: v.quantity, reason: v.reason }),
    [['admin', 'products'], ['admin', 'movements'], ['admin', 'dashboard'], ['products'], ['product']],
  )

export interface NewBatch {
  product_id: number
  batch_number: string
  quantity_produced: number
  produced_on: string
  expires_on: string | null
  notes: string | null
  costs: { category: CostCategory; label: string; amount: number }[]
}
export const useCreateBatch = () =>
  useAdminMutation((v: NewBatch) => http.post<{ data: { unit_cost: number | null } }>(`${A}/production-batches`, v), [['admin', 'batches'], ['admin', 'products'], ['admin', 'dashboard']])

export const useCreateStaff = () =>
  useAdminMutation((v: { first_name: string; last_name: string; email: string; phone: string | null; role: StaffRole; password: string }) => http.post(`${A}/users`, v), [['admin', 'users']])

export const useUpdateStaff = () =>
  useAdminMutation((v: { id: number; role?: StaffRole; is_active?: boolean }) => {
    const { id, ...body } = v
    return http.patch(`${A}/users/${id}`, body)
  }, [['admin', 'users']])

/** Lien de téléchargement direct : le cookie de session accompagne la requête (même origine) */
export const invoicePdfUrl = (number: string) => `/api/v1${A}/invoices/${encodeURIComponent(number)}/pdf`

// ---------- Étape 8 : analyses (BI) ----------

/**
 * keepPreviousData : quand on change de période, l'ancien graphique reste affiché (estompé) pendant
 * le chargement, au lieu d'un squelette qui fait sauter la mise en page.
 */
export function useAnalytics(from: string, to: string) {
  return useQuery({
    queryKey: ['admin', 'analytics', from, to],
    queryFn: () => get<Analytics>(`${A}/analytics`, { from, to }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000, // même fraîcheur que les agrégats du jour côté serveur
  })
}

/** Lien de téléchargement : le navigateur envoie le cookie de session, le serveur vérifie analytics.view */
export const analyticsExportUrl = (dataset: ExportDataset, from: string, to: string) =>
  `/api/v1${A}/analytics/export/${dataset}?${new URLSearchParams({ from, to })}`
