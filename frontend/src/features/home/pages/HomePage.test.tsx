/** La section hero lit src/content/home.ts : on vérifie le branchement texte + image */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { homeContent } from '@/content/home'
import { HomePage } from './HomePage'

// Aucune requête réelle : les sections produits / horaires restent en chargement, le hero s'affiche quand même
vi.mock('@/lib/http', async (orig) => ({ ...(await orig<typeof import('@/lib/http')>()), http: { get: () => new Promise(() => {}) } }))

const renderHome = () =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><HomePage /></MemoryRouter></QueryClientProvider>)

describe('Hero de la page d’accueil', () => {
  beforeEach(() => { homeContent.hero.image = null })

  it('affiche les textes du fichier de contenu', () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: homeContent.hero.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(homeContent.hero.primaryButton) })).toHaveAttribute('href', '/reserver')
    for (const c of homeContent.commitments) expect(screen.getByText(c)).toBeInTheDocument()
  })

  it('sans photo : emplacement provisoire ; avec photo : image chargée en priorité, avec texte alternatif', () => {
    const { unmount } = renderHome()
    expect(screen.getByRole('img', { name: 'Image hero' })).toBeInTheDocument()
    unmount()

    homeContent.hero.image = '/images/hero.webp'
    renderHome()
    const img = screen.getByRole('img', { name: homeContent.hero.imageAlt })
    expect(img).toHaveAttribute('src', '/images/hero.webp')
    expect(img).toHaveAttribute('fetchpriority', 'high')
  })
})
