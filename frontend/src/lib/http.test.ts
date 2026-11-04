/**
 * Le client HTTP porte deux protections invisibles : le jeton CSRF et le rejeu après un 419.
 * On remplace le « transport » d'axios (adapter) par une fausse fonction : aucune requête réelle ne part.
 */
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiErrorMessage, apiErrorStatus, http } from './http'

const ok = (config: InternalAxiosRequestConfig) => Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config })
const fail = (config: InternalAxiosRequestConfig, status: number, data: unknown = {}) =>
  Promise.reject(new AxiosError('fail', String(status), config, null, { data, status, statusText: '', headers: {}, config }))

/** Espion sur la demande de jeton (/sanctum/csrf-cookie), installé avant chaque test */
const csrf = () => vi.mocked(axios.get)
const original = http.defaults.adapter

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT' // pas encore de jeton
  vi.spyOn(axios, 'get').mockResolvedValue({ data: null })
})
afterEach(() => {
  http.defaults.adapter = original
  vi.restoreAllMocks()
})

describe('protection CSRF', () => {
  it('demande le jeton avant une requête qui modifie des données (POST)', async () => {
    http.defaults.adapter = vi.fn(ok) as AxiosAdapter
    await http.post('/orders', {})
    expect(csrf()).toHaveBeenCalledWith('/sanctum/csrf-cookie', { withCredentials: true })
  })

  it('ne le demande pas pour une simple lecture (GET), ni si le cookie existe déjà', async () => {
    http.defaults.adapter = vi.fn(ok) as AxiosAdapter
    await http.get('/products')
    document.cookie = 'XSRF-TOKEN=abc'
    await http.post('/orders', {})
    expect(csrf()).not.toHaveBeenCalled()
  })

  it('après un 419 (jeton expiré), renouvelle le jeton et rejoue la requête une fois', async () => {
    document.cookie = 'XSRF-TOKEN=abc'
    const adapter = vi.fn().mockImplementationOnce((c) => fail(c, 419)).mockImplementationOnce(ok)
    http.defaults.adapter = adapter as AxiosAdapter
    const response = await http.post('/bookings', {})
    expect(response.data).toEqual({ ok: true })
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(csrf()).toHaveBeenCalledTimes(1)
  })

  it('ne rejoue jamais en boucle : un second 419 remonte l’erreur', async () => {
    document.cookie = 'XSRF-TOKEN=abc'
    const adapter = vi.fn((c: InternalAxiosRequestConfig) => fail(c, 419))
    http.defaults.adapter = adapter as AxiosAdapter
    await expect(http.post('/bookings', {})).rejects.toMatchObject({ response: { status: 419 } })
    expect(adapter).toHaveBeenCalledTimes(2)
  })
})

describe('messages d’erreur', () => {
  const axiosError = (status?: number, data?: unknown) =>
    new AxiosError('x', 'x', undefined, null, status ? { data, status, statusText: '', headers: {}, config: {} as InternalAxiosRequestConfig } : undefined)

  it('affiche le message du serveur (en français)', () => {
    expect(apiErrorMessage(axiosError(409, { message: 'Ce créneau vient d’être réservé.' }))).toBe('Ce créneau vient d’être réservé.')
    expect(apiErrorStatus(axiosError(409, {}))).toBe(409)
  })
  it('sans réponse du serveur : problème de réseau', () => {
    expect(apiErrorMessage(axiosError())).toBe('Connexion impossible. Vérifiez votre réseau.')
  })
  it('sinon un message générique, jamais un détail technique', () => {
    expect(apiErrorMessage(axiosError(500, '<html>Stack trace…</html>'))).toBe('Une erreur est survenue. Veuillez réessayer.')
    expect(apiErrorMessage(new Error('TypeError: x is undefined'))).toBe('Une erreur est survenue. Veuillez réessayer.')
    expect(apiErrorStatus(new Error('x'))).toBeUndefined()
  })
})
