/**
 * ERP « Avis clients » (étape 13) : indicateurs de satisfaction, avis à modérer, clientes à rappeler.
 * Règle d'or : on ne refuse un avis que pour un motif objectif (insultes, données personnelles…),
 * jamais parce qu'il est négatif. À un avis négatif honnête, on RÉPOND.
 */
import { Phone } from 'lucide-react'
import { useState } from 'react'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Stars } from '@/features/reviews/components/Stars'
import { formatRating } from '@/features/reviews/format'
import { apiErrorMessage } from '@/lib/http'
import { cn } from '@/lib/utils'
import { type AdminSurvey, REJECT_REASONS, type SurveyFilter, type SurveyStats } from '@/types/admin'
import { useAdminSurveys, useFollowUp, useModerateReview, useSurveyStats } from '../api'
import { AdminInput, AdminSelect, Card, Feedback, Kpi, PageHeader, Table, dateTime } from '../components/ui'
import { firstError } from './OrdersPages'

const TABS: { id: SurveyFilter; label: string }[] = [
  { id: 'to_moderate', label: 'À modérer' },
  { id: 'follow_up', label: 'À rappeler' },
  { id: 'published', label: 'Publiés' },
  { id: 'answered', label: 'Toutes les réponses' },
]

const STATUS_LABELS: Record<AdminSurvey['review_status'], string> = { none: 'Privé', pending: 'À modérer', approved: 'Publié', rejected: 'Refusé' }

export function ReviewsAdminPage() {
  const [tab, setTab] = useState<SurveyFilter>('to_moderate')
  const [page, setPage] = useState(1)
  const stats = useSurveyStats()
  const surveys = useAdminSurveys(tab, page)

  return (
    <>
      <Seo title="ERP — Avis clients" />
      <PageHeader title="Avis clients" subtitle="Enquête envoyée par SMS le lendemain de chaque prestation et de chaque livraison" />
      {stats.isError ? <QueryError message={apiErrorMessage(stats.error)} onRetry={() => stats.refetch()} />
        : stats.isPending ? <Skeleton className="h-28 bg-[#e4e4e7]" />
        : <StatsBlock stats={stats.data} />}

      <div role="tablist" aria-label="Filtrer les avis" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = t.id === 'to_moderate' ? surveys.data?.counts.to_moderate : t.id === 'follow_up' ? surveys.data?.counts.follow_up : undefined
          return (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setPage(1) }}
              className={cn('min-h-11 rounded-full border px-4 text-sm font-semibold', tab === t.id ? 'border-ink bg-ink text-ivory' : 'border-[#d4d4d8] bg-white text-ink')}>
              {t.label}{count ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      {surveys.isError ? <QueryError message={apiErrorMessage(surveys.error)} onRetry={() => surveys.refetch()} />
        : surveys.isPending ? <Skeleton className="h-64 bg-[#e4e4e7]" />
        : surveys.data.data.length === 0 ? <Card><p className="text-sm text-[#52525b]">Rien à traiter ici pour le moment.</p></Card>
        : (
          <div className="flex flex-col gap-3">
            {surveys.data.data.map((s) => <SurveyCard key={s.id} survey={s} />)}
            {surveys.data.meta.last_page > 1 && (
              <div className="flex items-center gap-3">
                <Button variant="subtle" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <span className="text-sm text-[#52525b]">Page {page} / {surveys.data.meta.last_page}</span>
                <Button variant="subtle" size="sm" disabled={page >= surveys.data.meta.last_page} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            )}
          </div>
        )}
    </>
  )
}

function StatsBlock({ stats: s }: { stats: SurveyStats }) {
  const npsTone = s.nps === null ? 'neutral' : s.nps >= 30 ? 'good' : s.nps < 0 ? 'warn' : 'neutral'
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Note moyenne" value={`${formatRating(s.average_rating)} / 5`} hint={`${s.answered} réponse${s.answered > 1 ? 's' : ''} sur 90 jours`} />
        <Kpi label="Recommandation (NPS)" value={s.nps === null ? '–' : `${s.nps > 0 ? '+' : ''}${s.nps}`} tone={npsTone}
          hint="% qui recommandent − % qui critiquent (de −100 à +100)" />
        <Kpi label="Taux de réponse" value={s.response_rate === null ? '–' : `${s.response_rate.toLocaleString('fr-FR')} %`} hint={`${s.sent} enquête${s.sent > 1 ? 's' : ''} envoyée${s.sent > 1 ? 's' : ''}`} />
        <Kpi label="Clientes à rappeler" value={s.counts.follow_up} tone={s.counts.follow_up ? 'warn' : 'good'} hint="Note de 3 étoiles ou moins" />
      </div>
      {(s.by_service.length > 0 || s.by_stylist.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Par prestation">
            <Table head={['Prestation', 'Réponses', 'Note', 'NPS']} minWidth={360}>
              {s.by_service.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.answered}</td><td>{formatRating(r.average)}</td><td>{r.nps ?? '–'}</td></tr>)}
              {s.orders && Number(s.orders.answered) > 0 && <tr><td>Commandes en ligne</td><td>{s.orders.answered}</td><td>{formatRating(s.orders.average === null ? null : Number(s.orders.average))}</td><td>–</td></tr>}
            </Table>
          </Card>
          <Card title="Par coiffeuse">
            <Table head={['Coiffeuse', 'Réponses', 'Note', 'NPS']} minWidth={360}>
              {s.by_stylist.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.answered}</td><td>{formatRating(r.average)}</td><td>{r.nps ?? '–'}</td></tr>)}
            </Table>
          </Card>
        </div>
      )}
    </>
  )
}

function SurveyCard({ survey: s }: { survey: AdminSurvey }) {
  const moderate = useModerateReview()
  const followUp = useFollowUp()
  const [reply, setReply] = useState(s.reply ?? '')
  const [rejectReason, setRejectReason] = useState('')
  const [note, setNote] = useState('')
  const error = moderate.error ?? followUp.error

  return (
    <Card>
      <div className="flex flex-col gap-3 text-ink">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <strong>{s.customer_name ?? 'Cliente'} <span className="font-normal text-[#52525b]">· publié sous « {s.public_author} »</span></strong>
            <span className="text-[13px] text-[#52525b]">{s.subject_label}{s.stylist_name ? ` · ${s.stylist_name}` : ''} · répondu le {dateTime(s.answered_at)}</span>
          </div>
          <div className="flex items-center gap-3">
            {s.rating !== null && <Stars rating={s.rating} className="text-gold-text" />}
            {s.nps !== null && <span className="text-[13px] text-[#52525b]">Recommandation : {s.nps}/10</span>}
            <span className="rounded-full bg-[#f4f4f5] px-2.5 py-1 text-xs font-semibold">{STATUS_LABELS[s.review_status]}</span>
          </div>
        </div>
        {s.comment ? <p className="leading-relaxed">« {s.comment} »</p> : <p className="text-sm text-[#71717a]">Sans commentaire.</p>}
        {s.reject_reason && <p className="text-sm text-[#7f1d1d]">Refusé : {s.reject_reason}</p>}
        {error && <Feedback kind="error">{firstError(error)}</Feedback>}

        {s.publish_consent && s.review_status !== 'rejected' && (
          <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); moderate.mutate({ id: s.id, decision: s.review_status === 'approved' ? 'reply' : 'approve', reply }) }}>
            <label className="text-sm font-semibold" htmlFor={`reply-${s.id}`}>Réponse publique du salon (facultative)</label>
            <AdminInput id={`reply-${s.id}`} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} placeholder="Merci pour votre avis…" />
            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit" size="sm" disabled={moderate.isPending}>{s.review_status === 'approved' ? 'Enregistrer la réponse' : 'Publier'}</Button>
              {s.review_status === 'pending' && (
                <>
                  <label className="sr-only" htmlFor={`reject-${s.id}`}>Motif du refus</label>
                  <AdminSelect id={`reject-${s.id}`} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-auto">
                    <option value="">Motif du refus…</option>
                    {REJECT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </AdminSelect>
                  <Button type="button" size="sm" variant="subtle" disabled={!rejectReason || moderate.isPending}
                    onClick={() => moderate.mutate({ id: s.id, decision: 'reject', reject_reason: rejectReason })}>Refuser</Button>
                </>
              )}
            </div>
          </form>
        )}

        {s.needs_follow_up && (
          <form className="flex flex-col gap-2 rounded-xl bg-[#fff7e6] p-3" onSubmit={(e) => { e.preventDefault(); followUp.mutate({ id: s.id, note }) }}>
            <p className="flex items-center gap-2 text-sm font-semibold text-gold-text">
              <Phone className="size-4" aria-hidden="true" /> À rappeler : {s.customer_phone ? <a href={`tel:${s.customer_phone}`} className="underline">{s.customer_phone}</a> : 'pas de numéro'}
            </p>
            <label className="text-sm font-semibold" htmlFor={`note-${s.id}`}>Ce qui a été fait</label>
            <div className="flex flex-wrap gap-2">
              <AdminInput id={`note-${s.id}`} value={note} onChange={(e) => setNote(e.target.value)} required minLength={5} maxLength={500} className="flex-1" placeholder="Ex. : rappelée, geste offert sur le prochain soin" />
              <Button type="submit" size="sm" disabled={followUp.isPending}>Marquer comme rappelée</Button>
            </div>
          </form>
        )}
        {s.follow_up_done_at && <p className="text-sm text-[#14532d]">Rappelée le {dateTime(s.follow_up_done_at)} : {s.follow_up_note}</p>}
      </div>
    </Card>
  )
}
