/** Les publicités de l'accueil lisent src/content/home.ts : on vérifie le branchement texte, image, prix et navigation */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Ad, homeContent } from '@/content/home'
import { currentAds } from '@/features/home/currentAds'
import { HomePage } from './HomePage'

// Aucune requête réelle : les sections produits / horaires restent en chargement, le hero s'affiche quand même
vi.mock('@/lib/http', async (orig) => ({ ...(await orig<typeof import('@/lib/http')>()), http: { get: () => new Promise(() => {}) } }))

const renderHome = () =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><HomePage /></MemoryRouter></QueryClientProvider>)

describe('Publicités de l’accueil', () => {
  const original = structuredClone(homeContent.ads)
  /** La publicité standard (sans promotion) du fichier de contenu, base des scénarios */
  const standard = (): Ad => structuredClone(original.find((a) => !a.promo)!)
  const promo = (over: Partial<NonNullable<Ad['promo']>> = {}): Ad => ({
    ...standard(), visible: true, title: 'La gamme en promotion', price: '10 000 F CFA',
    promo: { oldPrice: '15 000 F', saving: '−5 000 F', limit: 20, remaining: null, ...over },
  })
  const setAds = (...ads: Ad[]) => homeContent.ads.splice(0, homeContent.ads.length, ...ads)
  beforeEach(() => { setAds(...structuredClone(original)) })

  it('le fichier de contenu : la promotion est préparée mais masquée, la gamme à 15 000 F est affichée', () => {
    renderHome()
    const shown = currentAds(homeContent.ads)
    expect(shown).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: shown[0]!.title })).toBeInTheDocument()
    expect(screen.getByText('15 000 F CFA')).toBeInTheDocument()
    expect(screen.queryByText('10 000 F CFA')).not.toBeInTheDocument()
  })

  it('affiche la publicité, son bouton et les engagements', () => {
    const ad = standard()
    setAds(ad)
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: ad.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(ad.primary.label) })).toHaveAttribute('href', ad.primary.to)
    for (const c of homeContent.commitments) expect(screen.getByText(c)).toBeInTheDocument()
  })

  it('photo chargée en priorité, version verticale pour les téléphones, texte alternatif', () => {
    const ad = standard()
    setAds(ad)
    const { container } = renderHome()
    const img = screen.getByRole('img', { name: ad.imageAlt })
    expect(img).toHaveAttribute('src', ad.imageWide)
    expect(img).toHaveAttribute('fetchpriority', 'high')
    expect(container.querySelector('source')).toHaveAttribute('srcset', ad.imageTall)
  })

  it('le prix n’apparaît que lorsqu’il est renseigné', () => {
    setAds({ ...standard(), price: null })
    const { unmount } = renderHome()
    expect(screen.queryByText(/F CFA/)).not.toBeInTheDocument()
    unmount()
    setAds({ ...standard(), price: '12 345 F CFA' })
    renderHome()
    expect(screen.getByText('12 345 F CFA')).toBeInTheDocument()
  })

  it('promotion : ancien prix barré lu « au lieu de », économie, pas de compteur sans stock réel', () => {
    setAds(promo())
    const { container, unmount } = renderHome()
    expect(screen.getByText('10 000 F CFA')).toBeInTheDocument()
    expect(container.querySelector('s')).toHaveTextContent('au lieu de 15 000 F')
    expect(screen.getByText('−5 000 F')).toBeInTheDocument()
    expect(screen.queryByText(/Plus que/)).not.toBeInTheDocument()
    unmount()
    setAds(promo({ remaining: 12 }))
    renderHome()
    expect(screen.getByText('Plus que 12 gammes sur 20')).toBeInTheDocument()
  })

  it('masque une publicité invisible, hors de ses dates ou dont la promotion est épuisée', () => {
    const ads = [
      { ...standard(), title: 'A' },
      { ...standard(), title: 'Masquée', visible: false },
      { ...standard(), title: 'Pas commencée', startsAt: '2026-12-01' },
      { ...standard(), title: 'Terminée', endsAt: '2026-11-09' },
      { ...standard(), title: 'En cours', startsAt: '2026-11-10', endsAt: '2026-11-10' },
      { ...promo({ remaining: 0 }), title: 'Épuisée' },
    ]
    expect(currentAds(ads, '2026-11-10').map((a) => a.title)).toEqual(['A', 'En cours'])
  })

  it('une seule publicité : pas de flèches ; plusieurs : on passe de l’une à l’autre', () => {
    setAds(standard())
    const { unmount } = renderHome()
    expect(screen.queryByRole('button', { name: 'Publicité suivante' })).not.toBeInTheDocument()
    unmount()
    setAds(standard(), { ...standard(), title: 'Le masque à la kératine' })
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Publicité suivante' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Le masque à la kératine' })).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Publicité suivante' })) // revient à la première
    expect(screen.getByRole('heading', { level: 1, name: standard().title })).toBeInTheDocument()
  })
})
