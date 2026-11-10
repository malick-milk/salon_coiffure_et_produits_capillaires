/** Les publicités de l'accueil lisent src/content/home.ts : on vérifie le branchement texte, image, prix et navigation */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { homeContent } from '@/content/home'
import { HomePage } from './HomePage'

// Aucune requête réelle : les sections produits / horaires restent en chargement, le hero s'affiche quand même
vi.mock('@/lib/http', async (orig) => ({ ...(await orig<typeof import('@/lib/http')>()), http: { get: () => new Promise(() => {}) } }))

const renderHome = () =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><HomePage /></MemoryRouter></QueryClientProvider>)

describe('Publicités de l’accueil', () => {
  const original = structuredClone(homeContent.ads)
  beforeEach(() => { homeContent.ads.splice(0, homeContent.ads.length, ...structuredClone(original)) })

  it('affiche la publicité du fichier de contenu, son bouton et les engagements', () => {
    renderHome()
    const ad = homeContent.ads[0]!
    expect(screen.getByRole('heading', { level: 1, name: ad.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(ad.primary.label) })).toHaveAttribute('href', ad.primary.to)
    for (const c of homeContent.commitments) expect(screen.getByText(c)).toBeInTheDocument()
  })

  it('photo chargée en priorité, version verticale pour les téléphones, texte alternatif', () => {
    const { container } = renderHome()
    const ad = homeContent.ads[0]!
    const img = screen.getByRole('img', { name: ad.imageAlt })
    expect(img).toHaveAttribute('src', ad.imageWide)
    expect(img).toHaveAttribute('fetchpriority', 'high')
    expect(container.querySelector('source')).toHaveAttribute('srcset', ad.imageTall)
  })

  it('le prix n’apparaît que lorsqu’il est renseigné', () => {
    const { unmount } = renderHome()
    expect(screen.queryByText(/F CFA/)).not.toBeInTheDocument()
    unmount()
    homeContent.ads[0]!.price = '15 000 F CFA'
    renderHome()
    expect(screen.getByText('15 000 F CFA')).toBeInTheDocument()
  })

  it('une seule publicité : pas de flèches ; plusieurs : on passe de l’une à l’autre', async () => {
    const { unmount } = renderHome()
    expect(screen.queryByRole('button', { name: 'Publicité suivante' })).not.toBeInTheDocument()
    unmount()
    homeContent.ads.push({ ...homeContent.ads[0]!, title: 'Le masque à la kératine' })
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Publicité suivante' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Le masque à la kératine' })).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Publicité suivante' })) // revient à la première
    expect(screen.getByRole('heading', { level: 1, name: homeContent.ads[0]!.title })).toBeInTheDocument()
  })
})
