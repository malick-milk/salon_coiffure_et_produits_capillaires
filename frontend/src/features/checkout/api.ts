import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'
import type { CheckoutRequest, DeliveryZone, OrderDetail, PickupPointPublic } from '@/types/api'

// meta.free_delivery_threshold : livraison offerte à partir de ce montant d'achats, réglé dans l'ERP (null = pas d'offre)
type ZonesResponse = { data: DeliveryZone[]; meta?: { free_delivery_threshold: number | null } }
const fetchZones = async () => (await http.get<ZonesResponse>('/delivery-zones')).data
const placeOrder = async (body: CheckoutRequest) => (await http.post<{ data: OrderDetail }>('/orders', body)).data.data

export const usePickupPoints = () =>
  useQuery({ queryKey: ['pickup-points'], queryFn: async () => (await http.get<{ data: PickupPointPublic[] }>('/pickup-points')).data.data, staleTime: 10 * 60_000 })

// Un seul appel pour les deux : la même queryKey, deux « select » différents
export const useDeliveryZones = () => useQuery({ queryKey: ['delivery-zones'], queryFn: fetchZones, staleTime: 10 * 60_000, select: (r) => r.data })
export const useFreeDeliveryThreshold = () =>
  useQuery({ queryKey: ['delivery-zones'], queryFn: fetchZones, staleTime: 10 * 60_000, select: (r) => r.meta?.free_delivery_threshold ?? null }).data ?? null

/** « Plus que 3 000 F pour la livraison offerte » : ce qui manque, ou null (pas d'offre, ou seuil déjà atteint) */
export const missingForFreeDelivery = (threshold: number | null, productsTotal: number) =>
  threshold !== null && productsTotal < threshold ? threshold - productsTotal : null

export function usePlaceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: placeOrder,
    onSuccess: () => {
      // Le stock a changé et une commande s'ajoute à l'historique : ces caches sont périmés
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product'] })
      qc.invalidateQueries({ queryKey: ['me', 'orders'] })
    },
  })
}
