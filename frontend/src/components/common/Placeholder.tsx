import { cn } from '@/lib/utils'

/**
 * Emplacement réservé pour une image que l'entreprise doit fournir (logo, hero, photos).
 * Le libellé indique ce qu'il faut fournir et dans quel format (docs/04_MAQUETTES.md §6).
 */
export function ImagePlaceholder({ label, hint, className }: { label: string; hint?: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'flex flex-col items-center justify-center gap-1 border border-dashed border-[#4a4a4a] bg-ink-soft text-center text-xs tracking-[0.12em] text-[#8a8a8a]',
        className,
      )}
    >
      <span>[{label.toUpperCase()}]</span>
      {hint && <span className="tracking-normal">{hint}</span>}
    </div>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex h-12 w-40 items-center justify-center rounded-lg border border-dashed border-gold font-display text-lg font-semibold tracking-wide text-gold',
        className,
      )}
    >
      Dabo Hair
    </span>
  )
}
