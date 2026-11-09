import { CalendarDays, House, LayoutDashboard, Search, ShoppingBag, Store, User } from 'lucide-react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { Logo } from '@/components/common/Logo'
import { useMe } from '@/features/auth/hooks'
import { isStaff } from '@/features/auth/permissions'
import { useCartCount } from '@/features/cart/store'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/boutique', label: 'Boutique' },
  { to: '/#prestations', label: 'Prestations' },
  { to: '/reserver', label: 'Réserver' },
  { to: '/#salon', label: 'Le salon' },
]

/** Mise en page de la vitrine : bandeau, en-tête, contenu de la page, pied de page, navigation mobile */
export function PublicLayout() {
  const cartCount = useCartCount()
  const { data: user } = useMe()

  return (
    <div className="flex min-h-screen flex-col">
      {/* Lien d'évitement : au clavier, Tab puis Entrée saute directement au contenu */}
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-ink">
        Aller au contenu
      </a>

      <div className="bg-gold px-4 py-2 text-center text-xs font-medium text-ink sm:text-sm">
        Retrait gratuit en boutique · Livraison à Dakar et environs · Paiement à la réception
      </div>

      <header className="sticky top-0 z-40 border-b border-ink-line bg-ink/95 px-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4">
          <Link to="/" aria-label="Dabo Hair, accueil">
            <Logo className="h-14" />
          </Link>

          <nav aria-label="Navigation principale" className="hidden gap-8 text-[15px] font-medium md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn('py-2 hover:text-gold', isActive && !item.to.includes('#') && 'text-gold')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Link to="/boutique" aria-label="Rechercher un produit" className="hidden size-11 items-center justify-center rounded-full hover:bg-ink-soft sm:flex">
              <Search className="size-[22px]" aria-hidden="true" />
            </Link>
            {user && isStaff(user) && (
              <Link to="/admin" className="flex min-h-11 items-center gap-2 rounded-full border border-gold/40 px-3 text-sm font-semibold text-gold hover:bg-ink-soft">
                <LayoutDashboard className="size-[18px]" aria-hidden="true" />ERP
              </Link>
            )}
            <Link
              to={user ? '/compte' : '/connexion'}
              aria-label={user ? `Mon compte (${user.first_name})` : 'Se connecter'}
              className="hidden min-h-11 items-center gap-2 rounded-full px-2.5 hover:bg-ink-soft sm:flex"
            >
              <User className="size-[22px]" aria-hidden="true" />
              {user && <span className="text-sm font-medium">{user.first_name}</span>}
            </Link>
            <Link to="/panier" aria-label={`Panier, ${cartCount} article${cartCount > 1 ? 's' : ''}`} className="relative flex size-11 items-center justify-center rounded-full hover:bg-ink-soft">
              <ShoppingBag className="size-[22px]" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold text-ink">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main id="contenu" className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      <Footer />

      {/* Barre du bas, accessible au pouce, uniquement sur mobile */}
      <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-ink-line bg-ink-soft px-1 pt-1.5 pb-2.5 md:hidden">
        {[
          { to: '/', label: 'Accueil', Icon: House, end: true },
          { to: '/boutique', label: 'Boutique', Icon: Store, end: false },
          { to: '/reserver', label: 'Réserver', Icon: CalendarDays, end: false },
          { to: '/panier', label: 'Panier', Icon: ShoppingBag, end: false },
          { to: user ? '/compte' : '/connexion', label: user ? 'Compte' : 'Connexion', Icon: User, end: false },
        ].map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex min-h-[52px] flex-col items-center justify-center gap-1 text-[11px]', isActive && 'text-gold')}>
            <Icon className="size-[22px]" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <ScrollRestoration />
    </div>
  )
}

function Footer() {
  return (
    <footer className="border-t border-ink-line px-4 pt-14 pb-28 sm:px-6 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <div className="grid gap-8 text-[15px] sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="leading-relaxed text-muted">Soins capillaires fabriqués par nos soins et salon de coiffure.</p>
          </div>
          <FooterNav title="Boutique" links={[['Tous les produits', '/boutique'], ['Sérums', '/boutique?category=serums'], ['Hydratants et crèmes', '/boutique?category=hydratants-et-cremes'], ['Soins traitants', '/boutique?category=soins-traitants']]} />
          <FooterNav title="Salon" links={[['Prestations', '/#prestations'], ['Réserver', '/reserver'], ['Horaires', '/#salon']]} />
          <FooterNav title="Aide" links={[['Panier', '/panier'], ['Contact', '/#salon']]} />
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-ink-line pt-6 text-[13px] text-[#a3a3a3]">
          <span>© {new Date().getFullYear()} Dabo Hair</span>
          <span>Mentions légales · Confidentialité · Conditions de vente</span>
        </div>
      </div>
    </footer>
  )
}

function FooterNav({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-2.5">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-gold uppercase">{title}</p>
      {links.map(([label, to]) => (
        <Link key={to} to={to} className="hover:text-gold">
          {label}
        </Link>
      ))}
    </nav>
  )
}
