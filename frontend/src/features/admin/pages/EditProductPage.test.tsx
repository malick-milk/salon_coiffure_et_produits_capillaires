/** Écran « Modifier un produit » : règles de la maquette validée le 18 novembre 2026 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminProduct } from '@/types/admin'
import { describeEntry, EditProductPage } from './EditProductPage'

const product = (over: Partial<AdminProduct> = {}): AdminProduct => ({
  id: 9, sku: 'VHF-HUI-001', origin: 'resold', brand_id: 2, category_id: 7, images: [{ id: 1, url: '/storage/produits/a.webp', alt: null, is_primary: true }],
  name: 'Huile de croissance', unit_size: '120 ml', slug: 'huile-de-croissance-120-ml', category: 'Soins traitants', brand: 'Virgin Hair Fertilizer',
  price: 6000, compare_at_price: null, cost_price: 2750, margin_rate: 54.2, stock_quantity: 24, low_stock_threshold: 6, stock_status: 'in_stock',
  stock_entries_locked: true, is_active: true, is_featured: false, short_description: null, description: null, ...over,
})

let products: AdminProduct[] = []
const patch = vi.fn()
vi.mock('@/lib/http', async (orig) => ({
  ...(await orig<typeof import('@/lib/http')>()),
  http: {
    get: (url: string) => Promise.resolve({ data: { data: ({
      '/admin/products': products,
      '/admin/brands': [{ id: 1, name: 'Dabo Hair', is_house_brand: true }, { id: 2, name: 'Virgin Hair Fertilizer', is_house_brand: false }],
      '/admin/categories': [{ id: 7, name: 'Soins traitants' }],
    } as Record<string, unknown>)[url] ?? [] } }),
    patch: (...args: unknown[]) => patch(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/admin/produits/9/modifier']}>
        <Routes>
          <Route path="/admin/produits/:id/modifier" element={<EditProductPage />} />
          <Route path="/admin/produits" element={<p>Liste des produits</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => { patch.mockReset(); products = [product()] })

describe('Modifier un produit', () => {
  it('référence et adresse affichées « ne change pas » ; origine et coût verrouillés après une réception', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Modifier · Huile de croissance 120 ml' })).toBeInTheDocument()
    expect(screen.getByText('VHF-HUI-001')).toBeInTheDocument()
    expect(screen.getByText('verrouillé')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Coût de revient (F)')).not.toBeInTheDocument()
    expect(screen.getByText(/2\s750 F/)).toBeInTheDocument() // coût actuel, en lecture seule
  })

  it('« Enregistrer » reste grisé sans changement ; la marge montre avant et après ; seul le changement part', async () => {
    patch.mockResolvedValue({ data: { data: product({ price: 6500 }) } })
    renderPage()
    const save = await screen.findByRole('button', { name: 'Enregistrer les modifications' })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Prix de vente (F CFA)'), { target: { value: '6500' } })
    expect(screen.getByText('Marge par unité (nouveau prix)')).toBeInTheDocument()
    expect(screen.getByText(/3\s750\sF CFA · 57,7 % · avant : 3\s250\sF CFA · 54,2 %/)).toBeInTheDocument()

    fireEvent.click(save)
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/admin/products/9', { price: 6500 }))
    expect(await screen.findByText('Liste des produits')).toBeInTheDocument()
  })

  it('une vente à perte est signalée', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Prix de vente (F CFA)'), { target: { value: '2000' } })
    expect(screen.getByText('Attention : vendu à perte')).toBeInTheDocument()
  })

  it('avant le premier achat, l’origine et le coût se corrigent', async () => {
    products = [product({ stock_entries_locked: false, cost_price: 2500 })]
    patch.mockResolvedValue({ data: { data: products[0] } })
    renderPage()
    fireEvent.change(await screen.findByLabelText('Coût de revient (F)'), { target: { value: '2000' } })
    fireEvent.click(screen.getByLabelText(/Fabriqué par Dabo Hair/))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/admin/products/9', { origin: 'made', cost_price: 2000 }))
  })

  it('l’historique se lit comme une phrase', () => {
    expect(describeEntry({ event: 'updated', changes: [{ field: 'price', old: 5500, new: 6000 }] })).toBe('prix 5 500 → 6 000 F')
    expect(describeEntry({ event: 'updated', changes: [{ field: 'short_description', old: null, new: 'x' }] })).toBe('description courte modifiée')
    expect(describeEntry({ event: 'created', changes: [] })).toBe('fiche créée')
  })
})
