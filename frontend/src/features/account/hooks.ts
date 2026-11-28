import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ME_KEY, useMe } from '@/features/auth/hooks'
import { cancelMyBooking, fetchMyBookings, fetchPreferences, updatePreferences, fetchMyNotifications, fetchMyOrder, fetchMyOrders, markMyNotificationsRead, snoozeMyNotification, updateProfile } from './api'

export const useMyOrders = () => useQuery({ queryKey: ['me', 'orders'], queryFn: fetchMyOrders })
export const useMyOrder = (reference: string) => useQuery({ queryKey: ['me', 'orders', reference], queryFn: () => fetchMyOrder(reference) })
export const useMyBookings = () => useQuery({ queryKey: ['me', 'bookings'], queryFn: fetchMyBookings })

export function useCancelBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelMyBooking,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'bookings'] })
      qc.removeQueries({ queryKey: ['availability'] }) // le créneau libéré redevient réservable
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: updateProfile, onSuccess: (user) => qc.setQueryData(ME_KEY, user) })
}

/**
 * Notifications du profil : seulement si la personne est connectée (sinon, aucune requête).
 * Rechargées toutes les 5 minutes : la pastille de la cloche reste à jour sans recharger la page.
 */
export function useMyNotifications() {
  const { data: user } = useMe()
  return useQuery({ queryKey: ['me', 'notifications'], queryFn: fetchMyNotifications, enabled: Boolean(user), staleTime: 60_000, refetchInterval: 300_000 })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: markMyNotificationsRead, onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'notifications'] }) })
}

export function useSnoozeNotification() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: snoozeMyNotification, onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'notifications'] }) })
}

/** « Les messages que je reçois » : seulement si la personne est connectée */
export function usePreferences() {
  const { data: user } = useMe()
  return useQuery({ queryKey: ['me', 'preferences'], queryFn: fetchPreferences, enabled: Boolean(user), staleTime: 60_000 })
}

export function useUpdatePreferences() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: updatePreferences, onSuccess: (prefs) => qc.setQueryData(['me', 'preferences'], prefs) })
}
