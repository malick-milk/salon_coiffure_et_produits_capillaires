/** Remise d'une commande par un point de retrait partenaire (étape 14) */
import { useMutation, useQuery } from '@tanstack/react-query'
import { http } from '@/lib/http'

export interface HandoverInfo {
  reference: string
  pickup_point: string
  customer_first_name: string
  items: { name: string; quantity: number }[]
  total: number
  state: 'ready' | 'handed_over' | 'unavailable'
}

export const useHandover = (token: string) =>
  useQuery({ queryKey: ['handover', token], queryFn: async () => (await http.get<{ data: HandoverInfo }>(`/handover/${encodeURIComponent(token)}`)).data.data, retry: false })

export const useConfirmHandover = (token: string) =>
  useMutation({ mutationFn: async (code: string) => (await http.post<{ data: { state: 'handed_over'; total: number } }>(`/handover/${encodeURIComponent(token)}`, { code })).data.data })
