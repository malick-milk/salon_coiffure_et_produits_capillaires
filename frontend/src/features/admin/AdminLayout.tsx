/**
 * Mise en page de l'ERP : menu latéral (filtré selon les permissions) + zone de travail claire.
 * Le menu caché n'est qu'un CONFORT : chaque route de l'API revérifie la permission.
 */
import { type LucideIcon, BarChart3, CalendarDays, ClipboardList, Factory, LayoutDashboard, LogOut, MapPin, MessageSquareHeart, Package, ScrollText, Store, Users, UsersRound } from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { useLogout, useMe } from '@/features/auth/hooks'
import { can, isStaff, ROLE_LABELS } from '@/features/auth/permissions'
import { cn } from '@/lib/utils'

type MenuItem = { to: string; label: string; Icon: LucideIcon; permission: string; end?: boolean }

export const ADMIN_MENU: { group: string; items: MenuItem[] }[] = [
  {
    group: 'Pilotage',
    items: [
      { to: '/admin', label: 'Tableau de bord', Icon: LayoutDashboard, permission: 'orders.view', end: true },
      { to: '/admin/analyses', label: 'Analyses', Icon: BarChart3, permission: 'analytics.view' },
    ],
  },
  {
    group: 'Activité',
    items: [
      { to: '/admin/commandes', label: 'Commandes', Icon: ClipboardList, permission: 'orders.view' },
      { to: '/admin/planning', label: 'Planning', Icon: CalendarDays, permission: 'bookings.view' },
      { to: '/admin/clients', label: 'Clients', Icon: UsersRound, permission: 'customers.view' },
      { to: '/admin/points-de-retrait', label: 'Points de retrait', Icon: MapPin, permission: 'partners.manage' },
      { to: '/admin/avis', label: 'Avis clients', Icon: MessageSquareHeart, permission: 'reviews.manage' },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { to: '/admin/produits', label: 'Produits et stock', Icon: Package, permission: 'products.view' },
      { to: '/admin/fabrication', label: 'Fabrication', Icon: Factory, permission: 'stock.view' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { to: '/admin/equipe', label: 'Équipe et rôles', Icon: Users, permission: 'users.manage' },
      { to: '/admin/audit', label: 'Journal d’audit', Icon: ScrollText, permission: 'audit.view' },
    ],
  },
]

export function AdminLayout() {
  const { data: user, isPending } = useMe()
  const location = useLocation()
  const navigate = useNavigate()
  const logout = useLogout()

  if (isPending) return <div className="min-h-screen bg-[#f4f4f5] p-8"><Skeleton className="h-64 bg-[#e4e4e7]" /></div>
  if (!user) return <Navigate to={`/connexion?redirect=${encodeURIComponent(location.pathname)}`} replace />
  if (!isStaff(user)) return <Forbidden />

  const menu = ADMIN_MENU.map((g) => ({ ...g, items: g.items.filter((i) => can(user, i.permission)) })).filter((g) => g.items.length)
  // Un coiffeur n'a pas accès au tableau de bord : il arrive directement sur le planning
  if (location.pathname === '/admin' && !can(user, 'orders.view')) return <Navigate to={menu[0]?.items[0]?.to ?? '/'} replace />

  // Mobile : menu AU-DESSUS du contenu (flex-col). « flex-wrap » écrasait le contenu : avec flex-basis 0,
  // il tenait « en théorie » sur la même ligne que le menu pleine largeur. Écran large : côte à côte.
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-ink [color-scheme:light] lg:flex-row">
      <nav aria-label="Menu ERP" className="flex w-full flex-col gap-5 bg-ink p-4 text-ivory lg:min-h-screen lg:w-64 lg:shrink-0">
        <Link to="/admin" className="flex h-12 items-center justify-center rounded-lg border border-dashed border-gold font-display text-lg text-gold">Dabo Hair · ERP</Link>
        <div className="flex gap-4 overflow-x-auto lg:flex-col lg:gap-5 lg:overflow-visible">
          {menu.map((g) => (
            <div key={g.group} className="flex shrink-0 gap-1 lg:flex-col">
              <p className="hidden px-3 pb-1 text-[11px] tracking-[0.16em] text-[#a3a3a3] uppercase lg:block">{g.group}</p>
              {g.items.map(({ to, label, Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium whitespace-nowrap', isActive ? 'bg-gold text-ink' : 'text-[#e4e4e7] hover:bg-ink-soft')}>
                  <Icon className="size-[18px]" aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-1 border-t border-ink-line pt-4">
          <Link to="/" className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm text-[#e4e4e7] hover:bg-ink-soft"><Store className="size-[18px]" aria-hidden="true" />Voir le site</Link>
          <button type="button" onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })} className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-left text-sm text-[#e4e4e7] hover:bg-ink-soft">
            <LogOut className="size-[18px]" aria-hidden="true" />Se déconnecter
          </button>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e7] bg-white px-6 py-3">
          <span className="flex items-center gap-2 text-sm text-[#52525b]"><CalendarDays className="size-4" aria-hidden="true" />{new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span>
          <span className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-gold" aria-hidden="true">{user.first_name.charAt(0)}{user.last_name.charAt(0)}</span>
            <span className="flex flex-col text-sm leading-tight"><strong>{user.first_name} {user.last_name}</strong><span className="text-xs text-[#52525b]">{ROLE_LABELS[user.roles[0] ?? ''] ?? user.roles[0]}</span></span>
          </span>
        </header>
        <main className="flex flex-col gap-6 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f4f5] p-6 text-center text-ink">
      <h1 className="font-display text-3xl font-semibold">Accès réservé au personnel</h1>
      <p className="text-[#52525b]">Votre compte n’a pas accès à l’espace d’administration.</p>
      <Link to="/compte" className="rounded-full bg-ink px-6 py-3 font-semibold text-ivory">Aller à mon compte</Link>
    </div>
  )
}
