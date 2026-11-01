import { cn } from '@/lib/utils'

/** Bloc gris animé affiché pendant le chargement (meilleure perception de vitesse qu'un spinner) */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-2xl bg-ink-soft', className)} />
}
