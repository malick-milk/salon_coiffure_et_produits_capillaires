/**
 * CONTRATS ET RH (maquette validée le 26 novembre 2026). Propriétaire seulement (permission hr.manage).
 * 1. Liste : alertes en haut (fin de CDD, fin d'essai, contrat non signé), l'équipe, contrats terminés à part.
 * 2. Fiche : l'employée, le contrat, la rémunération, les documents ; à droite les actions de fin de contrat,
 *    les congés et l'historique. Les règles du Code du travail sont appliquées par le serveur.
 */
import axios from 'axios'
import { FileText, Plus, Printer, Trash2 } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage, type ValidationErrorBody } from '@/lib/http'
import { cn } from '@/lib/utils'
import type { HrAlert, HrContract, HrOptions, HrRow, HrSheet, PayMethod } from '@/types/admin'
import {
  hrContractPdfUrl, hrDocumentUrl, useAddEmployeeDocument, useAddLeave, useConvertContract, useCreateEmployee, useHrEmployee, useHrEmployees,
  useRemoveEmployeeDocument, useRenewContract, useTerminateContract, useUpdateEmployee,
} from '../api'
import { AdminField, AdminInput, AdminSelect, Card, Feedback, PageHeader, Table } from '../components/ui'
import {
  CONTRACT_TYPES, EMPTY_FORM, END_LABEL, END_REASONS, formFromSheet, historyLine, isFixedTerm, longDate, missingFields, nextDay, PAY_LABEL, shortDate,
  STATE, toPayload, TYPE_LABEL, type HrFormValues,
} from '../hrForm'
import { firstError } from './OrdersPages'

const todayIso = () => new Date().toISOString().slice(0, 10)
const money = (n: number | null) => (n === null ? '—' : formatPrice(n))

function pay(r: Pick<HrRow, 'type' | 'base_salary' | 'commission_rate'>) {
  if (r.type === 'prestataire' && !r.base_salary) return 'Par mission'
  const base = r.base_salary ? formatPrice(r.base_salary) : 'Fixe à saisir'
  return r.commission_rate > 0 ? `${base} + ${r.commission_rate.toLocaleString('fr-FR')} %` : base
}

function AlertCard({ alert, action }: { alert: HrAlert; action?: ReactNode }) {
  const danger = alert.level === 'danger'
  return (
    <div className={cn('flex flex-col gap-1 rounded-2xl border p-4', danger ? 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]' : 'border-[#fde68a] bg-[#fffbeb] text-[#78350f]')}>
      <strong>{alert.title}</strong>
      <span className="text-sm">{alert.text}</span>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------- 1. Liste
export function HrListPage() {
  const hr = useHrEmployees()
  const [showEnded, setShowEnded] = useState(false)
  const rows = hr.data?.data ?? []
  const ended = hr.data?.ended ?? []

  return (
    <>
      <Seo title="ERP — Contrats et RH" />
      <PageHeader
        title="Contrats et RH"
        subtitle="Les contrats de travail de l’équipe. Visible par la propriétaire seulement : salaires et pièces d’identité sont confidentiels."
        actions={<Button asChild variant="dark"><Link to="/admin/contrats/nouveau"><Plus aria-hidden="true" /> Nouveau contrat</Link></Button>}
      />
      {hr.isError ? <QueryError message={apiErrorMessage(hr.error)} onRetry={() => hr.refetch()} />
        : hr.isPending ? <Skeleton className="h-64 bg-[#e4e4e7]" /> : (
          <>
            {hr.data.alerts.length > 0 && (
              <section aria-label="À traiter" className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {hr.data.alerts.map((a, i) => (
                  <AlertCard key={i} alert={a} action={
                    <Link to={`/admin/contrats/${a.employee_id}`} className={cn('text-sm font-semibold underline', a.level === 'danger' ? 'text-[#991b1b]' : 'text-gold-text')}>
                      {a.kind === 'unsigned' ? 'Ajouter le contrat signé' : 'Ouvrir le contrat'}<span className="sr-only"> de {rows.find((r) => r.id === a.employee_id)?.name}</span>
                    </Link>
                  } />
                ))}
              </section>
            )}
            <Card
              title={`L’équipe (${rows.length} contrat${rows.length > 1 ? 's' : ''} en cours)`}
              actions={<span className="text-sm text-[#52525b]">Salaires fixes du mois : <strong className="text-ink">{formatPrice(hr.data.payroll.base_total)}</strong>
                {hr.data.payroll.commissions > 0 && <> + commissions {formatPrice(hr.data.payroll.commissions)}</>}</span>}
            >
              {rows.length === 0 ? <p className="text-sm text-[#52525b]">Aucun contrat pour l’instant. Commencez par « Nouveau contrat ».</p> : <TeamTable rows={rows} />}
              {ended.length > 0 && (
                <button type="button" aria-expanded={showEnded} onClick={() => setShowEnded((v) => !v)} className="self-start text-sm font-semibold text-gold-text underline">
                  {showEnded ? 'Masquer' : 'Voir aussi'} les contrats terminés ({ended.length})
                </button>
              )}
              {showEnded && <TeamTable rows={ended} />}
            </Card>
          </>
        )}
    </>
  )
}

function TeamTable({ rows }: { rows: HrRow[] }) {
  return (
    <Table head={['Employée', 'Poste', 'Contrat', 'Depuis', 'Fin', 'Rémunération', 'État']} minWidth={860}>
      {rows.map((r) => (
        <tr key={r.id}>
          <td><Link to={`/admin/contrats/${r.id}`} className="font-semibold underline-offset-2 hover:underline">{r.name}</Link></td>
          <td>{r.position}</td>
          <td>{TYPE_LABEL[r.type]}</td>
          <td className="whitespace-nowrap">{shortDate(r.starts_on)}</td>
          <td className={cn('whitespace-nowrap', (r.state === 'ending' || r.state === 'overdue') && 'font-semibold text-gold-text')}>{r.ends_on ? shortDate(r.ends_on) : '—'}</td>
          <td>{pay(r)}</td>
          <td><Badge tone={STATE[r.state].tone}>{STATE[r.state].label}</Badge></td>
        </tr>
      ))}
    </Table>
  )
}

// ---------------------------------------------------------------- 2. Fiche (nouveau contrat ou existant)
function serverErrors(error: unknown): Partial<Record<keyof HrFormValues, string>> {
  if (axios.isAxiosError<ValidationErrorBody>(error) && error.response?.data.errors) {
    return Object.fromEntries(Object.entries(error.response.data.errors).map(([k, v]) => [k, v[0]]))
  }
  return {}
}

export function HrSheetPage() {
  const params = useParams()
  const id = params.id ? Number(params.id) : null
  const query = useHrEmployee(id)
  if (id === null) return <HrForm sheet={null} options={null} />
  if (query.isError) return <QueryError message={apiErrorMessage(query.error)} onRetry={() => query.refetch()} />
  if (query.isPending) return <Skeleton className="h-96 bg-[#e4e4e7]" />
  return <HrForm key={query.data.data.id} sheet={query.data.data} options={query.data.options} />
}

function HrForm({ sheet, options }: { sheet: HrSheet | null; options: HrOptions | null }) {
  const navigate = useNavigate()
  const saved = (useLocation().state as { saved?: string } | null)?.saved
  const [form, setForm] = useState<HrFormValues>(() => (sheet ? formFromSheet(sheet) : { ...EMPTY_FORM, starts_on: todayIso() }))
  const [errors, setErrors] = useState<Partial<Record<keyof HrFormValues, string>>>({})
  const [done, setDone] = useState<string | null>(saved ?? null)
  const create = useCreateEmployee()
  const update = useUpdateEmployee(sheet?.id ?? 0)
  const mutation = sheet ? update : create
  const contract = sheet?.contract ?? null
  const ended = Boolean(contract?.ended_on)
  const p = useId()

  // Le formulaire se recharge seulement après une action sur le contrat (CDI, renouvellement, fin) :
  // ajouter un document ou un congé ne doit pas effacer une saisie en cours
  const version = sheet ? [sheet.contract?.id, sheet.contract?.type, sheet.contract?.ends_on, sheet.contract?.ended_on, sheet.contract?.signed_on].join('|') : ''
  useEffect(() => { if (sheet) setForm(formFromSheet(sheet)) }, [version]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof HrFormValues) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const field = (k: keyof HrFormValues, label: string, props: Partial<React.ComponentProps<'input'>> = {}) => (
    <AdminField label={label} htmlFor={`${p}-${k}`} error={errors[k]}>
      <AdminInput id={`${p}-${k}`} value={form[k]} onChange={set(k)} aria-invalid={Boolean(errors[k])} disabled={ended} {...props} />
    </AdminField>
  )

  async function submit(e: FormEvent) {
    e.preventDefault()
    setDone(null)
    const missing = missingFields(form)
    setErrors(missing)
    if (Object.keys(missing).length) {
      document.getElementById(`${p}-${Object.keys(missing)[0]}`)?.focus()
      return
    }
    try {
      const result = await mutation.mutateAsync(toPayload(form))
      if (!sheet) navigate(`/admin/contrats/${result.id}`, { state: { saved: 'Contrat enregistré.' } })
      else setDone('Modifications enregistrées.')
    } catch (err) {
      const server = serverErrors(err)
      setErrors(server)
      const first = Object.keys(server)[0]
      if (first) document.getElementById(`${p}-${first}`)?.focus()
    }
  }

  const type = form.type as HrContract['type']
  const title = sheet ? `${sheet.employee.name} · ${contract?.position ?? ''}` : 'Nouveau contrat'

  return (
    <>
      <Seo title={`ERP — ${sheet ? sheet.employee.name : 'Nouveau contrat'}`} />
      <nav aria-label="Fil d’Ariane" className="text-[13px] text-[#52525b]"><Link to="/admin/contrats" className="underline">Contrats et RH</Link> / {sheet?.employee.name ?? 'Nouveau contrat'}</nav>
      <PageHeader title={title} actions={<>
        {contract && <Button asChild variant="subtle"><a href={hrContractPdfUrl(contract.id)} target="_blank" rel="noreferrer"><Printer aria-hidden="true" /> Imprimer le contrat</a></Button>}
        {!ended && <Button type="submit" form={`${p}-form`} variant="dark" disabled={mutation.isPending}>{mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>}
      </>} />
      {done && <Feedback kind="success">{done}</Feedback>}
      {mutation.isError && Object.keys(errors).length === 0 && <Feedback kind="error">{firstError(mutation.error)}</Feedback>}
      {ended && contract && <Feedback kind="success">Contrat terminé le {longDate(contract.ended_on)} ({contract.end_reason ? END_LABEL[contract.end_reason] : '—'}). La fiche reste consultable.</Feedback>}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <form id={`${p}-form`} onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-5">
          <Card title="1. L’employée">
            <div className="grid gap-3 md:grid-cols-3">
              {field('first_name', 'Prénom *', { autoComplete: 'off' })}
              {field('last_name', 'Nom *', { autoComplete: 'off' })}
              {field('phone', 'Téléphone', { inputMode: 'tel', placeholder: '77 123 45 67' })}
              {field('birth_date', 'Date de naissance', { type: 'date' })}
              {field('id_number', 'N° de pièce d’identité (CNI)')}
              {field('address', 'Adresse')}
              {field('ipres_number', 'N° IPRES (retraite)')}
              {field('css_number', 'N° Caisse de sécurité sociale')}
            </div>
            {options && (
              <div className="grid gap-3 md:grid-cols-2">
                <AdminField label="Compte dans l’ERP (facultatif)" htmlFor={`${p}-user_id`}>
                  <AdminSelect id={`${p}-user_id`} value={form.user_id} onChange={set('user_id')} disabled={ended}>
                    <option value="">Aucun</option>
                    {options.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </AdminSelect>
                </AdminField>
                <AdminField label="Fiche dans le planning (pour la commission)" htmlFor={`${p}-stylist_id`}>
                  <AdminSelect id={`${p}-stylist_id`} value={form.stylist_id} onChange={set('stylist_id')} disabled={ended}>
                    <option value="">Aucune</option>
                    {options.stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </AdminSelect>
                </AdminField>
              </div>
            )}
            <p className="text-xs text-[#52525b]">Les numéros CNI, IPRES et CSS sont chiffrés dans la base et n’apparaissent jamais dans le journal d’audit.</p>
          </Card>

          <Card title="2. Le contrat">
            <fieldset disabled={ended || (contract?.renewal_count ?? 0) > 0}>
              <legend className="sr-only">Type de contrat</legend>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
                {CONTRACT_TYPES.map((t) => (
                  <label key={t.value} className={cn('flex cursor-pointer flex-col items-center rounded-xl border p-3 text-center text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold',
                    form.type === t.value ? 'border-2 border-ink bg-[#fafafa] font-bold' : 'border-[#d4d4d8]')}>
                    <input type="radio" name={`${p}-type`} value={t.value} checked={form.type === t.value} onChange={set('type')} className="sr-only" />
                    {t.label}<span className="text-xs font-normal text-[#52525b]">{t.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 md:grid-cols-3">
              {field('position', 'Poste *', { placeholder: 'Coiffeuse' })}
              {field('starts_on', 'Début *', { type: 'date' })}
              {isFixedTerm(type) && field('ends_on', `Fin${type === 'cdd' ? ' (CDD)' : ''} *`, { type: 'date', disabled: ended || Boolean(contract?.renewal_count) })}
              {type !== 'prestataire' && field('trial_ends_on', 'Fin de la période d’essai', { type: 'date' })}
              {type !== 'prestataire' && field('weekly_hours', 'Heures par semaine', { inputMode: 'numeric' })}
              {type !== 'prestataire' && field('work_days', 'Jours de travail')}
              {field('signed_on', 'Signé le', { type: 'date' })}
            </div>
            <p className="text-[13px] text-[#52525b]">
              {type === 'cdd' ? 'CDD : 2 ans au plus, un seul renouvellement, 4 ans de CDD au total chez Dabo Hair ; l’ERP prévient 30 jours avant la fin. Au-delà, le contrat devient un CDI (Code du travail 2026, art. 100 et 101).'
                : type === 'prestataire' ? 'Prestataire : il organise lui-même son travail et peut avoir d’autres clients. S’il a des horaires imposés et des ordres comme une salariée, c’est en réalité un contrat de travail.'
                  : 'Les durées légales (essai, préavis, congés) sont à confirmer avec un comptable ou l’inspection du travail.'}
            </p>
          </Card>

          <Card title="3. La rémunération">
            <div className="grid gap-3 md:grid-cols-3">
              {field('base_salary', type === 'apprentissage' ? 'Indemnité mensuelle (F CFA)' : type === 'prestataire' ? 'Montant mensuel (F CFA, facultatif)' : 'Salaire fixe mensuel brut (F CFA)', { inputMode: 'numeric' })}
              {field('commission_rate', 'Commission sur ses prestations (%)', { inputMode: 'decimal' })}
              <AdminField label="Paiement" htmlFor={`${p}-pay_method`}>
                <AdminSelect id={`${p}-pay_method`} value={form.pay_method} onChange={set('pay_method')} disabled={ended}>
                  {(Object.keys(PAY_LABEL) as PayMethod[]).map((m) => <option key={m} value={m}>{PAY_LABEL[m]}</option>)}
                </AdminSelect>
              </AdminField>
            </div>
            {contract && contract.commission_rate > 0 && <Commission contract={contract} base={contract.base_salary} />}
            {type !== 'prestataire' && <p className="text-[13px] text-[#52525b]">Le salaire ne peut pas être inférieur au SMIG (environ 64 223 F CFA par mois pour 173,33 heures, décret de 2023 ; à vérifier).</p>}
          </Card>
        </form>

        <aside className="flex min-w-0 flex-col gap-5">
          {sheet && contract && !ended && <EndOfContract sheet={sheet} contract={contract} onDone={setDone} />}
          {sheet && <Documents sheet={sheet} />}
          {sheet && <Leaves sheet={sheet} disabled={ended} />}
          {sheet && (
            <Card title="Historique">
              {sheet.history.length === 0 ? <p className="text-sm text-[#52525b]">Aucune modification.</p> : (
                <ul className="flex flex-col gap-1.5 text-sm text-[#52525b]">
                  {sheet.history.map((h, i) => <li key={i}>{h.created_at ? shortDate(h.created_at.slice(0, 10)) : '—'} · {historyLine(h)} ({h.causer})</li>)}
                </ul>
              )}
              {sheet.contracts.length > 1 && (
                <p className="text-sm text-[#52525b]">Contrats successifs : {sheet.contracts.map((c) => `${TYPE_LABEL[c.type]} depuis le ${shortDate(c.starts_on)}${c.ended_on ? ` (fin ${shortDate(c.ended_on)})` : ''}`).join(' · ')}</p>
              )}
              <Link to="/admin/audit" className="text-sm font-semibold text-gold-text underline">Tout est dans le Journal d’audit</Link>
            </Card>
          )}
          {!sheet && (
            <Card title="Avant de faire signer">
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-[#52525b]">
                <li>Un CDD doit être écrit ; il est à déposer à l’inspection du travail avant le début (à confirmer).</li>
                <li>Déclarez la salariée à l’IPRES et à la Caisse de sécurité sociale.</li>
                <li>Après l’enregistrement : « Imprimer le contrat », faites signer en deux exemplaires, puis ajoutez le PDF signé.</li>
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}

function Commission({ contract, base }: { contract: HrContract; base: number | null }) {
  const c = contract.commission
  const month = new Date(`${c.month}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long' })
  if (!c.linked) return <p className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-3.5 py-3 text-sm">Pour calculer la commission, reliez la fiche à sa fiche du planning (section 1).</p>
  return (
    <div className="flex flex-wrap justify-between gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-3 text-sm">
      <span className="first-letter:uppercase">{month} : {base ? `${formatPrice(base)} + ` : ''}{c.rate.toLocaleString('fr-FR')} % de {formatPrice(c.revenue)} de prestations réalisées</span>
      <strong className="text-[#166534]">{base ? `${formatPrice(base + c.commission)}` : `+ ${formatPrice(c.commission)}`}</strong>
    </div>
  )
}

type EndAction = 'cdi' | 'renew' | 'end' | null
function EndOfContract({ sheet, contract, onDone }: { sheet: HrSheet; contract: HrContract; onDone: (m: string) => void }) {
  const [action, setAction] = useState<EndAction>(null)
  const fixed = isFixedTerm(contract.type)
  const [date, setDate] = useState('')
  const [reason, setReason] = useState<string>('end_of_term')
  const [note, setNote] = useState('')
  const renew = useRenewContract()
  const convert = useConvertContract()
  const terminate = useTerminateContract()
  const busy = renew.isPending || convert.isPending || terminate.isPending
  const error = renew.error ?? convert.error ?? terminate.error
  const p = useId()
  const alert = contract.alerts.find((a) => a.kind === 'ending' || a.kind === 'overdue')

  const open = (a: EndAction) => {
    renew.reset(); convert.reset(); terminate.reset()
    setAction(a)
    setDate(a === 'cdi' ? (contract.ends_on && contract.ends_on >= todayIso() ? nextDay(contract.ends_on) : todayIso()) : a === 'end' ? (contract.ends_on ?? todayIso()) : '')
    setReason(fixed ? 'end_of_term' : 'resigned')
  }
  async function confirm(e: FormEvent) {
    e.preventDefault()
    if (action === 'renew') await renew.mutateAsync({ contractId: contract.id, ends_on: date })
    if (action === 'cdi') await convert.mutateAsync({ contractId: contract.id, starts_on: date })
    if (action === 'end') await terminate.mutateAsync({ contractId: contract.id, ended_on: date, end_reason: reason, end_note: note || null })
    onDone(action === 'renew' ? 'CDD renouvelé.' : action === 'cdi' ? `${sheet.employee.first_name} passe en CDI.` : 'Contrat terminé.')
    setAction(null)
  }

  const box = alert ? (alert.level === 'danger' ? 'border-[#fecaca] bg-[#fef2f2]' : 'border-[#fde68a] bg-[#fffbeb]') : 'border-[#e4e4e7] bg-white'
  return (
    <section aria-labelledby={`${p}-t`} className={cn('flex flex-col gap-2.5 rounded-2xl border p-[18px]', box)}>
      <h2 id={`${p}-t`} className={cn('text-base font-semibold', alert && (alert.level === 'danger' ? 'text-[#991b1b]' : 'text-[#78350f]'))}>{alert ? alert.title : fixed ? `Fin prévue le ${longDate(contract.ends_on)}` : 'Fin du contrat'}</h2>
      {fixed && <span className="text-sm">Que faire au {longDate(contract.ends_on)} ?</span>}
      {fixed && <Button type="button" variant="dark" onClick={() => open('cdi')} aria-expanded={action === 'cdi'}>Passer en CDI</Button>}
      {contract.can_renew && <Button type="button" variant="subtle" onClick={() => open('renew')} aria-expanded={action === 'renew'}>Renouveler le CDD (1 fois)</Button>}
      {contract.type === 'cdd' && !contract.can_renew && <p className="text-[13px]">Déjà renouvelé une fois : la loi n’autorise pas de second renouvellement.</p>}
      <Button type="button" variant="subtle" className="text-[#991b1b]" onClick={() => open('end')} aria-expanded={action === 'end'}>Terminer le contrat</Button>

      {action && (
        <form onSubmit={confirm} className="flex flex-col gap-2.5 rounded-xl border border-[#e4e4e7] bg-white p-3.5">
          <AdminField htmlFor={`${p}-d`} label={action === 'renew' ? 'Nouvelle date de fin' : action === 'cdi' ? 'Le CDI commence le' : 'Dernier jour travaillé'}>
            <AdminInput id={`${p}-d`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} max={action === 'renew' ? contract.renew_max ?? undefined : undefined} />
          </AdminField>
          {action === 'renew' && contract.renew_max && <p className="text-[13px] text-[#52525b]">Au plus tard le {longDate(contract.renew_max)} (4 ans de CDD au total).</p>}
          {action === 'cdi' && <p className="text-[13px] text-[#52525b]">Mêmes poste, salaire et commission. Le CDD se termine la veille ; pas d’indemnité de fin de CDD quand un CDI suit (à confirmer).</p>}
          {action === 'end' && (
            <>
              <AdminField htmlFor={`${p}-r`} label="Motif">
                <AdminSelect id={`${p}-r`} value={reason} onChange={(e) => setReason(e.target.value)}>
                  {END_REASONS.filter((r) => fixed || r.value !== 'end_of_term').map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </AdminSelect>
              </AdminField>
              <AdminField htmlFor={`${p}-n`} label="Précision (facultatif)">
                <AdminInput id={`${p}-n`} value={note} maxLength={191} onChange={(e) => setNote(e.target.value)} />
              </AdminField>
              {contract.type === 'cdd' && contract.end_indemnity_estimate !== null && reason === 'end_of_term' && (
                <p className="text-[13px] text-[#52525b]">Indemnité de fin de CDD à prévoir : environ {money(contract.end_indemnity_estimate)} (7 % du brut versé ; à vérifier sur les bulletins).</p>
              )}
              {(reason === 'dismissed' || reason === 'trial') && <p className="text-[13px] font-medium text-[#991b1b]">Un licenciement suit une procédure (préavis, indemnité, lettre). Demandez conseil avant d’agir.</p>}
            </>
          )}
          {error && <Feedback kind="error">{firstError(error)}</Feedback>}
          <div className="flex gap-2">
            <Button type="submit" variant="dark" disabled={busy || !date}>{busy ? 'Enregistrement…' : 'Confirmer'}</Button>
            <Button type="button" variant="subtle" onClick={() => setAction(null)}>Annuler</Button>
          </div>
        </form>
      )}
    </section>
  )
}

const DOC_KIND = { contract: 'Contrat signé', id_card: 'Pièce d’identité', other: 'Autre document' } as const
function Documents({ sheet }: { sheet: HrSheet }) {
  const add = useAddEmployeeDocument(sheet.id)
  const remove = useRemoveEmployeeDocument()
  const [kind, setKind] = useState<keyof typeof DOC_KIND>(sheet.contract?.signed_on ? 'id_card' : 'contract')
  const p = useId()
  return (
    <Card title="Documents">
      {sheet.documents.length === 0 ? <p className="text-sm text-[#52525b]">Aucun document. Ajoutez le contrat signé et la pièce d’identité.</p> : (
        <ul className="flex flex-col gap-2 text-sm">
          {sheet.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-[#e4e4e7] px-3 py-2.5">
              <a href={hrDocumentUrl(d.id)} className="flex min-w-0 items-center gap-2 underline-offset-2 hover:underline"><FileText className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{DOC_KIND[d.kind]} · {d.created_at ? shortDate(d.created_at) : ''}</span></a>
              <button type="button" onClick={() => { if (window.confirm(`Retirer « ${d.name} » du dossier ?`)) remove.mutate(d.id) }} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-[#f4f4f5]" aria-label={`Retirer ${DOC_KIND[d.kind]} (${d.name})`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        <AdminField htmlFor={`${p}-k`} label="Type de document">
          <AdminSelect id={`${p}-k`} value={kind} onChange={(e) => setKind(e.target.value as keyof typeof DOC_KIND)}>
            {Object.entries(DOC_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </AdminSelect>
        </AdminField>
        <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border-2 border-dashed border-[#a1a1aa] px-3 text-sm font-semibold text-[#52525b] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold">
          {add.isPending ? 'Envoi…' : '+ Ajouter un document (PDF, JPG, PNG, 5 Mo)'}
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={add.isPending}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) add.mutate({ file, kind }); e.target.value = '' }} />
        </label>
        {add.isError && <Feedback kind="error">{firstError(add.error)}</Feedback>}
        <p className="text-xs text-[#52525b]">Les fichiers sont gardés hors du site public : seule la propriétaire peut les ouvrir.</p>
      </div>
    </Card>
  )
}

const LEAVE_KIND = { paid: 'Congé payé', maternity: 'Congé de maternité', sick: 'Maladie', other: 'Autre absence' } as const
function Leaves({ sheet, disabled }: { sheet: HrSheet; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState({ kind: 'paid', starts_on: '', ends_on: '', days: '', note: '' })
  const add = useAddLeave(sheet.id)
  const p = useId()
  const b = sheet.leave_balance
  async function submit(e: FormEvent) {
    e.preventDefault()
    await add.mutateAsync({ ...v, days: Number(v.days.replace(',', '.')), note: v.note || null })
    setOpen(false)
    setV({ kind: 'paid', starts_on: '', ends_on: '', days: '', note: '' })
  }
  return (
    <Card title="Congés">
      {b && (
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-[#52525b]">Acquis cette année ({b.per_month} j par mois)</dt><dd className="font-semibold">{b.acquired} jours</dd></div>
          <div className="flex justify-between"><dt className="text-[#52525b]">Pris</dt><dd className="font-semibold">{b.taken.toLocaleString('fr-FR')} jour{b.taken > 1 ? 's' : ''}</dd></div>
        </dl>
      )}
      {sheet.leaves.length > 0 && <ul className="text-sm text-[#52525b]">{sheet.leaves.slice(0, 4).map((l) => <li key={l.id}>{LEAVE_KIND[l.kind]} : {shortDate(l.starts_on)} → {shortDate(l.ends_on)} ({l.days.toLocaleString('fr-FR')} j)</li>)}</ul>}
      {!disabled && !open && <button type="button" onClick={() => setOpen(true)} className="self-start text-sm font-semibold text-gold-text underline">Enregistrer un congé</button>}
      {open && (
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <AdminField htmlFor={`${p}-k`} label="Type">
            <AdminSelect id={`${p}-k`} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
              {Object.entries(LEAVE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </AdminSelect>
          </AdminField>
          <div className="grid grid-cols-2 gap-2.5">
            <AdminField htmlFor={`${p}-s`} label="Du"><AdminInput id={`${p}-s`} type="date" required value={v.starts_on} onChange={(e) => setV({ ...v, starts_on: e.target.value })} /></AdminField>
            <AdminField htmlFor={`${p}-e`} label="Au"><AdminInput id={`${p}-e`} type="date" required value={v.ends_on} onChange={(e) => setV({ ...v, ends_on: e.target.value })} /></AdminField>
          </div>
          <AdminField htmlFor={`${p}-d`} label="Jours ouvrables"><AdminInput id={`${p}-d`} inputMode="decimal" required value={v.days} onChange={(e) => setV({ ...v, days: e.target.value })} /></AdminField>
          {v.kind === 'maternity' && <p className="text-[13px] text-[#52525b]">Nouveau Code du travail : 18 semaines de congé de maternité (à confirmer dans le texte officiel).</p>}
          {add.isError && <Feedback kind="error">{firstError(add.error)}</Feedback>}
          <div className="flex gap-2">
            <Button type="submit" variant="dark" disabled={add.isPending}>Enregistrer</Button>
            <Button type="button" variant="subtle" onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </form>
      )}
    </Card>
  )
}
