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

/**
 * Marge d'un nouveau produit (écran « Nouveau produit ») : même formule que le taux de marge du serveur
 * (CatalogAdminController::row) : (prix de vente − coût) ÷ prix de vente, arrondi à 0,1 %.
 * Une marge négative = vente à perte : autorisée, l'écran avertit seulement (décision du 18 novembre 2026).
 */
export function productMargin(salePrice: number, cost: number): { amount: number; rate: number; loss: boolean } | null {
  if (!Number.isFinite(salePrice) || !Number.isFinite(cost) || salePrice <= 0 || cost < 0) return null
  const amount = salePrice - cost
  return { amount, rate: Math.round((1000 * amount) / salePrice) / 10, loss: amount < 0 }
}


/**
 * Prix promo (maquettes du 20 novembre 2026) : même calcul que le serveur (PromotionService::discounted),
 * arrondi à la dizaine de francs INFÉRIEURE : 3 500 F à −15 % = 2 975 F -> 2 970 F.
 */
export function discountedPrice(price: number, percent: number): number {
  return Math.floor(Math.floor((price * (100 - percent)) / 100) / 10) * 10
}

/** Une ligne de gamme, telle que l'ERP la connaît (prix seul, coût de revient, stock) */
export interface BundleLine { name: string; price: number; cost: number | null; stock: number; quantity: number }

/**
 * NOUVELLE GAMME (maquette validée le 24 novembre 2026) : tous les chiffres de l'écran, en un seul calcul.
 * - separate : prix si la cliente achetait les produits un par un ; saving : ce qu'elle économise avec la gamme.
 * - margin : prix de la gamme − coût de revient de ses produits (null si un coût manque : marge incomplète).
 * - possible : gammes qu'on peut former avec le stock actuel = le produit le plus rare (comme le serveur).
 * - shortfalls : pour atteindre `target` gammes, combien il manque de chaque produit.
 */
export function bundleSummary(lines: BundleLine[], price: number, memberPrice: number | null, target: number | null) {
  const separate = lines.reduce((s, l) => s + l.price * l.quantity, 0)
  const unknownCost = lines.filter((l) => l.cost === null).map((l) => l.name)
  const cost = unknownCost.length ? null : lines.reduce((s, l) => s + (l.cost ?? 0) * l.quantity, 0)
  const perLine = lines.map((l) => ({ name: l.name, possible: Math.floor(Math.max(0, l.stock) / l.quantity), line: l }))
  const possible = perLine.length ? Math.min(...perLine.map((p) => p.possible)) : 0
  const limiting = perLine.length > 1 ? perLine.filter((p) => p.possible === possible).map((p) => p.name) : []
  const shortfalls = target && target > possible
    ? perLine.map((p) => ({ name: p.name, missing: target * p.line.quantity - p.line.stock })).filter((s) => s.missing > 0)
    : []
  return {
    separate,
    saving: separate - price,
    savingRate: separate > 0 ? Math.round((1000 * (separate - price)) / separate) / 10 : 0,
    cost: cost === null ? null : Math.round(cost),
    unknownCost,
    margin: cost === null ? null : productMargin(price, cost),
    memberMargin: cost === null || memberPrice === null ? null : productMargin(memberPrice, cost),
    possible,
    limiting,
    shortfalls,
  }
}
