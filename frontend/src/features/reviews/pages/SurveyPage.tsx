/**
 * Enquête de satisfaction (étape 13) : /avis/:jeton, lien personnel reçu par SMS ou e-mail.
 * Pas de compte à créer : le lien suffit, et ne sert qu'une fois.
 */
import { CheckCircle2, Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { EmptyState, Eyebrow, QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage, apiErrorStatus } from '@/lib/http'
import { cn } from '@/lib/utils'
import { useAnswerSurvey, useSurvey } from '../api'

const RATING_LABELS = ['', 'Très déçue', 'Déçue', 'Correct', 'Satisfaite', 'Ravie']

export function SurveyPage() {
  const { token = '' } = useParams()
  const survey = useSurvey(token)
  const answer = useAnswerSurvey(token)
  const [rating, setRating] = useState(0)
  const [nps, setNps] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [consent, setConsent] = useState(false)
  const [touched, setTouched] = useState(false)

  const shell = (children: React.ReactNode) => (
    <section className="px-4 py-14 sm:px-6">
      <Seo title="Votre avis" />
      <div className="mx-auto flex max-w-2xl flex-col gap-8">{children}</div>
    </section>
  )

  if (survey.isPending) return shell(<Skeleton className="h-96" />)
  if (survey.isError) {
    return shell(apiErrorStatus(survey.error) === 404
      ? <EmptyState title="Lien introuvable"><p className="text-muted">Vérifiez que le lien du SMS a été copié en entier.</p></EmptyState>
      : <QueryError message={apiErrorMessage(survey.error)} onRetry={() => survey.refetch()} />)
  }
  if (answer.isSuccess || survey.data.state === 'answered') {
    const followUp = answer.data?.follow_up
    return shell(
      <div role="status" className="flex flex-col items-center gap-4 rounded-3xl border border-gold-dark bg-ink-soft px-6 py-14 text-center">
        <CheckCircle2 className="size-12 text-gold" aria-hidden="true" />
        <h1 className="font-display text-3xl font-semibold">Merci pour votre avis</h1>
        <p className="max-w-md text-muted">
          {followUp
            ? 'Nous sommes désolés que tout n’ait pas été parfait. Le salon va vous appeler pour comprendre et arranger les choses.'
            : 'Il nous aide à nous améliorer chaque jour. À très bientôt chez Dabo Hair !'}
        </p>
        <Button asChild variant="outline"><Link to="/">Retour à l’accueil</Link></Button>
      </div>,
    )
  }
  if (survey.data.state === 'expired') {
    return shell(<EmptyState title="Ce lien a expiré"><p className="text-muted">Les liens d’avis sont valables 14 jours. Merci quand même de votre fidélité !</p></EmptyState>)
  }

  const { first_name: firstName, kind, subject_label: subject } = survey.data
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (rating === 0) return
    answer.mutate({ rating, nps, comment: comment.trim() || null, publish_consent: consent })
  }

  return shell(
    <>
      <div className="flex flex-col gap-3">
        <Eyebrow>Votre avis</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">{firstName ? `${firstName}, comment` : 'Comment'} s’est passé{kind === 'booking' ? ' votre passage au salon' : 'e votre commande'} ?</h1>
        <p className="text-muted">{subject} · 20 secondes suffisent.</p>
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-semibold">Votre note <span className="text-gold">*</span></legend>
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
                <span className="flex size-14 items-center justify-center rounded-2xl border border-ink-line peer-checked:border-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold">
                  <Star aria-hidden="true" className={cn('size-8 text-gold', n <= rating ? 'fill-current' : 'opacity-40')} />
                  <span className="sr-only">{n} sur 5 : {RATING_LABELS[n]}</span>
                </span>
              </label>
            ))}
            <span aria-live="polite" className="ml-2 text-gold">{RATING_LABELS[rating]}</span>
          </div>
          {touched && rating === 0 && <p role="alert" className="text-sm text-[#f87171]">Choisissez une note de 1 à 5 étoiles.</p>}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-semibold">Recommanderiez-vous Dabo Hair à une amie ?</legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
            {Array.from({ length: 11 }, (_, n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name="nps" value={n} checked={nps === n} onChange={() => setNps(n)} className="peer sr-only" />
                <span className="flex min-h-11 items-center justify-center rounded-xl border border-ink-line font-semibold peer-checked:border-gold peer-checked:bg-gold peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-gold">{n}</span>
              </label>
            ))}
          </div>
          <p className="flex justify-between text-[13px] text-muted"><span>0 : pas du tout</span><span>10 : sans hésiter</span></p>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-lg font-semibold">Un mot pour le salon <span className="text-sm font-normal text-muted">(facultatif)</span></span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={4}
            className="rounded-2xl border border-ink-line bg-ink-soft p-4 text-ivory focus:border-gold focus:outline-none"
            placeholder="Ce qui vous a plu, ce que nous pouvons améliorer…" />
          <span className="self-end text-[13px] text-muted">{comment.length} / 1000</span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink-line p-4">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5 accent-[#d4af37]" />
          <span className="text-[15px] leading-relaxed">
            J’accepte que mon avis soit publié sur le site, avec mon prénom et l’initiale de mon nom.
            <span className="block text-[13px] text-muted">Sans cette case, votre avis reste privé et sert uniquement au salon.</span>
          </span>
        </label>

        {answer.isError && <QueryError message={apiErrorMessage(answer.error)} />}
        <Button type="submit" className="min-h-[52px]" disabled={answer.isPending}>{answer.isPending ? 'Envoi…' : 'Envoyer mon avis'}</Button>
      </form>
    </>,
  )
}
