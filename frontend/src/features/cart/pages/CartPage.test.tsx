/** Panier et PRIX MEMBRE (maquettes validées le 18 novembre 2026) */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemberOfferStatus } from '@/types/api'
import { useCart } from '../store'
import { CartPage } from './CartPage'

let status: MemberOfferStatus = 'sign_in'
let me: unknown = null
vi.mock('@/lib/http', async (orig) => ({
  ...(await orig<typeof import('@/lib/http')>()),
  http: {
    get: (url: string) => {
      if (url === '/auth/me') return me ? Promise.resolve({ data: { data: me } }) : Promise.reject(Object.assign(new Error('401'), { isAxiosError: true, response: { status: 401 } }))
      return Promise.resolve({ data: { data: { slug: 'gamme-complete-dabo-hair', price: 15000, member_price: 10000, member_offer: { limit: 20, remaining: 12, status } } } })
    },
  },
}))

const renderCart = (state?: unknown) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[{ pathname: '/panier', state }]}><CartPage /></MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  me = null
  useCart.setState({ items: [{ productId: 11, slug: 'gamme-complete-dabo-hair', name: 'Gamme complète Dabo Hair', unitSize: '6 soins', price: 15000, memberPrice: 10000, quantity: 1 }] })
})

describe('Panier : prix membre', () => {
  it('sans compte : l’encart invite à créer un compte, on peut toujours commander à 15 000 F', async () => {
    status = 'sign_in'
    renderCart()
    expect(await screen.findByRole('heading', { name: /Payez 10\s000\sF CFA au lieu de 15\s000\sF CFA/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Créer mon compte gratuit' })).toHaveAttribute('href', '/inscription?redirect=/panier')
    expect(screen.getByRole('link', { name: /Commander sans compte · 15\s000\sF CFA/ })).toBeInTheDocument()
  })

  it('connectée et y a droit : 1 gamme à 10 000 F, la remise apparaît dans le total, message de bienvenue', async () => {
    status = 'eligible'
    me = { id: 7, first_name: 'Mariama', last_name: null, email: null, phone: '771234567', roles: ['customer'], permissions: [] }
    renderCart({ welcome: true })
    expect(await screen.findByText('Bienvenue Mariama : votre prix membre est appliqué.')).toBeInTheDocument()
    // Le prix est dans un <span> à part (insécable) : on compare le texte complet de la ligne
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && /^1 au prix membre : 10\s000\sF CFA$/.test(el.textContent ?? ''))).toBeInTheDocument()
    expect(screen.getByText(/−5\s000\sF CFA/)).toBeInTheDocument()
    expect(screen.queryByText(/Payez 10/)).not.toBeInTheDocument()
  })

  it('déjà utilisé sur ce compte : prix normal, avec l’explication', async () => {
    status = 'already_used'
    me = { id: 7, first_name: 'Mariama', last_name: null, email: null, phone: '771234567', roles: ['customer'], permissions: [] }
    renderCart()
    expect(await screen.findByText('Prix membre déjà utilisé sur ce compte (une gamme par compte)')).toBeInTheDocument()
    expect(screen.queryByText(/−5/)).not.toBeInTheDocument()
  })
})
