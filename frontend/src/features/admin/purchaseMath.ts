/**
 * Calcul d'une réception d'achat, affiché EN DIRECT dans le formulaire.
 * Même formule que le serveur (app/Actions/Admin/RecordPurchaseReceiptAction.php) : le serveur reste la
 * référence, cet aperçu évite seulement les surprises avant d'enregistrer.
 */
export interface ReceiptPreview {
  subtotal: number // quantité × prix d'achat
  total: number // + frais du lot
  unitCost: number // coût de revient de CETTE réception, par unité
  stockAfter: number
  newCost: number // coût moyen pondéré du stock après la réception
  unitMargin: number | null // prix de vente − nouveau coût
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function previewReceipt(p: {
  quantity: number
  unitPrice: number
  extraCosts: number
  stockBefore: number
  costBefore: number | null
  salePrice: number
}): ReceiptPreview | null {
  if (!Number.isFinite(p.quantity) || p.quantity < 1 || !Number.isFinite(p.unitPrice) || p.unitPrice < 0) return null
  const extra = Number.isFinite(p.extraCosts) && p.extraCosts > 0 ? p.extraCosts : 0
  const subtotal = p.quantity * p.unitPrice
  const total = subtotal + extra
  const unitCost = round2(total / p.quantity)
  const stockAfter = p.stockBefore + p.quantity
  // Sans coût connu ou sans stock, la moyenne se réduit au coût de cette réception
  const newCost = p.costBefore === null || p.stockBefore <= 0
    ? unitCost
    : round2((p.stockBefore * p.costBefore + p.quantity * unitCost) / stockAfter)
  return { subtotal, total, unitCost, stockAfter, newCost, unitMargin: p.salePrice > 0 ? round2(p.salePrice - newCost) : null }
}
