import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '../hooks'

/**
 * Garde de route : redirige vers la connexion si le visiteur n'est pas connecté, puis le ramène
 * à la page demandée (?redirect=…).
 * IMPORTANT : c'est du CONFORT. La vraie protection est côté serveur (401 sur /me/*) :
 * n'importe qui peut modifier le JavaScript de son navigateur.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useMe()
  const location = useLocation()
  if (isPending) return <div className="mx-auto max-w-5xl px-4 py-10"><Skeleton className="h-64" /></div>
  if (!user) return <Navigate to={`/connexion?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}

/**
 * N'accepte que des redirections INTERNES (« /compte »), jamais vers un autre site (OWASP : open redirect).
 *
 * On ne compare PAS des chaînes (« commence par / mais pas par // ») : c'est contournable, car le navigateur
 * lit « /\\pirate.com » comme « //pirate.com » et supprime les tabulations (« /\t/pirate.com »).
 * On laisse le navigateur INTERPRÉTER l'adresse, exactement comme il le ferait, puis on vérifie l'origine.
 */
export function safeRedirect(value: string | null, fallback = '/compte'): string {
  if (!value || !value.startsWith('/')) return fallback
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}

/**
 * Destination d'une CLIENTE : jamais l'ERP. Bug du 18 novembre 2026 : venue de /admin, la page de connexion
 * transmettait « revenir sur /admin » à l'inscription ; la nouvelle cliente tombait sur « accès refusé ».
 * L'ERP n'est ouvert qu'au personnel (comptes créés par la gérante dans « Équipe et rôles »).
 */
export function customerRedirect(value: string | null): string {
  const path = safeRedirect(value)
  return path === '/admin' || path.startsWith('/admin/') || path.startsWith('/admin?') ? '/compte' : path
}
