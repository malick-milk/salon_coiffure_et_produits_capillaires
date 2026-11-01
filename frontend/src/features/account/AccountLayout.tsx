import { CalendarDays, LayoutDashboard, LogOut, Package, UserRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { useLogout, useMe } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/compte', label: 'Vue d’ensemble', Icon: LayoutDashboard, end: true },
  { to: '/compte/commandes', label: 'Mes commandes', Icon: Package, end: false },
  { to: '/compte/reservations', label: 'Mes réservations', Icon: CalendarDays, end: false },
  { to: '/compte/profil', label: 'Profil', Icon: UserRound, end: false },
]

/** Mise en page de l'espace client : menu à gauche (en haut sur mobile), page à droite */
export function AccountLayout() {
  return (
    <RequireAuth>
      <AccountShell />
    </RequireAuth>
  )
}

function AccountShell() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  return (
    <div className="px-4 pt-10 pb-24 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start">
        <nav aria-label="Mon compte" className="flex gap-1 overflow-x-auto rounded-2xl border border-ink-line bg-ink-soft p-2 lg:w-64 lg:shrink-0 lg:flex-col lg:p-3">
          <p className="hidden px-3.5 pt-1 pb-3 text-sm text-muted lg:block">Connectée en tant que <strong className="text-ivory">{user?.first_name}</strong></p>
          {LINKS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex min-h-12 shrink-0 items-center gap-3 rounded-[10px] px-3.5 whitespace-nowrap', isActive ? 'bg-gold-soft font-semibold text-gold' : 'hover:bg-ink')}>
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })}
            className="flex min-h-12 shrink-0 items-center gap-3 rounded-[10px] px-3.5 text-muted hover:bg-ink lg:mt-2 lg:border-t lg:border-ink-line"
          >
            <LogOut className="size-5" aria-hidden="true" />
            Se déconnecter
          </button>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
