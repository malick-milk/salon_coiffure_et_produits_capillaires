/** Étape 14 : la page du partenaire n'accepte que 4 chiffres et confirme la remise */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HandoverPage } from './pages/HandoverPage'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/http', async (orig) => ({ ...(await orig<typeof import('@/lib/http')>()), http: { get, post } }))

const TOKEN = 'b'.repeat(40)
const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[`/retrait/${TOKEN}`]}><Routes><Route path="/retrait/:token" element={<HandoverPage />} /></Routes></MemoryRouter>
  </QueryClientProvider>,
)

describe('Remise par le point de retrait', () => {
  beforeEach(() => {
    get.mockReset(); post.mockReset()
    get.mockResolvedValue({ data: { data: { reference: 'CMD-2026-000120', pickup_point: 'Boutique de Moussa Diop', customer_first_name: 'Fatou', items: [{ name: 'Sérum Activ’Pousse 30 ml', quantity: 2 }], total: 6000, state: 'ready' } } })
  })

  it('ne garde que les chiffres et envoie le code', async () => {
    const user = userEvent.setup()
    post.mockResolvedValue({ data: { data: { state: 'handed_over', total: 6000 } } })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Remettre la commande de Fatou' })).toBeInTheDocument()
    const input = screen.getByLabelText('Code de retrait donné par la cliente')
    const submit = screen.getByRole('button', { name: 'Confirmer la remise' })
    expect(submit).toBeDisabled()
    await user.type(input, '4a8b21')
    expect(input).toHaveValue('4821')
    await user.click(submit)
    expect(post).toHaveBeenCalledWith(`/handover/${TOKEN}`, { code: '4821' })
    expect(await screen.findByRole('status')).toHaveTextContent('Commande remise')
  })

  it('commande annulée : pas de formulaire', async () => {
    get.mockResolvedValueOnce({ data: { data: { reference: 'CMD-2026-000121', pickup_point: 'X', customer_first_name: 'Awa', items: [], total: 0, state: 'unavailable' } } })
    renderPage()
    expect(await screen.findByText('Commande non disponible')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmer la remise' })).not.toBeInTheDocument()
  })
})
