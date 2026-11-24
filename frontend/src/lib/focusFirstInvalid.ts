/**
 * Formulaire refusé : amène la visiteuse sur le PREMIER champ en erreur, dans l'ordre de la page
 * (bug du 24 novembre 2026 : sur téléphone, le curseur partait sur la dernière case, en bas ; les erreurs
 * du prénom et du nom restaient hors de l'écran et le bouton semblait « ne rien faire »).
 * On attend que React ait affiché les erreurs (aria-invalid), puis on centre le champ et on y place le curseur.
 */
export function focusFirstInvalid(form?: Element | null) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const field = (form ?? document).querySelector<HTMLElement>('[aria-invalid="true"]')
    if (!field) return
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    field.scrollIntoView?.({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
    field.focus({ preventScroll: true })
  }))
}

/** À passer en 2e argument de handleSubmit : handleSubmit(onSubmit, onInvalidFocus) */
export function onInvalidFocus(_errors: unknown, event?: { target?: EventTarget | null }) {
  focusFirstInvalid(event?.target instanceof Element ? event.target.closest('form') : null)
}

/** Amène sur le champ nommé (attribut name posé par react-hook-form) : centré à l'écran, curseur dedans */
export function goToField(name: string) {
  const field = document.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`)
  if (!field) return
  const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  field.scrollIntoView?.({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
  field.focus({ preventScroll: true })
}
