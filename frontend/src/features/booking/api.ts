import { http } from '@/lib/http'
import type { BookingConfirmation, BookingRequest, BusinessHour, DayAvailability, Service, Stylist } from '@/types/api'

export async function fetchServices(): Promise<Service[]> {
  return (await http.get<{ data: Service[] }>('/services')).data.data
}

export async function fetchStylists(serviceId: number): Promise<Stylist[]> {
  return (await http.get<{ data: Stylist[] }>('/stylists', { params: { service_id: serviceId } })).data.data
}

export async function fetchBusinessHours(): Promise<BusinessHour[]> {
  return (await http.get<{ data: BusinessHour[] }>('/business-hours')).data.data
}

export async function fetchAvailability(params: { serviceId: number; stylistId: number | null; date: string }): Promise<DayAvailability> {
  const query: Record<string, string | number> = { service_id: params.serviceId, date: params.date }
  if (params.stylistId) query.stylist_id = params.stylistId
  return (await http.get<{ data: DayAvailability }>('/availability', { params: query })).data.data
}

export async function createBooking(body: BookingRequest): Promise<BookingConfirmation> {
  return (await http.post<{ data: BookingConfirmation }>('/bookings', body)).data.data
}
