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
