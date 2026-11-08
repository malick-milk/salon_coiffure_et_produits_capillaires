/** Étape 13 : enquête de satisfaction (formulaire accessible, une seule réponse) et avis publics */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewCard } from './components/ReviewCard'
import { ReviewsSummaryBlock } from './components/ReviewsSummaryBlock'
import { formatRating } from './format'
import { SurveyPage } from './pages/SurveyPage'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/http', async (orig) => ({ ...(await orig<typeof import('@/lib/http')>()), http: { get, post } }))

const TOKEN = 'a'.repeat(40)
const renderSurvey = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/avis/${TOKEN}`]}><Routes><Route path="/avis/:token" element={<SurveyPage />} /></Routes></MemoryRouter>
    </QueryClientProvider>,
  )

describe('Enquête de satisfaction', () => {
  beforeEach(() => {
    get.mockReset(); post.mockReset()
    get.mockResolvedValue({ data: { data: { kind: 'booking', subject_label: 'Micro twist', first_name: 'Mariama', state: 'open' } } })
  })

  it('exige une note, puis envoie la réponse et remercie la cliente', async () => {
    const user = userEvent.setup()
    post.mockResolvedValue({ data: { data: { state: 'answered', follow_up: false } } })
    renderSurvey()

    expect(await screen.findByRole('heading', { name: /Mariama, comment s’est passé votre passage au salon/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Envoyer mon avis' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choisissez une note')
    expect(post).not.toHaveBeenCalled()

    await user.click(screen.getByRole('radio', { name: /5 sur 5 : Ravie/ }))
    await user.click(screen.getByRole('radio', { name: '10' }))
    await user.type(screen.getByRole('textbox'), '  Parfait  ')
    await user.click(screen.getByRole('checkbox', { name: /J’accepte que mon avis soit publié/ }))
    await user.click(screen.getByRole('button', { name: 'Envoyer mon avis' }))

    expect(post).toHaveBeenCalledWith(`/surveys/${TOKEN}`, { rating: 5, nps: 10, comment: 'Parfait', publish_consent: true })
    expect(await screen.findByRole('status')).toHaveTextContent('Merci pour votre avis')
  })

  it('note basse : la cliente est prévenue qu’on va la rappeler', async () => {
    const user = userEvent.setup()
    post.mockResolvedValue({ data: { data: { state: 'answered', follow_up: true } } })
    renderSurvey()
    await user.click(await screen.findByRole('radio', { name: /2 sur 5/ }))
    await user.click(screen.getByRole('button', { name: 'Envoyer mon avis' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Le salon va vous appeler')
    expect(post.mock.calls[0]?.[1]).toMatchObject({ rating: 2, nps: null, comment: null, publish_consent: false })
  })

  it('lien déjà utilisé ou expiré : pas de formulaire', async () => {
    get.mockResolvedValueOnce({ data: { data: { kind: 'order', subject_label: 'Commande', first_name: null, state: 'expired' } } })
    renderSurvey()
    expect(await screen.findByText('Ce lien a expiré')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Envoyer mon avis' })).not.toBeInTheDocument()
  })
})

describe('Avis publics', () => {
  it('affiche l’auteur abrégé, la note accessible et la réponse du salon', () => {
    render(<ReviewCard review={{ id: 1, author: 'Aïssatou D.', kind: 'booking', subject_label: 'Micro twist', rating: 4, comment: 'Très bien', reply: 'Merci !', date: '2026-11-05' }} />)
    expect(screen.getByRole('img', { name: '4 étoiles sur 5' })).toBeInTheDocument()
    expect(screen.getByText(/Avis vérifié/)).toBeInTheDocument()
    expect(screen.getByText('Réponse de Dabo Hair')).toBeInTheDocument()
  })

  it('résumé : moyenne à la française et répartition des étoiles', () => {
    render(<ReviewsSummaryBlock summary={{ average: 4.5, answered_count: 2, published_count: 1, distribution: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 } }} />)
    expect(screen.getByText('4,5')).toBeInTheDocument()
    expect(screen.getByText(/2 clientes interrogées/)).toBeInTheDocument()
    expect(formatRating(null)).toBe('–')
  })
})
