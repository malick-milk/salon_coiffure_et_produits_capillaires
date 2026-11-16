/** Rubrique « Notifications » : la carte de resserrage, ses deux boutons, et la lecture automatique */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationsPage } from './AccountPages'

const reminder = {
  id: '0b5d8d8a-1111-4222-8333-444455556666', kind: 'resserrage', title: 'Votre resserrage approche', read: false, created_at: '2026-11-16T09:30:00Z',
  text: 'Votre micro twist long a été fait le 17 octobre. Pour garder des twists nets, Awa conseille un resserrage vers le 14 novembre.',
  url: '/reserver?prestation=resserrage-micro-twist', booking_reference: 'RDV-2026-000105',
  resserrage: { slug: 'resserrage-micro-twist', name: 'Resserrage micro twist', price: 10000, duration_minutes: 120 },
}
const message = { id: '0b5d8d8a-2222-4222-8333-444455556666', kind: 'message', title: 'Rendez-vous confirmé', text: 'Votre RDV est confirmé.', url: '/compte/reservations', read: true, created_at: '2026-11-10T09:00:00Z' }
const post = vi.fn((_url: string) => Promise.resolve({ data: { meta: { unread: 0 } } }))

vi.mock('@/lib/http', async (orig) => ({
  ...(await orig<typeof import('@/lib/http')>()),
  http: {
    get: (url: string) => Promise.resolve({ data: url === '/auth/me' ? { data: { id: 3, first_name: 'Mariama', permissions: [] } } : { data: [reminder, message], meta: { unread: 1 } } }),
    post: (url: string) => post(url),
  },
}))

const renderPage = () =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><NotificationsPage /></MemoryRouter></QueryClientProvider>)

describe('Notifications du profil', () => {
  beforeEach(() => post.mockClear())

  it('la carte de resserrage mène à la réservation avec le bon resserrage déjà choisi', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Votre resserrage approche' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Réserver mon resserrage · 10\s000\sF CFA/ })).toHaveAttribute('href', '/reserver?prestation=resserrage-micro-twist')
    expect(screen.getByRole('link', { name: /Rendez-vous confirmé/ })).toHaveAttribute('href', '/compte/reservations')
  })

  it('ouvrir la rubrique marque tout comme lu ; « dans 1 semaine » reporte le rappel', async () => {
    renderPage()
    await waitFor(() => expect(post).toHaveBeenCalledWith('/me/notifications/read'))
    fireEvent.click(await screen.findByRole('button', { name: 'Me le rappeler dans 1 semaine' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith(`/me/notifications/${reminder.id}/snooze`))
  })
})
