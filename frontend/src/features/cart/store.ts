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
  memberPrice?: Money | null // prix membre possible (gamme du lancement) : appliqué si le serveur dit « eligible »
  quantity: number
}

export const MAX_QUANTITY_PER_ITEM = 99

interface CartState {
  items: CartItem[]
  /**
   * À qui appartient ce panier : l'id du compte, ou null pour une visiteuse sans compte.
   * Le panier est enregistré dans le NAVIGATEUR (localStorage), pas dans le compte : sans ce champ, la personne
   * suivante sur le même ordinateur retrouvait le panier de la précédente (bug du 20 novembre 2026).
   */
  ownerId: number | null
  /**
   * Le panier suit la personne connectée (appelé à la connexion et à chaque chargement du site) :
   * - panier de visiteuse + connexion : gardé, il devient le sien (prix membre après l'inscription) ;
   * - panier d'un AUTRE compte, ou panier d'avant ce correctif (propriétaire inconnu) : vidé ;
   * - panier d'un compte alors que plus personne n'est connecté (déconnexion ailleurs, session expirée) : vidé.
   */
  syncOwner: (userId: number | null) => void
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
      ownerId: null,
      syncOwner: (userId) => set((state) => {
        const owner = state.ownerId as number | null | undefined // undefined : panier enregistré avant le correctif
        if (userId === null) return typeof owner === 'number' ? { items: [], ownerId: null } : state
        if (owner === null) return { ownerId: userId }
        return owner === userId ? state : { items: [], ownerId: userId }
      }),
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
      clear: () => set({ items: [], ownerId: null }),
    }),
    { name: 'dabo-hair-cart', version: 1 },
  ),
)

// Sélecteurs : un composant ne se re-rend que si la valeur qu'il lit change
export const useCartCount = () => useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0))
export const useCartSubtotal = () => useCart((s) => s.items.reduce((sum, i) => sum + i.price * i.quantity, 0))
