/**
 * Hooks TanStack Query du catalogue.
 * La « queryKey » identifie une donnée dans le cache : ['products', filtres].
 * Deux composants qui demandent les mêmes filtres partagent UN seul appel réseau.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ProductFilters } from '@/types/api'
import { fetchCategories, fetchProduct, fetchProducts } from './api'

export const catalogKeys = {
  products: (filters: ProductFilters) => ['products', filters] as const,
  product: (slug: string) => ['product', slug] as const,
  categories: ['categories'] as const,
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: catalogKeys.products(filters),
    queryFn: () => fetchProducts(filters),
    placeholderData: keepPreviousData, // garde l'ancienne liste affichée pendant le changement de filtre
  })
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: catalogKeys.product(slug), queryFn: () => fetchProduct(slug) })
}

export function useCategories() {
  return useQuery({ queryKey: catalogKeys.categories, queryFn: fetchCategories, staleTime: 10 * 60_000 })
}
