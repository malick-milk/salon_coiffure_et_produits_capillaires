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
 * Les zones /compte et /admin suivent le même principe : un client ne télécharge jamais le code de l'ERP.
 */
const admin = () => import('@/features/admin/pages/AdminPages')
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
      { path: 'commande', lazy: async () => ({ Component: (await import('@/features/checkout/pages/CheckoutPage')).CheckoutPage }) },
      { path: 'connexion', lazy: async () => ({ Component: (await import('@/features/auth/pages/LoginPage')).LoginPage }) },
      { path: 'inscription', lazy: async () => ({ Component: (await import('@/features/auth/pages/RegisterPage')).RegisterPage }) },
      {
        path: 'compte',
        lazy: async () => ({ Component: (await import('@/features/account/AccountLayout')).AccountLayout }),
        children: [
          { index: true, lazy: async () => ({ Component: (await import('@/features/account/pages/AccountPages')).AccountOverviewPage }) },
          { path: 'commandes', lazy: async () => ({ Component: (await import('@/features/account/pages/AccountPages')).OrdersPage }) },
          { path: 'commandes/:reference', lazy: async () => ({ Component: (await import('@/features/account/pages/AccountPages')).OrderDetailPage }) },
          { path: 'reservations', lazy: async () => ({ Component: (await import('@/features/account/pages/AccountPages')).BookingsPage }) },
          { path: 'profil', lazy: async () => ({ Component: (await import('@/features/account/pages/AccountPages')).ProfilePage }) },
        ],
      },
      // Étape 13 : avis clients publics et enquête de satisfaction (lien reçu par SMS)
      { path: 'avis', lazy: async () => ({ Component: (await import('@/features/reviews/pages/ReviewsPage')).ReviewsPage }) },
      { path: 'avis/:token', lazy: async () => ({ Component: (await import('@/features/reviews/pages/SurveyPage')).SurveyPage }) },
      // Étape 14 : page du partenaire pour remettre une commande (lien reçu par SMS)
      { path: 'retrait/:token', lazy: async () => ({ Component: (await import('@/features/pickup/pages/HandoverPage')).HandoverPage }) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // L'ERP est HORS du PublicLayout : il a son propre gabarit (menu latéral, thème clair).
    path: 'admin',
    errorElement: <RouteError />,
    lazy: async () => ({ Component: (await import('@/features/admin/AdminLayout')).AdminLayout }),
    hydrateFallbackElement: <p className="p-10 text-center">Chargement…</p>,
    children: [
      { index: true, lazy: async () => ({ Component: (await admin()).DashboardPage }) },
      // Fichier à part : Recharts (≈ 110 Ko compressés) n'est téléchargé que par le propriétaire, sur cette page
      { path: 'analyses', lazy: async () => ({ Component: (await import('@/features/admin/pages/AnalyticsPage')).AnalyticsPage }) },
      { path: 'commandes', lazy: async () => ({ Component: (await admin()).OrdersPage }) },
      { path: 'commandes/:reference', lazy: async () => ({ Component: (await admin()).OrderDetailPage }) },
      { path: 'planning', lazy: async () => ({ Component: (await admin()).PlanningPage }) },
      { path: 'clients', lazy: async () => ({ Component: (await admin()).CustomersPage }) },
      { path: 'produits', lazy: async () => ({ Component: (await admin()).ProductsPage }) },
      { path: 'fabrication', lazy: async () => ({ Component: (await admin()).ProductionPage }) },
      { path: 'equipe', lazy: async () => ({ Component: (await admin()).TeamPage }) },
      { path: 'audit', lazy: async () => ({ Component: (await admin()).AuditPage }) },
      { path: 'avis', lazy: async () => ({ Component: (await admin()).ReviewsAdminPage }) },
      { path: 'points-de-retrait', lazy: async () => ({ Component: (await admin()).PickupPointsPage }) },
      { path: 'points-de-retrait/:id', lazy: async () => ({ Component: (await admin()).PickupPointDetailPage }) },
    ],
  },
])
