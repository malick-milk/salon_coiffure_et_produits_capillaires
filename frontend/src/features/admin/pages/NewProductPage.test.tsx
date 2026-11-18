/** Écran « Nouveau produit » : règles de la maquette validée (brouillon, publier exige une photo, aperçu réel) */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { NewProductPage } from './NewProductPage'

const DATA: Record<string, unknown> = {
  '/admin/brands': [{ id: 1, name: 'Dabo Hair', is_house_brand: true }, { id: 2, name: 'Virgin Hair Fertilizer', is_house_brand: false }],
  '/admin/categories': [{ id: 7, name: 'Soins traitants' }, { id: 5, name: 'Sérums' }],
}
vi.mock('@/lib/http', async (orig) => ({
  ...(await orig<typeof import('@/lib/http')>()),
  http: { get: (url: string) => Promise.resolve({ data: { data: DATA[url] ?? [] } }), post: vi.fn(), patch: vi.fn() },
}))

const renderPage = () =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><NewProductPage /></MemoryRouter></QueryClientProvider>)

describe('Nouveau produit', () => {
  it('la marque maison est proposée, « Publier » reste grisé sans photo, le brouillon est possible', async () => {
    renderPage()
    expect(await screen.findByRole('option', { name: 'Virgin Hair Fertilizer' })).toBeInTheDocument()
    expect(screen.getByLabelText('Marque')).toHaveValue('1') // Dabo Hair : origine « fabriqué » par défaut

    const draft = screen.getByRole('button', { name: 'Enregistrer en brouillon' })
    const publish = screen.getByRole('button', { name: 'Publier' })
    expect(draft).toBeDisabled() // fiche vide
    fireEvent.change(screen.getByLabelText('Nom du produit'), { target: { value: 'Huile de croissance' } })
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Prix de vente (F CFA)'), { target: { value: '6000' } })
    expect(draft).toBeDisabled() // prix d'achat obligatoire
    fireEvent.change(screen.getByLabelText('Prix d’achat unitaire (F) · obligatoire'), { target: { value: '2500' } })
    expect(draft).toBeEnabled()
    expect(publish).toBeDisabled() // aucune photo
  })

  it('la marge s’affiche en direct ; une vente à perte est signalée sans bloquer l’enregistrement', async () => {
    renderPage()
    await screen.findByRole('option', { name: 'Virgin Hair Fertilizer' })
    fireEvent.change(screen.getByLabelText('Nom du produit', { exact: true }), { target: { value: 'Huile de croissance' } })
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Prix d’achat unitaire (F) · obligatoire'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Prix de vente (F CFA)'), { target: { value: '6000' } })
    expect(screen.getByText(/3\s500\sF CFA · 58,3 % du prix de vente/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Prix de vente (F CFA)'), { target: { value: '2000' } })
    expect(screen.getByText('Attention : vendu à perte')).toBeInTheDocument()
    expect(screen.getByText(/500\sF CFA de perte par unité/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enregistrer en brouillon' })).toBeEnabled() // option (a) : avertir, pas bloquer
  })

  it('l’aperçu est la vraie carte de la boutique et suit la saisie', async () => {
    renderPage()
    await screen.findByRole('option', { name: 'Virgin Hair Fertilizer' })
    fireEvent.click(screen.getByLabelText(/Acheté et revendu/))
    fireEvent.change(screen.getByLabelText('Marque'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Nom du produit'), { target: { value: 'Huile de croissance' } })
    fireEvent.change(screen.getByLabelText('Contenance'), { target: { value: '120 ml' } })
    fireEvent.change(screen.getByLabelText('Prix de vente (F CFA)'), { target: { value: '6000' } })

    const preview = screen.getByRole('heading', { name: 'Aperçu dans la boutique' }).closest('section')!
    expect(within(preview).getByText('Virgin Hair Fertilizer')).toBeInTheDocument()
    expect(within(preview).getByText('Huile de croissance')).toBeInTheDocument()
    expect(within(preview).getByText(/6\s000\sF CFA/)).toBeInTheDocument()
    expect(within(preview).getByText('0 · à recevoir par un achat')).toBeInTheDocument()
  })

  it('« + Nouvelle marque… » ouvre le champ de création', async () => {
    renderPage()
    await screen.findByRole('option', { name: 'Virgin Hair Fertilizer' })
    fireEvent.change(screen.getByLabelText('Marque'), { target: { value: 'new' } })
    expect(screen.getByLabelText('Nom de la nouvelle marque')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled()
  })
})
