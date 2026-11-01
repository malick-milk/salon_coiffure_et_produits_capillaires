/** Clients, équipe et rôles, journal d'audit (EF-ERP-05, 07 à 09) */
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/features/auth/hooks'
import { ROLE_LABELS } from '@/features/auth/permissions'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import type { StaffRole } from '@/types/admin'
import { useAdminCustomers, useAudit, useCreateStaff, useRoles, useStaff, useUpdateStaff } from '../api'
import { AdminField, AdminInput, AdminSelect, Card, dateTime, Feedback, PageHeader, Table } from '../components/ui'
import { firstError } from './OrdersPages'

export function CustomersPage() {
  const [params, setParams] = useSearchParams()
  const filters = { search: params.get('search') ?? undefined, type: params.get('type') ?? undefined, page: Number(params.get('page') ?? 1) }
  const customers = useAdminCustomers(filters)
  const [search, setSearch] = useState(filters.search ?? '')
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  return (
    <>
      <Seo title="ERP — Clients" />
      <PageHeader title="Clients" subtitle="Inscrits et invités. « Dépensé » = commandes payées + prestations terminées (valeur vie client)." />
      <Card>
        <form role="search" className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); update('search', search.trim()) }}>
          <div className="min-w-56 flex-1"><AdminField label="Rechercher (nom, téléphone, email)" htmlFor="c-search"><AdminInput id="c-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></AdminField></div>
          <AdminField label="Type" htmlFor="c-type">
            <AdminSelect id="c-type" value={filters.type ?? ''} onChange={(e) => update('type', e.target.value)}>
              <option value="">Tous</option><option value="individual">Particuliers</option><option value="reseller">Revendeurs</option>
            </AdminSelect>
          </AdminField>
          <Button type="submit" variant="dark" size="sm">Rechercher</Button>
        </form>
        {customers.isError ? <QueryError message={apiErrorMessage(customers.error)} onRetry={() => customers.refetch()} />
          : customers.isPending ? <Skeleton className="h-60 bg-[#e4e4e7]" /> : (
            <Table head={['Client', 'Contact', 'Compte', 'Commandes', 'RDV', 'Dépensé', 'Depuis']} minWidth={760}>
              {customers.data.data.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}{c.type === 'reseller' && <> <Badge tone="info">Revendeur</Badge></>}</td>
                  <td>{c.phone}{c.email && <><br /><span className="text-xs text-[#52525b]">{c.email}</span></>}</td>
                  <td>{c.has_account ? 'Inscrit' : 'Invité'}</td>
                  <td>{c.orders_count}</td>
                  <td>{c.bookings_count}</td>
                  <td className="font-semibold whitespace-nowrap">{formatPrice(c.total_spent)}</td>
                  <td>{c.since ?? '—'}</td>
                </tr>
              ))}
            </Table>
          )}
      </Card>
    </>
  )
}

const STAFF_ROLES: StaffRole[] = ['super_admin', 'manager', 'cashier', 'stock_keeper', 'stylist']

export function TeamPage() {
  const staff = useStaff()
  const roles = useRoles()
  const create = useCreateStaff()
  const update = useUpdateStaff()
  const { data: me } = useMe()
  const empty = { first_name: '', last_name: '', email: '', phone: '', role: 'cashier' as StaffRole, password: '' }
  const [form, setForm] = useState(empty)
  const [created, setCreated] = useState<string | null>(null)
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setCreated(null)
    create.mutate({ ...form, phone: form.phone.replace(/\s/g, '') || null }, { onSuccess: () => { setCreated(`Compte créé pour ${form.first_name}. Communiquez-lui son mot de passe de vive voix.`); setForm(empty) } })
  }

  return (
    <>
      <Seo title="ERP — Équipe" />
      <PageHeader title="Équipe et rôles" subtitle="Le code vérifie des permissions, jamais des noms de rôle : un rôle n’est qu’un ensemble de permissions." />
      {update.isError && <Feedback kind="error">{firstError(update.error)}</Feedback>}
      <Card title="Membres du personnel">
        {staff.isError ? <QueryError message={apiErrorMessage(staff.error)} onRetry={() => staff.refetch()} />
          : staff.isPending ? <Skeleton className="h-40 bg-[#e4e4e7]" /> : (
            <Table head={['Nom', 'Email', 'Rôle', 'Actif', 'Dernière connexion']} minWidth={720}>
              {staff.data.map((u) => (
                <tr key={u.id}>
                  <td className="font-semibold">{u.first_name} {u.last_name}{u.id === me?.id && <span className="text-xs text-[#52525b]"> (vous)</span>}</td>
                  <td>{u.email}</td>
                  <td>
                    <label className="sr-only" htmlFor={`role-${u.id}`}>Rôle de {u.first_name}</label>
                    <AdminSelect id={`role-${u.id}`} className="min-h-9" value={u.role ?? ''} disabled={update.isPending} onChange={(e) => update.mutate({ id: u.id, role: e.target.value as StaffRole })}>
                      {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </AdminSelect>
                  </td>
                  <td><input type="checkbox" aria-label={`Compte de ${u.first_name} actif`} className="size-[18px] accent-ink" checked={u.is_active} disabled={update.isPending} onChange={(e) => update.mutate({ id: u.id, is_active: e.target.checked })} /></td>
                  <td>{dateTime(u.last_login_at)}</td>
                </tr>
              ))}
            </Table>
          )}
      </Card>

      <Card title="Ajouter un membre du personnel">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          <AdminField label="Prénom" htmlFor="s-first"><AdminInput id="s-first" value={form.first_name} onChange={set('first_name')} required /></AdminField>
          <AdminField label="Nom" htmlFor="s-last"><AdminInput id="s-last" value={form.last_name} onChange={set('last_name')} required /></AdminField>
          <AdminField label="Email" htmlFor="s-email"><AdminInput id="s-email" type="email" value={form.email} onChange={set('email')} required /></AdminField>
          <AdminField label="Téléphone mobile (facultatif)" htmlFor="s-phone"><AdminInput id="s-phone" type="tel" value={form.phone} onChange={set('phone')} /></AdminField>
          <AdminField label="Rôle" htmlFor="s-role">
            <AdminSelect id="s-role" value={form.role} onChange={set('role')}>{STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</AdminSelect>
          </AdminField>
          <AdminField label="Mot de passe initial (10 caractères, lettres et chiffres)" htmlFor="s-password"><AdminInput id="s-password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required minLength={10} /></AdminField>
          <div className="flex flex-col gap-3 md:col-span-3">
            {create.isError && <Feedback kind="error">{firstError(create.error)}</Feedback>}
            {created && <Feedback kind="success">{created}</Feedback>}
            <Button type="submit" variant="dark" className="w-fit" disabled={create.isPending}>Créer le compte</Button>
          </div>
        </form>
      </Card>

      <Card title="Ce que chaque rôle peut faire">
        {roles.data && (
          <Table head={['Rôle', 'Permissions']} minWidth={560}>
            {roles.data.map((r) => (
              <tr key={r.name}><td className="font-semibold whitespace-nowrap">{ROLE_LABELS[r.name]}</td><td className="text-xs leading-relaxed text-[#3f3f46]">{r.permissions.join(' · ') || '—'}</td></tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}

const LOGS: Record<string, string> = { products: 'Produits', orders: 'Commandes', bookings: 'Réservations', stock: 'Stock', production: 'Fabrication', users: 'Équipe' }

const EVENTS: Record<string, string> = { created: 'Création', updated: 'Modification', deleted: 'Suppression', adjusted: 'Mouvement de stock', role_changed: 'Changement de rôle' }

export function AuditPage() {
  const [log, setLog] = useState('')
  const [page, setPage] = useState(1)
  const audit = useAudit({ log: log || undefined, page })

  /** « price : 3000 → 3500 » à partir des valeurs avant / après enregistrées par activitylog */
  const describe = (changes: unknown) => {
    if (!changes || Array.isArray(changes)) return '—'
    const c = changes as { old?: Record<string, unknown>; attributes?: Record<string, unknown> }
    if (c.attributes) return Object.entries(c.attributes).map(([k, v]) => `${k} : ${c.old?.[k] !== undefined ? `${String(c.old[k])} → ` : ''}${String(v)}`).join(' · ')
    return Object.entries(changes as Record<string, unknown>).map(([k, v]) => `${k} : ${String(v)}`).join(' · ')
  }

  return (
    <>
      <Seo title="ERP — Journal d’audit" />
      <PageHeader title="Journal d’audit" subtitle="Qui a modifié quoi, quand, avec les valeurs avant et après (RG-SEC-01)." />
      <Card>
        <div className="w-60">
          <AdminField label="Domaine" htmlFor="a-log">
            <AdminSelect id="a-log" value={log} onChange={(e) => { setLog(e.target.value); setPage(1) }}>
              <option value="">Tous</option>{Object.entries(LOGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </AdminSelect>
          </AdminField>
        </div>
        {audit.isError ? <QueryError message={apiErrorMessage(audit.error)} onRetry={() => audit.refetch()} />
          : audit.isPending ? <Skeleton className="h-60 bg-[#e4e4e7]" /> : (
            <Table head={['Date', 'Auteur', 'Domaine', 'Action', 'Objet', 'Modifications']} minWidth={860}>
              {audit.data.data.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{dateTime(a.created_at)}</td>
                  <td className="font-semibold">{a.causer}</td>
                  <td>{LOGS[a.log ?? ''] ?? a.log}</td>
                  <td>{EVENTS[a.event ?? ''] ?? a.event ?? a.description}</td>
                  <td>{a.subject_label ?? a.subject}{a.subject_label && <span className="block text-xs text-[#71717a]">{a.subject}</span>}</td>
                  <td className="text-xs">{describe(a.changes)}</td>
                </tr>
              ))}
            </Table>
          )}
        {audit.data && audit.data.meta.last_page > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-end gap-3 text-sm">
            <Button variant="subtle" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
            Page {audit.data.meta.current_page} / {audit.data.meta.last_page}
            <Button variant="subtle" size="sm" disabled={page >= audit.data.meta.last_page} onClick={() => setPage(page + 1)}>Suivant</Button>
          </nav>
        )}
      </Card>
    </>
  )
}
