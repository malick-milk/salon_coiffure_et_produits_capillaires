/** « 4,8 » : virgule décimale à la française ; « – » quand il n'y a pas encore de note */
export const formatRating = (n: number | null) => (n === null ? '–' : n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
