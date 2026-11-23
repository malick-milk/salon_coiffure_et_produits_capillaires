/** Bug du 24 novembre 2026 : formulaire refusé sur téléphone, le curseur partait sur la DERNIÈRE case (en bas),
 * les erreurs du haut restaient hors de l'écran : le bouton semblait « ne rien faire ». */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { focusFirstInvalid, onInvalidFocus } from '@/lib/focusFirstInvalid'

const nextFrames = () => new Promise((r) => setTimeout(r, 60))

describe('focusFirstInvalid', () => {
  const form = (
    <form data-testid="f">
      <input aria-label="Prénom" aria-invalid="true" />
      <input aria-label="Valide" aria-invalid="false" />
      <input aria-label="Accord" type="checkbox" aria-invalid="true" />
    </form>
  )

  it('va au premier champ en erreur dans l’ordre de la page (pas à la dernière case) et le centre à l’écran', async () => {
    render(form)
    const first = screen.getByLabelText('Prénom')
    const scroll = vi.fn()
    first.scrollIntoView = scroll
    focusFirstInvalid(screen.getByTestId('f'))
    await nextFrames()
    expect(document.activeElement).toBe(first)
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
  })

  it('onInvalidFocus (2e argument de handleSubmit) retrouve le formulaire depuis l’événement', async () => {
    render(form)
    onInvalidFocus({}, { target: screen.getByTestId('f') })
    await nextFrames()
    expect(document.activeElement).toBe(screen.getByLabelText('Prénom'))
  })

  it('sans champ en erreur : ne bouge rien', async () => {
    render(<form><input aria-label="Ok" /></form>)
    focusFirstInvalid()
    await nextFrames()
    expect(document.activeElement).toBe(document.body)
  })
})
