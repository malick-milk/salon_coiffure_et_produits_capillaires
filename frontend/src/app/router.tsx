import { createBrowserRouter } from 'react-router'
import { PublicLayout } from './layouts/PublicLayout'
import { RouteError } from './RouteError'
import { HomePage } from '@/features/home/pages/HomePage'
import { CatalogPage } from '@/features/catalog/pages/CatalogPage'
import { ProductPage } from '@/features/catalog/pages/ProductPage'
import { CartPage } from '@/features/cart/pages/CartPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * Table des routes. Les URLs sont en français et lisibles (bon pour le SEO, ADR-009).
 *
 * CHARGEMENT À LA DEMANDE (code splitting) : la page Réserver utilise zod et react-hook-form,
 * deux bibliothèques lourdes. Avec « lazy », leur code n'est téléchargé que lorsque le visiteur
 * ouvre cette page. L'accueil et le catalogue se chargent donc plus vite, surtout en 4G.
 * Les zones /compte et /admin suivront le même principe.
 */
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'boutique', element: <CatalogPage /> },
      { path: 'produits/:slug', element: <ProductPage /> },
      { path: 'panier', element: <CartPage /> },
      {
        path: 'reserver',
        lazy: async () => ({ Component: (await import('@/features/booking/pages/BookingPage')).BookingPage }),
        hydrateFallbackElement: <p className="p-10 text-center text-muted">Chargement…</p>,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
