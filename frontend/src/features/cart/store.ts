/**
 * PANIER (état global côté navigateur) avec Zustand.
 *
 * - persist : le panier est sauvegardé dans localStorage et survit au rechargement de la page.
 * - Le prix stocké ici sert UNIQUEMENT à l'affichage. Au moment de commander, le serveur
 *   recalcule tout à partir des prix en base (RG-COM-04) : modifier ce prix dans le navigateur
 *   ne permet pas de payer moins cher.
 * - À l'étape suivante, le panier d'un client connecté sera aussi synchronisé avec le
 *   serveur (tables carts / cart_items).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Money } from '@/types/api'

export interface CartItem {
  productId: number
  slug: string
  name: string
  unitSize: string | null
  price: Money
  quantity: number
}

export const MAX_QUANTITY_PER_ITEM = 99

interface CartState {
  items: CartItem[]
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
  setQuantity: (productId: number, quantity: number) => void
  remove: (productId: number) => void
  clear: () => void
}

const clamp = (q: number) => Math.min(MAX_QUANTITY_PER_ITEM, Math.max(1, Math.floor(q)))

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId)
          // Même produit déjà présent : on augmente la quantité au lieu de créer une 2e ligne
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId ? { ...i, quantity: clamp(i.quantity + quantity) } : i,
              ),
            }
          }
          return { items: [...state.items, { ...item, quantity: clamp(quantity) }] }
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) => (i.productId === productId ? { ...i, quantity: clamp(quantity) } : i)),
        })),
      remove: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'dabo-hair-cart', version: 1 },
  ),
)

// Sélecteurs : un composant ne se re-rend que si la valeur qu'il lit change
export const useCartCount = () => useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0))
export const useCartSubtotal = () => useCart((s) => s.items.reduce((sum, i) => sum + i.price * i.quantity, 0))
