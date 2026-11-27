/** Page « Nos gammes » (maquette validée le 27 novembre 2026) : toutes les gammes, filtres, ajout direct au panier */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCart } from '@/features/cart/store'
import type { ProductSummary } from '@/types/api'
import { catalogKeys } from '../hooks'
import { GammesPage } from './GammesPage'

let nextId = 1
const gamme = (name: string, price: number, extra: Partial<ProductSummary> = {}) =>
  ({ id: nextId++, slug: name.toLowerCase().replace(/\s+/g, '-'), name, price, is_bundle: true, stock_status: 'in_stock', unit_size: 'Gamme', image_url: null,
    short_description: null, bundle_contents: ['Crème', 'Spray'], member_price: null, member_offer: null, promotion: null, ...extra }) as unknown as ProductSummary

const renderPage = (gammes: ProductSummary[]) => {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  qc.setQueryData(catalogKeys.products({ category: 'gammes', sort: 'newest' }), { data: gammes, meta: { current_page: 1, last_page: 1, per_page: 12, total: gammes.length } })
  return render(<QueryClientProvider client={qc}><MemoryRouter><GammesPage /></MemoryRouter></QueryClientProvider>)
}

describe('GammesPage', () => {
  beforeEach(() => useCart.setState({ items: [] }))

  it('montre toutes les gammes et filtre par base', () => {
    renderPage([gamme('Gamme au coco', 15000), gamme('Gamme à l’avocat', 15000), gamme('Gamme Locs', 13000, { stock_status: 'out_of_stock' })])
    const list = screen.getByRole('list', { name: 'Gammes' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Bientôt de retour')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Coco' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Toutes (3)' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('« Ajouter au panier » met la gamme au panier, sans quitter la page', () => {
    renderPage([gamme('Gamme au coco', 15000, { short_description: 'Longueur et volume' })])
    // Deux boutons (ordinateur / téléphone, un seul visible selon la largeur : jsdom n'applique pas les classes CSS)
    const buttons = screen.getAllByRole('button', { name: 'Ajouter au panier : Gamme au coco' })
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[0]!)
    expect(useCart.getState().items.map((i) => i.name)).toEqual(['Gamme au coco'])
    expect(screen.getByRole('status')).toHaveTextContent('Gamme au coco ajoutée au panier.')
    expect(screen.getByRole('link', { name: /Ajoutée · Voir le panier/ })).toHaveAttribute('href', '/panier')
  })

  it('une gamme en rupture ne propose pas l’ajout', () => {
    renderPage([gamme('Gamme Locs', 13000, { stock_status: 'out_of_stock' })])
    expect(screen.queryByRole('button', { name: /Ajouter au panier/ })).not.toBeInTheDocument()
  })
})
