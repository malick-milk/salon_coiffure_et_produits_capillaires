/**
 * « QUELLE GAMME POUR MOI ? » sur l'accueil (maquette validée le 25 novembre 2026).
 * 2 questions, UNE gamme proposée avec « Ajouter au panier » : trop de choix ne fait pas vendre.
 * Correspondances : src/content/quiz.ts. Une réponse sans gamme en vente est masquée ; sans aucune, le bloc est caché.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { type QuizChoice, quiz } from '@/content/quiz'
import { useCart } from '@/features/cart/store'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductSummary } from '@/types/api'
import { useProducts } from '../hooks'
import { quizOptions } from '../quizOptions'

export function GammeQuiz() {
  const gammes = useProducts({ category: 'gammes', sort: 'newest' })
  const add = useCart((s) => s.add)
  const navigate = useNavigate()
  const [who, setWho] = useState<QuizChoice | null>(null)
  const [goal, setGoal] = useState<QuizChoice | null>(null)

  const { sellable, goals, whos } = quizOptions(gammes.data?.data ?? [])
  if (whos.length === 0) return null // aucune gamme du questionnaire n'est en vente : on n'affiche rien

  const result: ProductSummary | undefined = who?.gamme ? sellable.get(who.gamme) : goal ? sellable.get(goal.gamme) : undefined
  const take = (g: ProductSummary) => {
    add({ productId: g.id, slug: g.slug, name: g.name, unitSize: g.unit_size, price: g.price, memberPrice: g.member_price ?? null })
    navigate('/panier')
  }

  return (
    <section aria-labelledby="quiz-title" className="mx-auto flex max-w-3xl flex-col gap-4 rounded-[20px] border border-[#2b2516] bg-ink-soft p-5 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 id="quiz-title" className="font-display text-[26px] font-semibold">{quiz.title}</h2>
        <p className="text-sm text-[#c9c4b8]">{quiz.subtitle}</p>
      </div>
      <Question legend="1. C’est pour qui ?" choices={whos} selected={who} onSelect={(c) => { setWho(c); setGoal(null) }} />
      {who && !who.gamme && <Question legend="2. Ce que vous voulez" choices={goals} selected={goal} onSelect={setGoal} />}
      {result && (
        <div aria-live="polite" className="overflow-hidden rounded-2xl border-2 border-gold bg-ink">
          <div className="flex items-center gap-3 p-3">
            {result.image_url
              ? <img src={result.image_url} alt="" className="size-[84px] shrink-0 rounded-xl object-cover" />
              : <span className="grid size-[84px] shrink-0 place-items-center rounded-xl bg-[#1a1712] font-display text-gold">DH</span>}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">Votre gamme</span>
              <strong className="font-display text-lg">{result.name}</strong>
              {result.bundle_contents && <span className="line-clamp-2 text-xs text-[#c9c4b8]">{result.bundle_contents.join(' · ')}</span>}
              <strong className="text-gold">{formatPrice(result.price)}</strong>
            </span>
          </div>
          <Button className="w-full rounded-none" onClick={() => take(result)}>Ajouter au panier</Button>
        </div>
      )}
      {result && <Link to={`/produits/${result.slug}`} className="self-center py-1.5 text-sm font-semibold text-gold underline-offset-4 hover:underline">Voir la fiche de la gamme</Link>}
    </section>
  )
}

function Question({ legend, choices, selected, onSelect }: { legend: string; choices: QuizChoice[]; selected: QuizChoice | null; onSelect: (c: QuizChoice) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[15px] font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button key={c.label} type="button" aria-pressed={selected?.label === c.label} onClick={() => onSelect(c)}
            className={cn('min-h-11 rounded-full px-4 text-sm', selected?.label === c.label ? 'bg-gold font-bold text-ink' : 'border border-[#3a3a3a] hover:border-gold')}>
            {c.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
