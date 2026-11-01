import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBooking, fetchAvailability, fetchBusinessHours, fetchServices, fetchStylists } from './api'

export function useServices() {
  return useQuery({ queryKey: ['services'], queryFn: fetchServices, staleTime: 10 * 60_000 })
}

export function useBusinessHours() {
  return useQuery({ queryKey: ['business-hours'], queryFn: fetchBusinessHours, staleTime: 60 * 60_000 })
}

export function useStylists(serviceId: number | null) {
  return useQuery({
    queryKey: ['stylists', serviceId],
    queryFn: () => fetchStylists(serviceId!),
    enabled: serviceId !== null, // n'appelle l'API que lorsqu'une prestation est choisie
  })
}

export function useAvailability(serviceId: number | null, stylistId: number | null, date: string | null) {
  return useQuery({
    queryKey: ['availability', serviceId, stylistId, date],
    queryFn: () => fetchAvailability({ serviceId: serviceId!, stylistId, date: date! }),
    enabled: serviceId !== null && date !== null,
    staleTime: 30_000, // les disponibilités changent vite : cache court
  })
}

/** useMutation = une action qui MODIFIE des données côté serveur (ici : créer une réservation) */
export function useCreateBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createBooking,
    // Après une réservation (réussie ou en conflit), les disponibilités en cache sont FAUSSES.
    // removeQueries les supprime : la prochaine ouverture recharge depuis le serveur, au lieu
    // d'afficher un instant l'ancien créneau comme libre (ce que ferait invalidateQueries).
    onSettled: () => queryClient.removeQueries({ queryKey: ['availability'] }),
  })
}
