/** Tous les avis publiés (étape 13) : /avis */
import { Seo } from '@/components/common/Seo'
import { EmptyState, Eyebrow, QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/http'
import { useState } from 'react'
import { useReviews } from '../api'
import { ReviewCard } from '../components/ReviewCard'
import { ReviewsSummaryBlock } from '../components/ReviewsSummaryBlock'

export function ReviewsPage() {
  const [page, setPage] = useState(1)
  const reviews = useReviews(page, 9)

  return (
    <section className="px-4 py-14 sm:px-6">
      <Seo title="Avis clients" description="Les avis vérifiés des clientes du salon et de la boutique Dabo Hair, à Dakar." />
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-4">
          <Eyebrow>Avis vérifiés</Eyebrow>
          <h1 className="font-display text-4xl font-semibold">Avis clients</h1>
          {reviews.data && <ReviewsSummaryBlock summary={reviews.data.summary} />}
        </div>
        <div className="flex flex-col gap-4">
          {reviews.isError ? <QueryError message={apiErrorMessage(reviews.error)} onRetry={() => reviews.refetch()} />
            : reviews.isPending ? <Skeleton className="h-96" />
            : reviews.data.data.length === 0 ? <EmptyState title="Pas encore d’avis publié" />
            : reviews.data.data.map((r) => <ReviewCard key={r.id} review={r} />)}
          {reviews.data && reviews.data.meta.last_page > 1 && (
            <nav aria-label="Pages d’avis" className="flex items-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédents</Button>
              <span className="text-sm text-muted">Page {page} sur {reviews.data.meta.last_page}</span>
              <Button variant="outline" size="sm" disabled={page >= reviews.data.meta.last_page} onClick={() => setPage(page + 1)}>Suivants</Button>
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}
