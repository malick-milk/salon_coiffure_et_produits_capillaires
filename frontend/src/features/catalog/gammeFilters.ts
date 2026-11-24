/** Menu « Gammes » de l'en-tête : les filtres par base et par public (maquette validée le 24 novembre 2026) */
import type { ProductSummary } from '@/types/api'

/** Filtres proposés quand au moins une gamme correspond (mots cherchés dans le nom et la description) */
export const GAMME_FILTERS: { label: string; match: (g: ProductSummary) => boolean }[] = [
  { label: 'Avocat', match: (g) => /avocat/i.test(text(g)) },
  { label: 'Coco', match: (g) => /coco/i.test(text(g)) },
  { label: 'Palme', match: (g) => /palme/i.test(text(g)) },
  { label: 'Enfants', match: (g) => /enfant|salma/i.test(text(g)) },
  { label: 'Locs', match: (g) => /\blocs?\b/i.test(text(g)) },
  { label: 'Petits prix (5 000 F)', match: (g) => g.price <= 5000 },
]
function text(g: ProductSummary) { return `${g.name} ${g.short_description ?? ''}` }

export function gammeFilters(gammes: ProductSummary[]) {
  return GAMME_FILTERS.filter((f) => gammes.some(f.match))
}
