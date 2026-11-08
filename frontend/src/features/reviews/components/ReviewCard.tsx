import { formatLongDate } from '@/lib/format'
import type { PublicReview } from '@/types/api'
import { Stars } from './Stars'

export function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-ink-line bg-ink-soft p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-gold-soft font-semibold text-gold">{review.author.charAt(0)}</span>
          <div className="flex flex-col">
            <strong>{review.author}</strong>
            <span className="text-[13px] text-muted">
              {review.subject_label} · {formatLongDate(review.date)} · {review.kind === 'booking' ? 'Avis vérifié' : 'Achat vérifié'}
            </span>
          </div>
        </div>
        <Stars rating={review.rating} />
      </div>
      {review.comment && <p className="leading-relaxed text-[#e6e1d6]">{review.comment}</p>}
      {review.reply && (
        <p className="border-l-2 border-gold pl-3.5 text-sm text-muted"><strong className="text-gold">Réponse de Dabo Hair</strong> · {review.reply}</p>
      )}
    </article>
  )
}
