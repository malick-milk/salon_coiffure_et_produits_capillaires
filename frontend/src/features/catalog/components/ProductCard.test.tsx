import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { useCart } from '@/features/cart/store'
import type { ProductSummary } from '@/types/api'
import { ProductCard } from './ProductCard'

const product: ProductSummary = {
  id: 10, slug: 'serum-activ-pousse-30-ml', sku: 'DAB-SAP-030', name: 'Sérum Activ’Pousse', brand: { name: 'Dabo Hair', slug: 'dabo-hair' },
  unit_size: '30 ml', price: 3000, compare_at_price: null, stock_status: 'in_stock', stock_left: null, is_featured: true,
  category: { id: 6, name: 'Sérums', slug: 'serums' }, image_url: null,
}
const renderCard = (p: ProductSummary) => render(<MemoryRouter><ProductCard product={p} /></MemoryRouter>)

describe('ProductCard', () => {
  beforeEach(() => useCart.getState().clear())

  it('affiche le nom, la contenance et le prix formaté', () => {
    renderCard(product)
    expect(screen.getByRole('heading', { name: /Sérum Activ’Pousse 30 ml/ })).toBeInTheDocument()
    expect(screen.getByText('3 000 F CFA')).toBeInTheDocument()
  })

  it('le bouton ajoute le produit au panier', async () => {
    renderCard(product)
    await userEvent.click(screen.getByRole('button', { name: /Ajouter Sérum/ }))
    expect(useCart.getState().items[0]?.productId).toBe(10)
  })

  it('un produit en rupture ne peut pas être ajouté (RG-STK-04)', () => {
    renderCard({ ...product, stock_status: 'out_of_stock' })
    expect(screen.getByRole('button', { name: /Ajouter/ })).toBeDisabled()
    expect(screen.getByText('Rupture de stock')).toBeInTheDocument()
  })

  it('stock faible : affiche le nombre restant', () => {
    renderCard({ ...product, stock_status: 'low_stock', stock_left: 4 })
    expect(screen.getByText('Plus que 4 en stock')).toBeInTheDocument()
  })
})

describe('ProductCard : promotion (20 novembre 2026)', () => {
  const base = { id: 4, slug: 'spray', sku: 'DAB-SPH-250', name: 'Spray hydratant', brand: null, unit_size: '250 ml', price: 5000, compare_at_price: null,
    stock_status: 'in_stock' as const, stock_left: null, is_featured: true, category: { id: 1, name: 'Soins', slug: 'soins' }, image_url: null }
  const show = (applies: boolean, audience: 'all' | 'members' = 'all') =>
    render(<MemoryRouter><ProductCard product={{ ...base, promotion: { percent: 20, price: 4000, ends_on: '2026-12-31', audience, applies } }} /></MemoryRouter>)

  it('badge −20 %, prix promo, prix initial barré, date de fin', () => {
    show(true)
    expect(screen.getByText('−20 %')).toBeInTheDocument()
    expect(screen.getByText(/4\s000\sF CFA/)).toBeInTheDocument()
    expect(screen.getByText(/5\s000\sF CFA/).tagName).toBe('S')
    expect(screen.getByText('jusqu’au 31 déc.')).toBeInTheDocument()
    expect(screen.queryByText('Produit phare')).not.toBeInTheDocument()
  })

  it('promotion réservée aux membres, visiteuse sans compte : prix normal et invitation', () => {
    show(false, 'members')
    expect(screen.getByText(/5\s000\sF CFA/).tagName).toBe('STRONG')
    expect(screen.getByText('−20 % pour les membres')).toBeInTheDocument()
  })
})
