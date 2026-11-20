/**
 * TARIFS DE LIVRAISON (maquette validée le 21 novembre 2026).
 * Zones : nom, frais, délai annoncé, « proposée sur le site ». Une zone ne se supprime pas : on la cache.
 * Changer des frais vaut pour les NOUVELLES commandes (une commande garde ses frais). Livraison offerte facultative.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan } from '@/features/auth/permissions'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import { cn } from '@/lib/utils'
import type { AdminDeliveryZone, DeliveryOverview } from '@/types/admin'
import { useCreateDeliveryZone, useDelivery, useUpdateDeliverySettings, useUpdateDeliveryZone } from '../api'
import { AdminField, AdminInput, Card, Feedback, PageHeader, Table } from '../components/ui'
import { firstError } from './OrdersPages'

type Message = { kind: 'success' | 'error'; text: string } | null
type Draft = { fee: string; delay: string; active: boolean }
const toDraft = (z: AdminDeliveryZone): Draft => ({ fee: String(z.fee), delay: z.delay_label ?? '', active: z.is_active })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

export function DeliveryPage() {
  const delivery = useDelivery()
  // Le message vit ici : le formulaire est recréé après chaque enregistrement (clé), il ne doit pas l'emporter
  const [message, setMessage] = useState<Message>(null)
  if (delivery.isError) return <QueryError message={apiErrorMessage(delivery.error)} onRetry={() => delivery.refetch()} />
  if (delivery.isPending) return <Skeleton className="h-96 bg-[#e4e4e7]" />
  // key : après un enregistrement, le formulaire repart des valeurs du serveur
  return <DeliveryForm key={delivery.dataUpdatedAt} data={delivery.data} message={message} setMessage={setMessage} />
}

function DeliveryForm({ data, message, setMessage }: { data: DeliveryOverview; message: Message; setMessage: (m: Message) => void }) {
  const canManage = useCan('products.manage')
  const update = useUpdateDeliveryZone()
  const create = useCreateDeliveryZone()
  const settings = useUpdateDeliverySettings()
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => Object.fromEntries(data.zones.map((z) => [z.id, toDraft(z)])))
  const [freeOn, setFreeOn] = useState(data.free_delivery_threshold !== null)
  const [threshold, setThreshold] = useState(String(data.free_delivery_threshold ?? 25000))
  const [newZone, setNewZone] = useState({ name: '', fee: '', delay: '' })
  const [saving, setSaving] = useState(false)

  const set = (id: number, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id]!, ...patch } }))
  const changed = data.zones.filter((z) => {
    const d = drafts[z.id]!
    return Number(d.fee) !== z.fee || (d.delay.trim() || null) !== z.delay_label || d.active !== z.is_active
  })
  const wantedThreshold = freeOn ? Number(threshold) : null
  const thresholdChanged = wantedThreshold !== data.free_delivery_threshold
  const valid = data.zones.every((z) => drafts[z.id]!.fee !== '' && Number(drafts[z.id]!.fee) >= 0) && (!freeOn || Number(threshold) >= 1000)
  const preview = data.zones.find((z) => drafts[z.id]!.active)

  // Un enregistrement par zone modifiée, puis le seuil : chaque changement passe par le journal d'audit
  const save = async () => {
    setMessage(null)
    setSaving(true)
    try {
      for (const z of changed) {
        const d = drafts[z.id]!
        await update.mutateAsync({ id: z.id, fee: Number(d.fee), delay_label: d.delay.trim() || null, is_active: d.active })
      }
      if (thresholdChanged) await settings.mutateAsync({ free_delivery_threshold: wantedThreshold })
      setMessage({ kind: 'success', text: 'Tarifs enregistrés. Ils valent pour les nouvelles commandes.' })
    } catch (e) {
      setMessage({ kind: 'error', text: firstError(e) })
    } finally {
      setSaving(false)
    }
  }

  const addZone = (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    create.mutate({ name: newZone.name.trim(), fee: Number(newZone.fee), delay_label: newZone.delay.trim() || null }, {
      onSuccess: (z) => { setNewZone({ name: '', fee: '', delay: '' }); setMessage({ kind: 'success', text: `Zone « ${z.name} » ajoutée.` }) },
      onError: (err) => setMessage({ kind: 'error', text: firstError(err) }),
    })
  }

  return (
    <>
      <Seo title="ERP — Livraison" />
      <PageHeader
        title="Livraison"
        subtitle="Les zones et leurs frais. Une commande déjà passée garde toujours les frais du jour où elle a été passée."
        actions={canManage && <Button variant="dark" disabled={(!changed.length && !thresholdChanged) || !valid || saving} onClick={() => void save()}>{saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</Button>}
      />
      {message && <Feedback kind={message.kind}>{message.text}</Feedback>}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Card title={`Zones de livraison (${data.zones.length})`}>
            <Table head={['Zone', 'Frais (F CFA)', 'Délai annoncé', 'Commandes (30 j)', 'Sur le site']} minWidth={760}>
              {data.zones.map((z) => {
                const d = drafts[z.id]!
                return (
                  <tr key={z.id} className={cn(!d.active && 'opacity-70')}>
                    <td><strong>{z.name}</strong>{!d.active && <><br /><span className="text-xs text-[#52525b]">cachée sur le site</span></>}</td>
                    <td><AdminInput aria-label={`Frais pour ${z.name}`} type="number" min={0} step={100} value={d.fee} disabled={!canManage} onChange={(e) => set(z.id, { fee: e.target.value })} className="w-28" /></td>
                    <td><AdminInput aria-label={`Délai pour ${z.name}`} value={d.delay} maxLength={40} placeholder="Ex. 24 h" disabled={!canManage} onChange={(e) => set(z.id, { delay: e.target.value })} className="w-40" /></td>
                    <td>{z.orders_30d ?? 0}</td>
                    <td>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="size-[18px] accent-ink" checked={d.active} disabled={!canManage} onChange={(e) => set(z.id, { active: e.target.checked })} aria-label={`Proposer ${z.name} sur le site`} />
                        {d.active ? 'Oui' : 'Non'}
                      </label>
                    </td>
                  </tr>
                )
              })}
            </Table>
          </Card>

          {canManage && (
            <Card title="Ajouter une zone">
              <form onSubmit={addZone} className="grid gap-3 sm:grid-cols-[2fr_1fr_1.3fr_auto] sm:items-end">
                <AdminField label="Nom (quartiers, villes)" htmlFor="dz-name"><AdminInput id="dz-name" value={newZone.name} maxLength={100} placeholder="Ex. Diamniadio" onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} required /></AdminField>
                <AdminField label="Frais (F CFA)" htmlFor="dz-fee"><AdminInput id="dz-fee" type="number" min={0} step={100} value={newZone.fee} onChange={(e) => setNewZone({ ...newZone, fee: e.target.value })} required /></AdminField>
                <AdminField label="Délai annoncé" htmlFor="dz-delay"><AdminInput id="dz-delay" value={newZone.delay} maxLength={40} placeholder="Ex. 48 h" onChange={(e) => setNewZone({ ...newZone, delay: e.target.value })} /></AdminField>
                <Button type="submit" variant="dark" disabled={newZone.name.trim().length < 2 || newZone.fee === '' || create.isPending}>Ajouter</Button>
              </form>
            </Card>
          )}

          <Card title="Livraison offerte">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-[18px] accent-ink" checked={freeOn} disabled={!canManage} onChange={(e) => setFreeOn(e.target.checked)} />
                {freeOn ? 'Oui' : 'Non'}
              </label>
              {freeOn && <>
                <label htmlFor="dz-threshold">à partir de</label>
                <AdminInput id="dz-threshold" type="number" min={1000} step={1000} value={threshold} disabled={!canManage} onChange={(e) => setThreshold(e.target.value)} className="w-36" />
                <span className="text-[#52525b]">F d’achats (hors livraison), dans toutes les zones</span>
              </>}
            </div>
            {freeOn && Number(threshold) < 1000 && <p className="text-sm text-[#b91c1c]">Au moins 1 000 F.</p>}
            <p className="text-sm text-[#52525b]">Sur le site : « Plus que 3 000 F pour la livraison offerte » dans le panier et à la commande. Le retrait au salon reste gratuit.</p>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Card title="Sur le site (commande)">
            <div className="flex flex-col gap-2 rounded-2xl bg-ink p-4 text-sm text-ivory">
              <span className="text-[#d9d9d9]">Zone de livraison *</span>
              <span className="rounded-[10px] border border-[#3a3a3a] px-3 py-2.5">{preview ? `${preview.name} — ${formatPrice(Number(drafts[preview.id]!.fee) || 0)}` : 'Aucune zone proposée'}</span>
              {preview && drafts[preview.id]!.delay.trim() && <span className="text-xs text-muted">Délai annoncé : {drafts[preview.id]!.delay.trim()}</span>}
            </div>
            <p className="text-sm text-[#52525b]">La liste ne montre que les zones « proposées ». Une zone cachée reste dans l’historique des anciennes commandes.</p>
          </Card>
          <Card title="Dernières modifications">
            {data.history.length === 0 ? <p className="text-sm text-[#52525b]">Aucune modification pour l’instant.</p> : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.history.map((h) => {
                  const before = h.changes.old ?? {}
                  const after = h.changes.attributes ?? {}
                  const what = h.event === 'settings'
                    ? `livraison offerte : ${after.free_delivery_threshold ? formatPrice(Number(after.free_delivery_threshold)) : 'désactivée'}`
                    : h.event === 'created' ? `${h.subject} ajoutée`
                      : 'fee' in after ? `${h.subject} : ${formatPrice(Number(before.fee))} → ${formatPrice(Number(after.fee))}`
                        : 'is_active' in after ? `${h.subject} ${after.is_active ? 'proposée' : 'cachée'}` : `${h.subject} modifiée`
                  return <li key={h.id}><span className="text-[#52525b]">{h.created_at ? `${shortDate(h.created_at)} · ` : ''}{h.causer}</span> · {what}</li>
                })}
              </ul>
            )}
            <Link to="/admin/audit" className="text-sm text-gold-text underline">Tout est dans le Journal d’audit</Link>
          </Card>
        </aside>
      </div>
    </>
  )
}
