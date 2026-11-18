/** Réservation par une cliente connectée : ses coordonnées sont reprises de son compte (18 novembre 2026) */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ME_KEY } from '@/features/auth/hooks'
import { ContactStep } from './ContactStep'

const renderStep = (me: unknown) => {
  const qc = new QueryClient()
  qc.setQueryData(ME_KEY, me) // la session est déjà connue : pas d'appel réseau
  return render(<QueryClientProvider client={qc}><ContactStep formId="f" onSubmit={() => {}} /></QueryClientProvider>)
}

describe('Réservation : coordonnées', () => {
  it('cliente connectée : tout est prérempli depuis son compte', async () => {
    renderStep({ id: 3, first_name: 'Mariama', last_name: 'Sow', email: 'mariama@client.test', phone: '770000003', roles: ['customer'], permissions: [] })
    await waitFor(() => expect(screen.getByLabelText('Prénom *')).toHaveValue('Mariama'))
    expect(screen.getByLabelText('Nom *')).toHaveValue('Sow')
    expect(screen.getByLabelText('Téléphone mobile *')).toHaveValue('770000003')
    expect(screen.getByLabelText('Email (facultatif)')).toHaveValue('mariama@client.test')
    expect(screen.getByText(/Coordonnées reprises de votre compte/)).toBeInTheDocument()
  })

  it('visiteuse sans compte : formulaire vide', () => {
    renderStep(null)
    expect(screen.getByLabelText('Prénom *')).toHaveValue('')
    expect(screen.queryByText(/Coordonnées reprises/)).not.toBeInTheDocument()
  })
})
