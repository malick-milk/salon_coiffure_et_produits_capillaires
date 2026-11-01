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

/**
 * PROTECTION CSRF (Sanctum) : toute requête qui MODIFIE des données (POST, PATCH, DELETE…)
 * doit porter le jeton lu dans le cookie XSRF-TOKEN. Un visiteur qui n'a encore jamais
 * appelé /sanctum/csrf-cookie n'a pas ce cookie : on le demande juste avant l'envoi.
 */
const SAFE_METHODS = ['get', 'head', 'options']
const hasXsrfCookie = () => document.cookie.split('; ').some((c) => c.startsWith('XSRF-TOKEN='))
const refreshCsrfCookie = () => axios.get('/sanctum/csrf-cookie', { withCredentials: true })

http.interceptors.request.use(async (config) => {
  if (!SAFE_METHODS.includes((config.method ?? 'get').toLowerCase()) && !hasXsrfCookie()) {
    await refreshCsrfCookie()
  }
  return config
})

/** 419 = jeton CSRF ou session expiré : on renouvelle le jeton et on rejoue la requête UNE seule fois */
http.interceptors.response.use(undefined, async (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 419 && error.config) {
    const config = error.config as typeof error.config & { _csrfRetried?: boolean }
    if (!config._csrfRetried) {
      config._csrfRetried = true
      await refreshCsrfCookie()
      return http(config)
    }
  }
  return Promise.reject(error)
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
