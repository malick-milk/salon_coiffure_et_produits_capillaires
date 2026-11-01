import axios from 'axios'

/**
 * Client HTTP unique de l'application.
 * - baseURL "/api/v1" : en développement, Vite transmet à Laravel (ou MSW répond à sa place).
 * - withCredentials : envoie le cookie de session HttpOnly (authentification Sanctum, ADR-003).
 * - withXSRFToken : renvoie le jeton CSRF lu dans le cookie XSRF-TOKEN (protection CSRF).
 */
export const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})

/** Erreur de validation renvoyée par Laravel (HTTP 422) */
export interface ValidationErrorBody {
  message: string
  errors: Record<string, string[]>
}

/** Extrait un message lisible d'une erreur d'API, quelle que soit sa forme */
export function apiErrorMessage(error: unknown, fallback = 'Une erreur est survenue. Veuillez réessayer.'): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (!error.response) return 'Connexion impossible. Vérifiez votre réseau.'
    return error.response.data?.message ?? fallback
  }
  return fallback
}

export function apiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}
