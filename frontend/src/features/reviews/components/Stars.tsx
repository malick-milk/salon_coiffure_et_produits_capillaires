import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Note en étoiles, lisible par les lecteurs d'écran (« 4 étoiles sur 5 ») */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span role="img" aria-label={`${rating} étoile${rating > 1 ? 's' : ''} sur 5`} className={cn('inline-flex gap-0.5 text-gold', className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden="true" className={cn('size-4', i <= rating ? 'fill-current' : 'opacity-30')} />
      ))}
    </span>
  )
}

