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

/** N'accepte que des redirections INTERNES (« /compte »), jamais « https://site-pirate.com » (open redirect) */
export function safeRedirect(value: string | null, fallback = '/compte'): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback
}
