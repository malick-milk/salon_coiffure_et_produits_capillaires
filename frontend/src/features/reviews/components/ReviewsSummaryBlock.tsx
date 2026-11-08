import type { ReviewsSummary } from '@/types/api'
import { formatRating } from '../format'

/** Note moyenne + répartition des étoiles (sur toutes les réponses, publiées ou non) */
export function ReviewsSummaryBlock({ summary }: { summary: ReviewsSummary }) {
  const total = summary.answered_count || 1
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-baseline gap-2.5">
        <strong className="font-display text-5xl text-gold">{formatRating(summary.average)}</strong>
        <span className="text-muted">/ 5 · {summary.answered_count} cliente{summary.answered_count > 1 ? 's' : ''} interrogée{summary.answered_count > 1 ? 's' : ''}</span>
      </p>
      <dl className="flex flex-col gap-1.5">
        {(['5', '4', '3', '2', '1'] as const).map((r) => (
          <div key={r} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2.5 text-sm text-muted">
            <dt className="whitespace-nowrap">{r} étoile{r === '1' ? '' : 's'}</dt>
            <dd className="h-2 overflow-hidden rounded-full bg-ink-line">
              <span className="block h-full rounded-full bg-gold" style={{ width: `${Math.round((summary.distribution[r] / total) * 100)}%` }} />
            </dd>
            <dd className="text-right">{summary.distribution[r]}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[13px] leading-relaxed text-muted">
        Seules les clientes venues au salon ou livrées peuvent donner leur avis : le lien leur arrive par SMS le lendemain.
      </p>
    </div>
  )
}
