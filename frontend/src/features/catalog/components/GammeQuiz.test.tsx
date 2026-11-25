/** « Quelle gamme pour moi ? » : 2 questions, UNE gamme ; jamais une gamme absente ou en rupture */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { ProductSummary } from '@/types/api'
import { catalogKeys } from '../hooks'
import { GammeQuiz } from './GammeQuiz'

const gamme = (slug: string, name: string, stock_status: ProductSummary['stock_status'] = 'in_stock') =>
  ({ id: slug.length, slug, name, price: 15000, is_bundle: true, stock_status, unit_size: '4 soins', image_url: null, bundle_contents: ['Crème', 'Spray'] }) as unknown as ProductSummary

const renderQuiz = (gammes: ProductSummary[]) => {
  // Données déjà chargées et jamais périmées : aucun rechargement vers un vrai serveur pendant le test
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  qc.setQueryData(catalogKeys.products({ category: 'gammes', sort: 'newest' }), { data: gammes, meta: { current_page: 1, last_page: 1, per_page: 12, total: gammes.length } })
  return render(<QueryClientProvider client={qc}><MemoryRouter><GammeQuiz /></MemoryRouter></QueryClientProvider>)
}

describe('GammeQuiz', () => {
  it('aucune gamme du questionnaire en vente : rien ne s’affiche', () => {
    const { container } = renderQuiz([gamme('gamme-complete-dabo-hair', 'Gamme complète')])
    expect(container).toBeEmptyDOMElement()
  })

  it('les réponses sans gamme sont masquées ; « Pour moi » puis l’objectif donne UNE gamme', () => {
    renderQuiz([gamme('gamme-au-coco', 'Gamme au coco'), gamme('gamme-locs', 'Gamme Locs'), gamme('gamme-a-la-palme', 'Gamme à la palme', 'out_of_stock')])
    expect(screen.queryByRole('button', { name: 'Mon enfant' })).not.toBeInTheDocument() // Salma Hair absente
    fireEvent.click(screen.getByRole('button', { name: 'Pour moi' }))
    expect(screen.queryByRole('button', { name: 'Faire pousser' })).not.toBeInTheDocument() // palme en rupture
    fireEvent.click(screen.getByRole('button', { name: 'Longueur et volume' }))
    expect(screen.getByText('Gamme au coco')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Ajouter au panier' })).toHaveLength(1)
  })

  it('« Mes locs » mène directement à la gamme Locs, sans 2e question', () => {
    renderQuiz([gamme('gamme-locs', 'Gamme Locs')])
    fireEvent.click(screen.getByRole('button', { name: 'Mes locs' }))
    expect(screen.queryByText('2. Ce que vous voulez')).not.toBeInTheDocument()
    expect(screen.getByText('Gamme Locs')).toBeInTheDocument()
  })
})
