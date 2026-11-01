/**
 * Permissions côté interface. RAPPEL : c'est du CONFORT (on n'affiche pas un bouton inutile).
 * La SÉCURITÉ est côté serveur : chaque route de l'API exige sa permission (403 sinon).
 */
import type { User } from '@/types/api'
import { useMe } from './hooks'

export const can = (user: User | null | undefined, permission: string) => Boolean(user?.permissions?.includes(permission))

/** Un membre du personnel = quelqu'un qui a au moins une permission (un client n'en a aucune) */
export const isStaff = (user: User | null | undefined) => Boolean(user?.permissions?.length)

export function useCan(permission: string): boolean {
  const { data: user } = useMe()
  return can(user, permission)
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Propriétaire',
  manager: 'Gérant(e)',
  cashier: 'Caissier(ère)',
  stylist: 'Coiffeur(se)',
  stock_keeper: 'Gestionnaire de stock',
  customer: 'Client',
}
