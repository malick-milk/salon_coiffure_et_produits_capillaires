import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMe, login, logout, register } from './api'

export const ME_KEY = ['me'] as const

/** L'utilisateur connecté (null si visiteur). Une seule source de vérité : le serveur. */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 5 * 60_000, retry: false })
}

/**
 * Tout ce qui appartient à un compte, SAUF la clé ['me'] elle-même (qui dit qui est connecté).
 * Bug du 19 novembre 2026 : le filtre épargnait toutes les clés commençant par 'me' ; les réservations
 * (['me', 'bookings']) de la cliente précédente restaient en mémoire et s'affichaient au compte suivant.
 */
const previousAccountData = (q: { queryKey: readonly unknown[] }) => !(q.queryKey.length === 1 && q.queryKey[0] === ME_KEY[0])

/** Connectée, la visiteuse peut avoir droit au prix membre : les fiches produits sont redemandées */
function signedIn(qc: ReturnType<typeof useQueryClient>, user: Awaited<ReturnType<typeof login>>) {
  // Changement de compte : les données de l'ancien compte disparaissent AVANT d'afficher le nouveau
  void qc.resetQueries({ predicate: previousAccountData })
  qc.setQueryData(ME_KEY, user)
  void qc.invalidateQueries({ queryKey: ['product'] })
  void qc.invalidateQueries({ queryKey: ['products'] })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: login, onSuccess: (user) => signedIn(qc, user) })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: register, onSuccess: (user) => signedIn(qc, user) })
}

/**
 * Déconnexion, dans cet ordre : 1) le serveur ferme la session ; 2) onLoggedOut (ex. retour à l'accueil) ;
 * 3) l'écran apprend que personne n'est connecté. Bug du 19 novembre 2026 : avec 3 avant 2, la page protégée
 * renvoyait vers /connexion?redirect=<cette page>, et la personne suivante (la gérante) y était envoyée.
 */
export function useLogout(onLoggedOut?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      onLoggedOut?.()
      // 1. Personne n'est connecté : setQueryData PRÉVIENT tous les composants affichés (l'en-tête aussi).
      //    Piège corrigé le 18 novembre 2026 : qc.clear() vidait le cache SANS prévenir les composants déjà
      //    à l'écran ; l'en-tête gardait le prénom de la cliente précédente (« Soukey » au-dessus d'« Astou »).
      qc.setQueryData(ME_KEY, null)
      // 2. Les données du compte précédent (commandes, notifications…) sont effacées, composants prévenus
      await qc.resetQueries({ predicate: previousAccountData })
    },
  })
}
