import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combine des classes Tailwind proprement (utilitaire standard de shadcn/ui).
 * - clsx gère les conditions : cn('p-4', isActive && 'bg-gold')
 * - twMerge règle les conflits : cn('p-4', 'p-2') => 'p-2' (la dernière gagne)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
