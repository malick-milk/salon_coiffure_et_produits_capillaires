/**
 * Authentification Sanctum en mode SPA (ADR-003).
 * 1. GET /sanctum/csrf-cookie : le serveur dépose le cookie XSRF-TOKEN.
 * 2. POST /auth/login : axios renvoie automatiquement ce jeton (en-tête X-XSRF-TOKEN).
 * 3. Le serveur répond avec un cookie de session HttpOnly : JavaScript ne peut PAS le lire,
 *    donc une faille XSS ne permet pas de le voler (contrairement à un jeton en localStorage).
 */
import axios from 'axios'
import { http } from '@/lib/http'
import type { LoginRequest, RegisterRequest, User } from '@/types/api'

const csrf = () => axios.get('/sanctum/csrf-cookie', { withCredentials: true })

export async function fetchMe(): Promise<User | null> {
  try {
    return (await http.get<{ data: User }>('/auth/me')).data.data
  } catch (error) {
    // 401 = simplement « pas connecté » : ce n'est pas une erreur à afficher
    if (axios.isAxiosError(error) && error.response?.status === 401) return null
    throw error
  }
}

export async function login(body: LoginRequest): Promise<User> {
  await csrf()
  return (await http.post<{ data: User }>('/auth/login', body)).data.data
}

export async function register(body: RegisterRequest): Promise<User> {
  await csrf()
  return (await http.post<{ data: User }>('/auth/register', body)).data.data
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}
