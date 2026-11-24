/** « Il manque … » près du bouton d'envoi : la liste à afficher (voir components/common/MissingFields.tsx) */
export interface MissingItem { name: string; label: string }

/** Ce qui manque, À AFFICHER DANS L'ORDRE DE LA PAGE (celui des libellés) ; un champ inconnu garde son message */
export function missingFields(errors: Record<string, { message?: unknown } | undefined>, labels: Record<string, string>): MissingItem[] {
  const names = Object.keys(errors).filter((n) => errors[n] && n !== 'root')
  const ordered = [...Object.keys(labels).filter((n) => names.includes(n)), ...names.filter((n) => !(n in labels))]
  return ordered.map((name) => ({ name, label: labels[name] ?? String(errors[name]?.message ?? name) }))
}
