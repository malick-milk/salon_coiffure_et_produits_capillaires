/** « Il manque … » près du bouton (maquette validée le 24 novembre 2026) */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { missingFields } from '@/lib/missingFields'
import { MissingFieldsSummary } from './MissingFields'

const LABELS = { first_name: 'Votre prénom', last_name: 'Votre nom', phone: 'Votre téléphone', consent: 'Votre accord (case à cocher)' }

describe('missingFields', () => {
  it('suit l’ordre de la page (celui des libellés), pas celui des erreurs ; un champ inconnu garde son message', () => {
    const errors = { consent: { message: 'x' }, phone: { message: 'x' }, last_name: { message: 'x' }, city: { message: 'Indiquez la ville.' }, root: { message: 'ignorée' } }
    expect(missingFields(errors, LABELS).map((m) => m.label)).toEqual(['Votre nom', 'Votre téléphone', 'Votre accord (case à cocher)', 'Indiquez la ville.'])
  })
  it('rien ne manque : liste vide', () => {
    expect(missingFields({}, LABELS)).toEqual([])
  })
})

describe('MissingFieldsSummary', () => {
  it('« Il manque 2 informations », et chaque ligne amène sur le champ, curseur dedans', () => {
    render(<form><input name="last_name" aria-label="Nom" /><input name="consent" type="checkbox" aria-label="Accord" />
      <MissingFieldsSummary items={[{ name: 'last_name', label: 'Votre nom' }, { name: 'consent', label: 'Votre accord (case à cocher)' }]} reassurance="Votre panier est gardé : rien n’est perdu." /></form>)
    expect(screen.getByText('Il manque 2 informations')).toBeInTheDocument()
    expect(screen.getByText('Votre panier est gardé : rien n’est perdu.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Votre accord (case à cocher)' }))
    expect(document.activeElement).toBe(screen.getByLabelText('Accord'))
  })
  it('singulier pour une seule information ; rien du tout quand tout est bon', () => {
    const { rerender, container } = render(<MissingFieldsSummary items={[{ name: 'phone', label: 'Votre téléphone' }]} />)
    expect(screen.getByText('Il manque 1 information')).toBeInTheDocument()
    rerender(<MissingFieldsSummary items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
