import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ME_KEY } from '@/features/auth/hooks'
import { cancelMyBooking, fetchMyBookings, fetchMyOrder, fetchMyOrders, updateProfile } from './api'

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
