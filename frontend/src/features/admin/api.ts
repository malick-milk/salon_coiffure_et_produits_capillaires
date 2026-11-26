/** Appels de l'API d'administration + hooks TanStack Query (un seul fichier : la recette reste lisible) */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'
import type { BookingStatus, OrderStatus } from '@/types/api'
import type {
  AdminBooking, AdminCustomer, BrandOption, CategoryOption, AdminDeliveryZone, AdminPromotion, DeliveryOverview, NewBundle, NewProduct, NewPurchaseReceipt, ProductChanges, ProductHistoryEntry, PromotionInput, PromotionResults, PurchaseReceipt, AdminOrderDetail, AdminOrderRow, AdminProduct, AuditEntry, CostCategory, Dashboard,
  AdminPickupPoint, AdminSurvey, PageMeta, PickupPointDetail, PickupPointsIndex, StatementPreview, PaymentMethod, ProductionBatch, RoleWithPermissions, StaffRole, StaffUser, StockMovementRow, SurveyFilter, SurveyStats,
} from '@/types/admin'
import type { HrIndex, HrInput, HrOptions, HrSheet } from '@/types/admin'
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
  useAdminMutation(async (v: { id: number } & ProductChanges) => {
    const { id, ...body } = v
    return (await http.patch<{ data: AdminProduct }>(`${A}/products/${id}`, body)).data.data
  }, [['admin', 'products'], ['admin', 'product-history'], ['products'], ['product']])

export const useProductHistory = (productId: number) =>
  useQuery({ queryKey: ['admin', 'product-history', productId], queryFn: () => get<ProductHistoryEntry[]>(`${A}/products/${productId}/history`) })

// ---------- Nouveau produit, photos, réceptions d'achat (16 novembre 2026) ----------
export const useBrands = () => useQuery({ queryKey: ['admin', 'brands'], queryFn: () => get<BrandOption[]>(`${A}/brands`) })
export const useAdminCategories = () => useQuery({ queryKey: ['admin', 'categories'], queryFn: () => get<CategoryOption[]>(`${A}/categories`) })
export const usePurchaseReceipts = () => useQuery({ queryKey: ['admin', 'purchase-receipts'], queryFn: () => get<PurchaseReceipt[]>(`${A}/purchase-receipts`) })

export const useCreateBrand = () =>
  useAdminMutation(async (v: { name: string }) => (await http.post<{ data: BrandOption }>(`${A}/brands`, v)).data.data, [['admin', 'brands']])

export const useCreateBundle = () =>
  useAdminMutation(async (v: NewBundle) => (await http.post<{ data: AdminProduct }>(`${A}/bundles`, v)).data.data, [['admin', 'products']])

export const useCreateProduct = () =>
  useAdminMutation(async (v: NewProduct) => (await http.post<{ data: AdminProduct }>(`${A}/products`, v)).data.data, [['admin', 'products']])

/** Envoi d'une photo (multipart) : le navigateur l'a déjà réduite (voir lib/resizeImage.ts) */
export const useUploadProductImage = () =>
  useAdminMutation(async (v: { productId: number; image: Blob }) => {
    const form = new FormData()
    form.append('image', v.image, 'photo.jpg')
    return (await http.post<{ data: AdminProduct }>(`${A}/products/${v.productId}/images`, form)).data.data
  }, [['admin', 'products'], ['products'], ['product']])

export const useDeleteProductImage = () =>
  useAdminMutation((v: { productId: number; imageId: number }) => http.delete(`${A}/products/${v.productId}/images/${v.imageId}`), [['admin', 'products'], ['products'], ['product']])

export const useMakePrimaryImage = () =>
  useAdminMutation((v: { productId: number; imageId: number }) => http.patch(`${A}/products/${v.productId}/images/${v.imageId}/primary`), [['admin', 'products'], ['products'], ['product']])

export const useCreatePurchaseReceipt = () =>
  useAdminMutation((v: NewPurchaseReceipt) => http.post(`${A}/purchase-receipts`, v), [['admin', 'purchase-receipts'], ['admin', 'products'], ['admin', 'dashboard'], ['admin', 'movements'], ['products'], ['product']])

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

// ---------- Étape 13 : avis clients et satisfaction ----------
type SurveyPage = Page<AdminSurvey> & { counts: { to_moderate: number; follow_up: number } }

export const useAdminSurveys = (filter: SurveyFilter, page = 1) =>
  useQuery({ queryKey: ['admin', 'surveys', filter, page], queryFn: async () => (await http.get<SurveyPage>(`${A}/surveys`, { params: { filter, page } })).data, placeholderData: keepPreviousData })

export const useSurveyStats = () => useQuery({ queryKey: ['admin', 'surveys', 'stats'], queryFn: () => get<SurveyStats>(`${A}/surveys/stats`) })

export const useModerateReview = () =>
  useAdminMutation(
    (v: { id: number; decision: 'approve' | 'reject' | 'reply'; reply?: string; reject_reason?: string }) =>
      http.patch(`${A}/surveys/${v.id}/review`, { decision: v.decision, reply: v.reply, reject_reason: v.reject_reason }),
    [['admin', 'surveys'], ['reviews']],
  )

export const useFollowUp = () =>
  useAdminMutation((v: { id: number; note: string }) => http.patch(`${A}/surveys/${v.id}/follow-up`, { note: v.note }), [['admin', 'surveys']])

// ---------- Étape 14 : points de retrait partenaires ----------
export const usePickupPointsAdmin = () =>
  useQuery({ queryKey: ['admin', 'pickup-points'], queryFn: async () => (await http.get<PickupPointsIndex>(`${A}/pickup-points`)).data })

export const usePickupPointAdmin = (id: number) =>
  useQuery({ queryKey: ['admin', 'pickup-point', id], queryFn: () => get<PickupPointDetail>(`${A}/pickup-points/${id}`) })

type PointInput = Omit<AdminPickupPoint, 'id' | 'is_active' | 'commission_rate'> & { commission_rate?: number; is_active?: boolean }

export const useCreatePickupPoint = () =>
  useAdminMutation((v: PointInput) => http.post<{ data: AdminPickupPoint }>(`${A}/pickup-points`, v), [['admin', 'pickup-points']])

export const useUpdatePickupPoint = (id: number) =>
  useAdminMutation((v: Partial<PointInput>) => http.patch(`${A}/pickup-points/${id}`, v), [['admin', 'pickup-points'], ['admin', 'pickup-point']])

const pointKeys = () => [['admin', 'pickup-points'], ['admin', 'pickup-point'], ['admin', 'products'], ['admin', 'dashboard']]

export const useDeliverToPoint = (id: number) =>
  useAdminMutation((v: { delivered_on?: string; items: { product_id: number; quantity: number }[] }) =>
    http.post<{ data: { id: number; number: string } }>(`${A}/pickup-points/${id}/deliveries`, v).then((r) => r.data.data), pointKeys())

export const fetchStatementPreview = async (id: number, counts: { product_id: number; counted: number; damaged: number }[]) =>
  (await http.post<{ data: StatementPreview }>(`${A}/pickup-points/${id}/statements/preview`, { counts })).data.data

export const useValidateStatement = (id: number) =>
  useAdminMutation((v: { period: string; counts: { product_id: number; counted: number; damaged: number }[]; declared_sold: number | null; gap_note: string | null }) =>
    http.post(`${A}/pickup-points/${id}/statements`, v), pointKeys())

export const useStatementPayment = () =>
  useAdminMutation((v: { statementId: number; method: PaymentMethod }) => http.post(`${A}/consignment-statements/${v.statementId}/payment`, { method: v.method }), [...pointKeys(), ['admin', 'orders']])

export const deliveryPdfUrl = (deliveryId: number) => `/api/v1${A}/consignment-deliveries/${deliveryId}/pdf`
export const statementPdfUrl = (statementId: number) => `/api/v1${A}/consignment-statements/${statementId}/pdf`

// ---------- Promotions en pourcentage (maquettes validées le 20 novembre 2026) ----------
// Une promotion change le prix affiché du site : on rafraîchit aussi le catalogue
const promotionKeys = [['admin', 'promotions'], ['admin', 'promotion-results'], ['products'], ['product']]
export const usePromotions = () => useQuery({ queryKey: ['admin', 'promotions'], queryFn: () => get<AdminPromotion[]>(`${A}/promotions`) })
export const usePromotionResults = (id: number) =>
  useQuery({ queryKey: ['admin', 'promotion-results', id], queryFn: () => get<PromotionResults>(`${A}/promotions/${id}/results`) })
export const useCreatePromotion = () =>
  useAdminMutation(async (v: PromotionInput) => (await http.post<{ data: AdminPromotion }>(`${A}/promotions`, v)).data.data, promotionKeys)
export const useUpdatePromotion = (id: number) =>
  useAdminMutation(async (v: PromotionInput) => (await http.patch<{ data: AdminPromotion }>(`${A}/promotions/${id}`, v)).data.data, promotionKeys)
export const useStopPromotion = () => useAdminMutation((id: number) => http.post(`${A}/promotions/${id}/stop`), promotionKeys)

// ---------- Tarifs de livraison (maquette validée le 21 novembre 2026) ----------
// Les frais changent aussi la page de commande du site : on rafraîchit ['delivery-zones']
const deliveryKeys = [['admin', 'delivery'], ['delivery-zones']]
export const useDelivery = () => useQuery({ queryKey: ['admin', 'delivery'], queryFn: () => get<DeliveryOverview>(`${A}/delivery`) })
export const useCreateDeliveryZone = () =>
  useAdminMutation(async (v: { name: string; fee: number; delay_label: string | null }) => (await http.post<{ data: AdminDeliveryZone }>(`${A}/delivery-zones`, v)).data.data, deliveryKeys)
export const useUpdateDeliveryZone = () =>
  useAdminMutation((v: { id: number } & Partial<Pick<AdminDeliveryZone, 'name' | 'fee' | 'delay_label' | 'is_active'>>) => {
    const { id, ...body } = v
    return http.patch(`${A}/delivery-zones/${id}`, body)
  }, deliveryKeys)
export const useUpdateDeliverySettings = () =>
  useAdminMutation((v: { free_delivery_threshold: number | null }) => http.put(`${A}/delivery-settings`, v), deliveryKeys)

// ---------------------------------------------------------------- Contrats et RH (propriétaire seulement)
const hrKeys = [['admin', 'hr'], ['admin', 'hr-employee'], ['admin', 'audit']]
export const useHrEmployees = () => useQuery({ queryKey: ['admin', 'hr'], queryFn: async () => (await http.get<HrIndex>(`${A}/hr/employees`)).data })
export const useHrEmployee = (id: number | null) =>
  useQuery({ queryKey: ['admin', 'hr-employee', id], enabled: id !== null, queryFn: async () => (await http.get<{ data: HrSheet; options: HrOptions }>(`${A}/hr/employees/${id}`)).data })
export const useCreateEmployee = () => useAdminMutation(async (v: HrInput) => (await http.post<{ data: HrSheet }>(`${A}/hr/employees`, v)).data.data, hrKeys)
export const useUpdateEmployee = (id: number) => useAdminMutation(async (v: Partial<HrInput>) => (await http.patch<{ data: HrSheet }>(`${A}/hr/employees/${id}`, v)).data.data, hrKeys)
export const useRenewContract = () => useAdminMutation((v: { contractId: number; ends_on: string }) => http.post(`${A}/hr/contracts/${v.contractId}/renew`, { ends_on: v.ends_on }), hrKeys)
export const useConvertContract = () => useAdminMutation((v: { contractId: number; starts_on: string }) => http.post(`${A}/hr/contracts/${v.contractId}/convert`, { starts_on: v.starts_on }), hrKeys)
export const useTerminateContract = () =>
  useAdminMutation((v: { contractId: number; ended_on: string; end_reason: string; end_note: string | null }) => http.post(`${A}/hr/contracts/${v.contractId}/terminate`, v), hrKeys)
export const useAddEmployeeDocument = (id: number) =>
  useAdminMutation((v: { file: File; kind: string }) => {
    const form = new FormData()
    form.append('document', v.file)
    form.append('kind', v.kind)
    return http.post(`${A}/hr/employees/${id}/documents`, form)
  }, hrKeys)
export const useRemoveEmployeeDocument = () => useAdminMutation((documentId: number) => http.delete(`${A}/hr/documents/${documentId}`), hrKeys)
export const useAddLeave = (id: number) =>
  useAdminMutation((v: { kind: string; starts_on: string; ends_on: string; days: number; note: string | null }) => http.post(`${A}/hr/employees/${id}/leaves`, v), hrKeys)
/** Fichiers protégés, téléchargés par axios (voir lib/downloadFile.ts : pas de lien direct) */
export const hrContractPdfUrl = (contractId: number) => `${A}/hr/contracts/${contractId}/pdf`
export const hrDocumentUrl = (documentId: number) => `${A}/hr/documents/${documentId}`
