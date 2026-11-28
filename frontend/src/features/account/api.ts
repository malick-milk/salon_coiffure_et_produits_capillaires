import { http } from '@/lib/http'
import type { Preferences, AccountNotification, CustomerBooking, OrderDetail, OrderSummary, User } from '@/types/api'

export const fetchMyOrders = async () => (await http.get<{ data: OrderSummary[] }>('/me/orders')).data.data
export const fetchMyOrder = async (reference: string) => (await http.get<{ data: OrderDetail }>(`/me/orders/${encodeURIComponent(reference)}`)).data.data
export const fetchMyBookings = async () => (await http.get<{ data: CustomerBooking[] }>('/me/bookings')).data.data
export const cancelMyBooking = async (reference: string) =>
  (await http.post<{ data: CustomerBooking }>(`/me/bookings/${encodeURIComponent(reference)}/cancel`)).data.data
/** email : seulement pour AJOUTER un e-mail à un compte qui n'en a pas (le changer passe par le salon) */
export const updateProfile = async (body: Pick<User, 'first_name' | 'last_name' | 'phone'> & { email?: string | null }) =>
  (await http.patch<{ data: User }>('/me/profile', body)).data.data

type NotificationsPage = { data: AccountNotification[]; meta: { unread: number } }
export const fetchMyNotifications = async () => (await http.get<NotificationsPage>('/me/notifications')).data
export const markMyNotificationsRead = async () => (await http.post('/me/notifications/read')).data
export const snoozeMyNotification = async (id: string) => (await http.post(`/me/notifications/${encodeURIComponent(id)}/snooze`)).data

export const fetchPreferences = async () => (await http.get<{ data: Preferences }>('/me/preferences')).data.data
export const updatePreferences = async (body: Partial<Pick<Preferences, 'resserrage_reminders' | 'marketing_email'>>) =>
  (await http.patch<{ data: Preferences }>('/me/preferences', body)).data.data
