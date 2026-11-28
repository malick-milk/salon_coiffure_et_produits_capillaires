/** Case « nouveautés et offres » : jamais cochée d'avance, facultative, masquée si la cliente a déjà accepté */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ME_KEY } from '@/features/auth/hooks'
import type { Preferences, User } from '@/types/api'
import { MarketingConsentBox } from './MarketingConsentBox'

const renderBox = (prefs?: Partial<Preferences>) => {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  qc.setQueryData(ME_KEY, prefs ? ({ id: 1, first_name: 'Mariama', roles: ['customer'], permissions: [] } as unknown as User) : null)
  if (prefs) qc.setQueryData(['me', 'preferences'], { resserrage_reminders: true, marketing_email: false, marketing_text: '', last_change: null, ...prefs })
  return render(<QueryClientProvider client={qc}><MarketingConsentBox name="marketing_consent" /></QueryClientProvider>)
}

describe('MarketingConsentBox', () => {
  it('visiteuse : case visible, non cochée, distincte, avec le texte exact', () => {
    renderBox()
    const box = screen.getByRole('checkbox', { name: /nouveautés et offres/ })
    expect(box).not.toBeChecked()
    expect(box).not.toBeRequired()
    expect(screen.getByText(/2 par mois au plus/)).toBeInTheDocument()
    expect(screen.getByText(/Désinscription en un clic/)).toBeInTheDocument()
  })
  it('cliente connectée qui a déjà accepté : on ne redemande pas', () => {
    const { container } = renderBox({ marketing_email: true })
    expect(container).toBeEmptyDOMElement()
  })
  it('cliente connectée qui n’a pas accepté : la case reste proposée', () => {
    renderBox({ marketing_email: false })
    expect(screen.getByRole('checkbox', { name: /nouveautés et offres/ })).not.toBeChecked()
  })
})
