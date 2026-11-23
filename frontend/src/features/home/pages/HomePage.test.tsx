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
    // Un seul titre principal (h1) dans la page : les publicités suivantes sont des h2
    expect(screen.queryByRole('heading', { name: 'Le masque à la kératine' })).not.toBeInTheDocument() // cachée : ignorée des lecteurs d'écran
    fireEvent.click(screen.getByRole('button', { name: 'Publicité suivante' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Le masque à la kératine' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument() // la 1re est maintenant cachée
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Publicité suivante' })) // revient à la première
    expect(screen.getByRole('heading', { level: 1, name: standard().title })).toBeInTheDocument()
  })

  // Carrousel (maquette validée le 24 novembre 2026) : défilement toutes les 10 s, pause, pas de doublon
  it('défilement automatique : la fin de la barre dorée (10 s) passe à la publicité suivante', () => {
    setAds(standard(), { ...standard(), title: 'Deuxième' })
    renderHome()
    fireEvent.animationEnd(screen.getByTestId('carousel-progress'))
    expect(screen.getByRole('heading', { level: 2, name: 'Deuxième' })).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    fireEvent.animationEnd(screen.getByTestId('carousel-progress')) // et on recommence au début
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('bouton Pause : fige le défilement, le compteur est alors annoncé ; Reprendre relance', () => {
    setAds(standard(), { ...standard(), title: 'Deuxième' })
    renderHome()
    const carousel = screen.getByRole('region', { name: 'Offres du moment' })
    expect(carousel).toHaveAttribute('data-paused', 'false')
    expect(screen.getByText('1 / 2')).toHaveAttribute('aria-live', 'off') // pas d'annonce toutes les 10 s
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause le défilement' }))
    expect(carousel).toHaveAttribute('data-paused', 'true')
    expect(screen.getByText('1 / 2')).toHaveAttribute('aria-live', 'polite')
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre le défilement' }))
    expect(carousel).toHaveAttribute('data-paused', 'false')
  })

  it('pause aussi quand la souris est dessus ou quand on navigue au clavier dedans', () => {
    setAds(standard(), { ...standard(), title: 'Deuxième' })
    renderHome()
    const carousel = screen.getByRole('region', { name: 'Offres du moment' })
    fireEvent.mouseEnter(carousel)
    expect(carousel).toHaveAttribute('data-paused', 'true')
    fireEvent.mouseLeave(carousel)
    expect(carousel).toHaveAttribute('data-paused', 'false')
    fireEvent.focus(screen.getByRole('button', { name: 'Publicité suivante' }))
    expect(carousel).toHaveAttribute('data-paused', 'true')
  })

  it('téléphone : glisser vers la gauche montre la suivante, vers la droite la précédente', () => {
    setAds(standard(), { ...standard(), title: 'Deuxième' })
    renderHome()
    const carousel = screen.getByRole('region', { name: 'Offres du moment' })
    fireEvent.touchStart(carousel, { touches: [{ clientX: 300 }] })
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 100 }] })
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    fireEvent.touchStart(carousel, { touches: [{ clientX: 100 }] })
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 120 }] }) // trop court : rien ne change
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    fireEvent.touchStart(carousel, { touches: [{ clientX: 100 }] })
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 300 }] })
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('« réduire les animations » : pas de défilement automatique ni de bouton Pause, les flèches restent', () => {
    const mm = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    try {
      setAds(standard(), { ...standard(), title: 'Deuxième' })
      renderHome()
      expect(screen.queryByTestId('carousel-progress')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Mettre en pause le défilement' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Publicité suivante' })).toBeInTheDocument()
    } finally { window.matchMedia = mm }
  })

  it('le fichier de contenu : la publicité de la gamme se retire pendant l’offre membre (pas de doublon)', () => {
    expect(homeContent.ads.find((a) => a.visible !== false && !a.promo)?.hiddenDuringMemberOffer).toBe(true)
  })

  it('bannière promotionnelle : image du fichier de contenu, texte alternatif et lien', () => {
    renderHome()
    const { promoBanner } = homeContent
    const img = screen.getByRole('img', { name: promoBanner.imageAlt })
    expect(img).toHaveAttribute('src', promoBanner.image)
    expect(img.closest('a')).toHaveAttribute('href', promoBanner.link)
  })
})
