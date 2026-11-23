/** Carrousel de l'accueil (maquette validée le 24 novembre 2026) : la gamme au prix membre passe en tête, sans doublon */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { type Ad, homeContent } from '@/content/home'
import { AdCarousel } from './AdCarousel'

const base = structuredClone(homeContent.ads.find((a) => a.visible !== false && !a.promo)!) as Ad
const lead = { label: 'Offre de lancement', render: (first: boolean) => first ? <h1>Offre membre</h1> : <h2>Offre membre</h2> }

describe('AdCarousel avec l’offre de lancement', () => {
  it('l’offre passe en premier (titre principal) et la publicité classique de la même gamme se retire', () => {
    render(<MemoryRouter><AdCarousel ads={[{ ...base, title: 'Gamme classique', hiddenDuringMemberOffer: true }, { ...base, title: 'Gamme coco', hiddenDuringMemberOffer: false }]} lead={lead} /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Offre membre' })).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument() // offre + coco ; la classique est retirée
    expect(screen.queryByText('Gamme classique')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicité 1 : Offre de lancement' })).toHaveAttribute('aria-current', 'true')
  })

  it('sans offre active, la publicité classique revient', () => {
    render(<MemoryRouter><AdCarousel ads={[{ ...base, title: 'Gamme classique', hiddenDuringMemberOffer: true }]} lead={null} /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Gamme classique' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mettre en pause le défilement' })).not.toBeInTheDocument() // une seule : ni pause ni flèches
  })
})
