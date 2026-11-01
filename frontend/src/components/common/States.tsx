import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/** Message d'erreur de chargement avec bouton « Réessayer » (jamais d'écran vide sans explication) */
export function QueryError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-2xl border border-[#7f1d1d] bg-[#1f1111] p-6">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-5 text-[#f87171]" aria-hidden="true" />
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#3a3a3a] px-6 py-14 text-center">
      <p className="font-display text-2xl">{title}</p>
      {children}
    </div>
  )
}

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={`text-[13px] font-semibold tracking-[0.2em] uppercase ${light ? 'text-gold-text' : 'text-gold'}`}>{children}</p>
  )
}
