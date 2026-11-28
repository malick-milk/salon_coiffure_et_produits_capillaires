import { quiz } from '@/content/quiz'
import type { ProductSummary } from '@/types/api'

/**
 * Les réponses possibles avec les gammes EN VENTE. Partagé avec la page « Nos gammes » : son bouton « Pas sûre ? »
 * ne s'affiche que si le questionnaire a quelque chose à proposer (bug du 28 novembre 2026 : bouton qui n'ouvrait rien).
 */
export function quizOptions(gammes: ProductSummary[]) {
  const sellable = new Map(gammes.filter((g) => g.is_bundle && g.stock_status !== 'out_of_stock').map((g) => [g.slug, g]))
  const goals = quiz.goal.filter((c) => sellable.has(c.gamme))
  const whos = quiz.who.filter((c) => (c.gamme ? sellable.has(c.gamme) : goals.length > 0))
  return { sellable, goals, whos }
}
