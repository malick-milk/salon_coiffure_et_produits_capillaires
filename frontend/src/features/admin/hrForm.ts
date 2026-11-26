/**
 * Contrats et RH : libellés et passage formulaire ⇄ API (logique pure, testée dans hrForm.test.ts).
 * Les règles légales sont vérifiées par le SERVEUR (App\Services\Hr\ContractRules) ; ici, seulement le confort.
 */
import type { ContractType, HrEndReason, HrInput, HrSheet, HrState, PayMethod } from '@/types/admin'

export const CONTRACT_TYPES: { value: ContractType; label: string; hint: string }[] = [
  { value: 'cdi', label: 'CDI', hint: 'Sans date de fin' },
  { value: 'cdd', label: 'CDD', hint: '2 ans au plus, 1 renouvellement' },
  { value: 'apprentissage', label: 'Apprentissage', hint: 'Avec date de fin' },
  { value: 'stage', label: 'Stage', hint: 'Avec date de fin' },
  { value: 'prestataire', label: 'Prestataire', hint: 'Indépendant (livreur…)' },
]
export const TYPE_LABEL: Record<ContractType, string> = { cdi: 'CDI', cdd: 'CDD', apprentissage: 'Apprentissage', stage: 'Stage', prestataire: 'Prestataire' }
export const PAY_LABEL: Record<PayMethod, string> = { cash: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', free_money: 'Free Money', bank: 'Virement bancaire' }
export const END_REASONS: { value: Exclude<HrEndReason, 'converted'>; label: string }[] = [
  { value: 'end_of_term', label: 'Fin prévue du contrat' },
  { value: 'resigned', label: 'Démission' },
  { value: 'dismissed', label: 'Licenciement' },
  { value: 'trial', label: 'Fin de la période d’essai' },
  { value: 'other', label: 'Autre motif' },
]
export const END_LABEL: Record<HrEndReason, string> = { converted: 'Passée en CDI', ...Object.fromEntries(END_REASONS.map((r) => [r.value, r.label])) } as Record<HrEndReason, string>
export const STATE: Record<HrState, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  active: { label: 'En cours', tone: 'success' },
  trial: { label: 'Période d’essai', tone: 'warning' },
  ending: { label: 'Fin proche', tone: 'warning' },
  unsigned: { label: 'À signer', tone: 'danger' },
  overdue: { label: 'Fin dépassée', tone: 'danger' },
  ended: { label: 'Terminé', tone: 'neutral' },
}

export const isFixedTerm = (t: ContractType) => t === 'cdd' || t === 'apprentissage' || t === 'stage'

/** Champs du formulaire : tout en texte (ce que l'utilisatrice tape), converti à l'envoi */
export type HrFormValues = Record<keyof HrInput, string>

export const EMPTY_FORM: HrFormValues = {
  first_name: '', last_name: '', phone: '', birth_date: '', address: '', id_number: '', ipres_number: '', css_number: '', user_id: '', stylist_id: '',
  type: 'cdi', position: '', starts_on: '', ends_on: '', trial_ends_on: '', weekly_hours: '40', work_days: 'Lundi au samedi',
  base_salary: '', commission_rate: '0', pay_method: 'wave', signed_on: '',
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

export function formFromSheet(sheet: HrSheet): HrFormValues {
  const e = sheet.employee
  const c = sheet.contract
  return {
    ...EMPTY_FORM,
    ...Object.fromEntries((['first_name', 'last_name', 'phone', 'birth_date', 'address', 'id_number', 'ipres_number', 'css_number', 'user_id', 'stylist_id'] as const).map((k) => [k, str(e[k])])),
    ...(c ? Object.fromEntries((['type', 'position', 'starts_on', 'ends_on', 'trial_ends_on', 'weekly_hours', 'work_days', 'base_salary', 'commission_rate', 'pay_method', 'signed_on'] as const).map((k) => [k, str(c[k])])) : {}),
  } as HrFormValues
}

const orNull = (v: string) => (v.trim() === '' ? null : v.trim())
const intOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[\s\u202f\u00a0]/g, '')))

/** Le formulaire en données pour l'API ; la date de fin est vidée pour un CDI ou un prestataire */
export function toPayload(f: HrFormValues): HrInput {
  const type = f.type as ContractType
  return {
    first_name: f.first_name.trim(), last_name: f.last_name.trim(), phone: orNull(f.phone), birth_date: orNull(f.birth_date), address: orNull(f.address),
    id_number: orNull(f.id_number), ipres_number: orNull(f.ipres_number), css_number: orNull(f.css_number),
    user_id: intOrNull(f.user_id), stylist_id: intOrNull(f.stylist_id),
    type, position: f.position.trim(), starts_on: f.starts_on, ends_on: isFixedTerm(type) ? orNull(f.ends_on) : null, trial_ends_on: orNull(f.trial_ends_on),
    weekly_hours: intOrNull(f.weekly_hours), work_days: orNull(f.work_days), base_salary: intOrNull(f.base_salary),
    commission_rate: Number((f.commission_rate || '0').replace(',', '.')), pay_method: (orNull(f.pay_method) as PayMethod | null), signed_on: orNull(f.signed_on),
  }
}

/** Ce qui manque avant l'envoi (le serveur vérifie aussi, et applique les règles du Code du travail) */
export function missingFields(f: HrFormValues): Partial<Record<keyof HrFormValues, string>> {
  const errors: Partial<Record<keyof HrFormValues, string>> = {}
  if (f.first_name.trim().length < 2) errors.first_name = 'Indiquez le prénom.'
  if (f.last_name.trim().length < 2) errors.last_name = 'Indiquez le nom.'
  if (f.position.trim().length < 2) errors.position = 'Indiquez le poste.'
  if (!f.starts_on) errors.starts_on = 'Indiquez la date de début.'
  if (isFixedTerm(f.type as ContractType) && !f.ends_on) errors.ends_on = 'Indiquez la date de fin.'
  return errors
}

const ymd = (iso: string): [number, number, number] => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number)
  return [y, m, d]
}

/** Jours restants avant une date (négatif = dépassée) */
export function daysUntil(iso: string, today = new Date()): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const [y, m, d] = ymd(iso)
  return Math.round((Date.UTC(y, m - 1, d) - t) / 86_400_000)
}

export const longDate = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')
export const shortDate = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

/** Lendemain d'une date ISO (début du CDI qui suit un CDD) */
export function nextDay(iso: string): string {
  const [y, m, d] = ymd(iso)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** Une ligne d'historique lisible, depuis le journal d'audit */
const FIELD_LABEL: Record<string, string> = {
  type: 'contrat', position: 'poste', starts_on: 'début', ends_on: 'fin prévue', trial_ends_on: 'fin d’essai', base_salary: 'salaire fixe', commission_rate: 'commission',
  renewal_count: 'renouvellements', signed_on: 'signature', ended_on: 'fin', end_reason: 'motif de fin', first_name: 'prénom', last_name: 'nom', phone: 'téléphone', user_id: 'compte ERP', stylist_id: 'fiche planning',
}
export function historyLine(h: HrSheet['history'][number]): string {
  const event = ({ created: h.subject === 'contract' ? 'Contrat créé' : 'Fiche créée', document_added: 'Document ajouté', document_removed: 'Document retiré', leave_added: 'Congé enregistré' } as Record<string, string>)[h.event]
  if (event) return event
  const attrs = (h.changes?.attributes ?? {}) as Record<string, unknown>
  const old = (h.changes?.old ?? {}) as Record<string, unknown>
  const parts = Object.keys(attrs).filter((k) => FIELD_LABEL[k]).map((k) => (k in old ? `${FIELD_LABEL[k]} ${fmt(k, old[k])} → ${fmt(k, attrs[k])}` : `${FIELD_LABEL[k]} ${fmt(k, attrs[k])}`))
  return parts.length ? parts.join(', ') : 'Modification'
}
function fmt(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (key === 'commission_rate') return `${Number(v).toLocaleString('fr-FR')} %`
  if (key === 'type') return TYPE_LABEL[v as ContractType] ?? String(v)
  if (key === 'end_reason') return END_LABEL[v as HrEndReason] ?? String(v)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return shortDate(v.slice(0, 10))
  return String(v)
}
