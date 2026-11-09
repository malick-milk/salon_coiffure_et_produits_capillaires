import { cn } from '@/lib/utils'

/**
 * Logo officiel Dabo Hair (charte : docs/charte-graphique/). Fichiers dans public/brand/.
 * - « horizontal » : icône + DABO HAIR, pour l'en-tête et le pied de page ;
 * - « icon » : la tête dans son cercle, pour les petits espaces (menu de l'ERP).
 * Les fichiers sont des SVG : nets à toutes les tailles, sur écran comme à l'impression.
 * width/height réservent la place avant le chargement : la page ne « saute » pas.
 */
export function Logo({ variant = 'horizontal', className }: { variant?: 'horizontal' | 'icon'; className?: string }) {
  return variant === 'icon'
    ? <img src="/brand/logo-icone-transparent.svg" alt="Dabo Hair" width={44} height={44} className={cn('size-11', className)} />
    : <img src="/brand/logo-horizontal-transparent.svg" alt="Dabo Hair" width={134} height={44} className={cn('h-11 w-auto', className)} />
}
