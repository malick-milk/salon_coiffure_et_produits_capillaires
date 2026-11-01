import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMe, login, logout, register } from './api'

export const ME_KEY = ['me'] as const

/** L'utilisateur connecté (null si visiteur). Une seule source de vérité : le serveur. */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 5 * 60_000, retry: false })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: login, onSuccess: (user) => qc.setQueryData(ME_KEY, user) })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: register, onSuccess: (user) => qc.setQueryData(ME_KEY, user) })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // On vide TOUT le cache : les données du compte précédent ne doivent pas rester visibles
      qc.clear()
      qc.setQueryData(ME_KEY, null)
    },
  })
}
