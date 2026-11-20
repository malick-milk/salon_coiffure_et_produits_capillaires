/** Suivi des erreurs du navigateur (21 novembre 2026) */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn(() => Promise.resolve({}))
vi.mock('./http', () => ({ http: { post: (...a: unknown[]) => post(...(a as [])) } }))

describe('suivi des erreurs du navigateur', () => {
  beforeEach(async () => {
    post.mockClear()
    vi.stubEnv('VITE_REPORT_ERRORS', 'true')
    ;(await import('./errorReporter')).resetErrorReporting()
    window.history.replaceState(null, '', '/desinscription?token=secret')
  })

  it('envoie le type, le message et le CHEMIN de la page (jamais ce qui suit « ? »)', async () => {
    const { reportError } = await import('./errorReporter')
    reportError(new TypeError('x is undefined'))
    expect(post).toHaveBeenCalledWith('/client-errors', expect.objectContaining({ type: 'TypeError', message: 'x is undefined', page: '/desinscription' }))
  })

  it('une seule fois par erreur, et 10 au plus par visite', async () => {
    const { reportError } = await import('./errorReporter')
    reportError(new Error('même erreur'))
    reportError(new Error('même erreur'))
    for (let i = 0; i < 20; i++) reportError(new Error(`erreur ${i}`))
    expect(post).toHaveBeenCalledTimes(10)
  })

  it('désactivé en développement sans VITE_REPORT_ERRORS', async () => {
    vi.stubEnv('VITE_REPORT_ERRORS', '')
    const { reportError } = await import('./errorReporter')
    reportError(new Error('rien'))
    expect(post).not.toHaveBeenCalled()
  })
})
