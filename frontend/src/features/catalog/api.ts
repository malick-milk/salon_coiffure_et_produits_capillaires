/** Appels HTTP du catalogue. Un seul endroit où les URLs de l'API sont écrites. */
import { http } from '@/lib/http'
import type { Category, Paginated, ProductDetail, ProductFilters, ProductSummary } from '@/types/api'

/** Transforme les filtres en paramètres d'URL (les booléens deviennent "1") */
function toParams(filters: ProductFilters) {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || value === false) continue
    params[key] = value === true ? '1' : String(value)
  }
  return params
}

export async function fetchProducts(filters: ProductFilters): Promise<Paginated<ProductSummary>> {
  const { data } = await http.get<Paginated<ProductSummary>>('/products', { params: toParams(filters) })
  return data
}

export async function fetchProduct(slug: string): Promise<ProductDetail> {
  const { data } = await http.get<{ data: ProductDetail }>(`/products/${encodeURIComponent(slug)}`)
  return data.data
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await http.get<{ data: Category[] }>('/categories')
  return data.data
}
