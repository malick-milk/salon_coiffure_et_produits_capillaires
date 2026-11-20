/**
 * SUIVI DES ERREURS du navigateur (21 novembre 2026) : une erreur JavaScript chez une visiteuse est envoyée à NOTRE
 * serveur (POST /api/v1/client-errors), qui la masque, la regroupe et prévient la propriétaire par e-mail.
 *
 * - Seulement sur le vrai site (build de production), ou en développement si VITE_REPORT_ERRORS=true.
 * - Au plus 10 envois par visite, une seule fois par erreur : jamais d'avalanche.
 * - Seulement le CHEMIN de la page : ce qui suit « ? » peut contenir un jeton (lien de désinscription…).
 * - Un échec de l'envoi est ignoré : le suivi ne doit jamais gêner la visiteuse.
 */
import { http } from './http'

const MAX_PER_VISIT = 10
const sent = new Set<string>()

const enabled = () => import.meta.env.PROD || import.meta.env.VITE_REPORT_ERRORS === 'true'

export function reportError(error: unknown, type?: string): void {
  if (!enabled() || sent.size >= MAX_PER_VISIT) return
  const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Erreur inconnue')
  const key = `${type ?? e.name}:${e.message}`
  if (sent.has(key)) return
  sent.add(key)
  void http
    .post('/client-errors', { type: (type ?? e.name).slice(0, 100), message: e.message.slice(0, 1000), page: window.location.pathname, stack: (e.stack ?? '').slice(0, 2000) })
    .catch(() => {})
}

/** À appeler une fois au démarrage : erreurs non attrapées et promesses rejetées sans traitement */
export function installErrorReporting(): void {
  window.addEventListener('error', (event) => reportError(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'UnhandledRejection'))
}

/** Pour les tests : oublie les erreurs déjà envoyées */
export function resetErrorReporting(): void {
  sent.clear()
}
