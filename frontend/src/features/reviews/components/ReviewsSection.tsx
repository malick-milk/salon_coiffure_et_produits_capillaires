/** Section « Avis clients » de l'accueil : la note moyenne et les 3 derniers avis publiés */
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Eyebrow } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { useReviews } from '../api'
import { ReviewCard } from './ReviewCard'
import { ReviewsSummaryBlock } from './ReviewsSummaryBlock'

export function ReviewsSection() {
  const reviews = useReviews(1, 3)
  // Pas encore d'avis (ou API indisponible) : la section ne s'affiche pas, plutôt qu'une page vide ou en erreur
  if (reviews.isError || (reviews.data && reviews.data.summary.answered_count === 0)) return null

  return (
    <section aria-labelledby="avis-titre" className="border-t border-ink-line px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-4">
          <Eyebrow>Ils nous font confiance</Eyebrow>
          <h2 id="avis-titre" className="font-display text-4xl font-semibold">Avis clients</h2>
          {reviews.data ? <ReviewsSummaryBlock summary={reviews.data.summary} /> : <Skeleton className="h-48" />}
        </div>
        <div className="flex flex-col gap-4">
          {reviews.data ? reviews.data.data.map((r) => <ReviewCard key={r.id} review={r} />) : <Skeleton className="h-64" />}
          {reviews.data && reviews.data.summary.published_count > 3 && (
            <Link to="/avis" className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-gold">
              Voir les {reviews.data.summary.published_count} avis <ArrowRight className="size-[18px]" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
