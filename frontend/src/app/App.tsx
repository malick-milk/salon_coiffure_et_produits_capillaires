import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { apiErrorStatus } from '@/lib/http'
import { router } from './router'

/**
 * TanStack Query gère l'« état serveur » : cache, rechargement, états de chargement et d'erreur.
 * staleTime 60 s : une donnée chargée est réutilisée pendant 1 minute sans nouvel appel réseau.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // Une nouvelle tentative n'a de sens que si l'erreur est passagère (réseau coupé, serveur 5xx).
      // Une 404 ou une 422 donnera le même résultat : inutile de réessayer.
      retry: (failureCount, error) => {
        const status = apiErrorStatus(error)
        return failureCount < 2 && (status === undefined || status >= 500)
      },
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
