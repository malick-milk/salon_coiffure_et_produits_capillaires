import { http } from '@/lib/http'
import type { CustomerBooking, OrderDetail, OrderSummary, User } from '@/types/api'

export const fetchMyOrders = async () => (await http.get<{ data: OrderSummary[] }>('/me/orders')).data.data
export const fetchMyOrder = async (reference: string) => (await http.get<{ data: OrderDetail }>(`/me/orders/${encodeURIComponent(reference)}`)).data.data
export const fetchMyBookings = async () => (await http.get<{ data: CustomerBooking[] }>('/me/bookings')).data.data
export const cancelMyBooking = async (reference: string) =>
  (await http.post<{ data: CustomerBooking }>(`/me/bookings/${encodeURIComponent(reference)}/cancel`)).data.data
export const updateProfile = async (body: Pick<User, 'first_name' | 'last_name' | 'phone'>) =>
  (await http.patch<{ data: User }>('/me/profile', body)).data.data
