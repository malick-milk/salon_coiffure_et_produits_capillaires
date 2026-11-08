import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'
import type { CheckoutRequest, DeliveryZone, OrderDetail, PickupPointPublic } from '@/types/api'

const fetchZones = async () => (await http.get<{ data: DeliveryZone[] }>('/delivery-zones')).data.data
const placeOrder = async (body: CheckoutRequest) => (await http.post<{ data: OrderDetail }>('/orders', body)).data.data

export const usePickupPoints = () =>
  useQuery({ queryKey: ['pickup-points'], queryFn: async () => (await http.get<{ data: PickupPointPublic[] }>('/pickup-points')).data.data, staleTime: 10 * 60_000 })

export const useDeliveryZones = () => useQuery({ queryKey: ['delivery-zones'], queryFn: fetchZones, staleTime: 60 * 60_000 })

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
