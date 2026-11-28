/**
 * TUNNEL DE RÉSERVATION (sans compte, EF-PUB-08).
 * L'état du tunnel est géré par un « reducer » : une fonction qui reçoit l'état actuel et une
 * action, et renvoie le nouvel état. Toutes les transitions sont au même endroit, donc faciles
 * à lire et à tester.
 */
import { Bell, CalendarCheck, CalendarClock, Check } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration, formatLongDate, formatPrice } from '@/lib/format'
import { addDaysIso, downloadIcs, resserrageIcs } from '@/lib/resserrage'
import { MissingFieldsSummary } from '@/components/common/MissingFields'
import { focusFirstInvalid } from '@/lib/focusFirstInvalid'
import type { MissingItem } from '@/lib/missingFields'
import { apiErrorMessage, apiErrorStatus, type ValidationErrorBody } from '@/lib/http'
import { useMe } from '@/features/auth/hooks'
import type { BookingConfirmation, Service } from '@/types/api'
import { BookingSummary, DateTimeStep, ServiceStep, Stepper, StylistStep } from '../components/BookingSteps'
import { ContactStep, type ContactSetError } from '../components/ContactStep'
import { useBusinessHours, useCreateBooking, useServices, useStylists } from '../hooks'
import type { ContactValues } from '../schema'
import axios from 'axios'

interface State {
  step: 1 | 2 | 3 | 4 | 5
  serviceId: number | null
  stylist: number | 'any' | null
  date: string | null
  time: string | null
  confirmation: BookingConfirmation | null
}

type Action =
  | { type: 'service'; id: number }
  /** Réservation express depuis l'accueil (24 novembre 2026) : prestation, coiffeuse « peu importe » et créneau déjà choisis */
  | { type: 'express'; serviceId: number; date: string; time: string }
  | { type: 'stylist'; value: number | 'any' }
  | { type: 'date'; date: string }
  | { type: 'time'; time: string }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'slotTaken' }
  | { type: 'confirmed'; confirmation: BookingConfirmation }
  | { type: 'reset' }

const initialState: State = { step: 1, serviceId: null, stylist: null, date: null, time: null, confirmation: null }

export function bookingReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'express': // un créneau touché sur l'accueil : directement la dernière étape (coordonnées)
      return { ...state, step: 4, serviceId: action.serviceId, stylist: 'any', date: action.date, time: action.time }
    case 'service': // changer de prestation invalide le coiffeur et l'heure choisis
      return { ...state, serviceId: action.id, stylist: null, time: null }
    case 'stylist':
      return { ...state, stylist: action.value, time: null }
    case 'date':
      return { ...state, date: action.date, time: null }
    case 'time':
      return { ...state, time: action.time }
    case 'next':
      return canContinue(state) ? { ...state, step: (state.step + 1) as State['step'] } : state
    case 'back':
      return { ...state, step: Math.max(1, state.step - 1) as State['step'] }
    case 'slotTaken': // conflit 409 : retour au choix de l'heure
      return { ...state, step: 3, time: null }
    case 'confirmed':
      return { ...state, step: 5, confirmation: action.confirmation }
    case 'reset':
      return initialState
  }
}

export function canContinue(s: State): boolean {
  if (s.step === 1) return s.serviceId !== null
  if (s.step === 2) return s.stylist !== null
  if (s.step === 3) return s.date !== null && s.time !== null
  return false // l'étape 4 avance par l'envoi du formulaire
}

const CONTACT_FORM_ID = 'booking-contact-form'

export function BookingPage() {
  const [state, dispatch] = useReducer(bookingReducer, initialState)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const [contact, setContact] = useState<ContactValues | null>(null)
  const services = useServices()

  // ?prestation=resserrage-micro-twist : lien d'un rappel de resserrage (ou de la bannière Twists), la prestation est déjà choisie.
  // ?prestation=twist-simple&date=2026-11-25&heure=09:00 : créneau touché sur l'accueil, directement la dernière étape.
  const [params] = useSearchParams()
  const wanted = params.get('prestation')
  const wantedDate = params.get('date')
  const wantedTime = params.get('heure')
  const express = Boolean(wanted && wantedDate && wantedTime && /^\d{4}-\d{2}-\d{2}$/.test(wantedDate) && /^\d{2}:\d{2}$/.test(wantedTime))
  useEffect(() => {
    const match = wanted && services.data?.find((s) => s.slug === wanted)
    if (!match || state.serviceId !== null) return
    if (express) dispatch({ type: 'express', serviceId: match.id, date: wantedDate!, time: wantedTime! })
    else dispatch({ type: 'service', id: match.id })
  }, [wanted, services.data]) // eslint-disable-line react-hooks/exhaustive-deps
  const stylists = useStylists(state.serviceId)
  const hours = useBusinessHours()
  const createBooking = useCreateBooking()

  const service = services.data?.find((s) => s.id === state.serviceId) ?? null
  const stylistId = typeof state.stylist === 'number' ? state.stylist : null
  const stylistName = state.stylist === 'any' ? 'Peu importe' : stylists.data?.find((s) => s.id === state.stylist)?.display_name ?? null

  const [missing, setMissing] = useState<MissingItem[]>([])
  const submit = (values: ContactValues, setError: ContactSetError) => {
    if (!state.serviceId || !state.date || !state.time) return
    setConflictMessage(null)
    setContact(values)
    createBooking.mutate(
      {
        service_id: state.serviceId,
        stylist_id: stylistId,
        date: state.date,
        time: state.time,
        customer: { first_name: values.first_name, last_name: values.last_name, phone: values.phone, email: values.email || null },
        notes: values.notes || null,
        consent: values.consent,
        marketing_consent: Boolean(values.marketing_consent),
      },
      {
        onSuccess: (confirmation) => dispatch({ type: 'confirmed', confirmation }),
        onError: (error) => {
          const status = apiErrorStatus(error)
          if (status === 409) {
            setConflictMessage(apiErrorMessage(error))
            dispatch({ type: 'slotTaken' })
          } else if (status === 422 && axios.isAxiosError<ValidationErrorBody>(error)) {
            // Erreurs de validation du serveur : affichées sous le bon champ
            for (const [key, messages] of Object.entries(error.response?.data.errors ?? {})) {
              const field = key.replace('customer.', '') as Parameters<ContactSetError>[0]
              setError(field, { message: messages[0] })
            }
            focusFirstInvalid()
          }
        },
      },
    )
  }

  if (state.step === 5 && state.confirmation) {
    return <Confirmation confirmation={state.confirmation} service={service} contact={contact} onRestart={() => dispatch({ type: 'reset' })} />
  }

  const loading = services.isPending || hours.isPending
  // Arrivée par un créneau de l'accueil, toujours à la dernière étape
  const expressStep = express && state.step === 4
  const loadError = services.error ?? hours.error

  return (
    <div className="px-4 pt-10 pb-24 sm:px-6">
      <Seo title="Réserver une prestation" description="Réservez votre rendez-vous au salon en ligne, sans créer de compte." />
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Réserver une prestation</h1>
          <p className="text-muted">Sans création de compte. Confirmation par le salon sous 2 h ouvrées.</p>
        </div>

        <Stepper current={state.step} />

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <section aria-labelledby="step-title" className="flex min-w-0 flex-1 flex-col gap-7 rounded-[20px] border border-ink-line bg-ink-soft p-5 sm:p-8">
            <h2 id="step-title" className="font-display text-[28px] font-semibold">
              {expressStep ? 'Confirmer votre rendez-vous' : `${state.step}. ${['Choisissez votre prestation', 'Avec qui ?', 'Date et heure', 'Vos coordonnées'][state.step - 1]}`}
            </h2>

            {/* Réservation express : le créneau choisi sur l'accueil, en tête (sur téléphone, le récapitulatif est tout en bas) */}
            {expressStep && service && state.date && state.time && (
              <div className="flex flex-col gap-1.5 rounded-2xl border-2 border-gold bg-ink p-4">
                <strong className="text-base">{service.name} · {formatPrice(service.price)}</strong>
                <span className="text-[15px] text-[#e6e1d6]">{formatLongDate(state.date)}, {state.time} – {addMinutes(state.time, service.duration_minutes)}</span>
                <span className="text-sm text-[#c9c4b8]">Avec la première coiffeuse libre</span>
                <button type="button" onClick={() => dispatch({ type: 'back' })} className="self-start py-1.5 text-sm font-semibold text-gold underline underline-offset-4">Changer de créneau</button>
              </div>
            )}

            {conflictMessage && state.step === 3 && (
              <p role="alert" className="rounded-xl border border-[#b45309] bg-[#2a1a05] p-4 text-[15px]">{conflictMessage}</p>
            )}

            {loadError ? (
              <QueryError message={apiErrorMessage(loadError)} onRetry={() => { services.refetch(); hours.refetch() }} />
            ) : loading ? (
              <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div>
            ) : (
              <>
                {state.step === 1 && <ServiceStep services={services.data!} selectedId={state.serviceId} onSelect={(id) => dispatch({ type: 'service', id })} />}
                {state.step === 2 &&
                  (stylists.isPending ? <Skeleton className="h-32" /> : <StylistStep stylists={stylists.data ?? []} selected={state.stylist} onSelect={(value) => dispatch({ type: 'stylist', value })} />)}
                {state.step === 3 && state.serviceId !== null && (
                  <DateTimeStep
                    serviceId={state.serviceId}
                    stylistId={stylistId}
                    hours={hours.data!}
                    date={state.date}
                    time={state.time}
                    onDate={(date) => dispatch({ type: 'date', date })}
                    onTime={(time) => dispatch({ type: 'time', time })}
                  />
                )}
                {state.step === 4 && <ContactStep formId={CONTACT_FORM_ID} onSubmit={submit} onMissingChange={setMissing} />}
              </>
            )}

            {createBooking.isError && ![409, 422].includes(apiErrorStatus(createBooking.error) ?? 0) && (
              <p role="alert" className="text-[15px] text-[#f87171]">{apiErrorMessage(createBooking.error)}</p>
            )}

            {state.step === 4 && <MissingFieldsSummary items={missing} />}

            <div className="flex justify-between gap-3 border-t border-ink-line pt-6">
              <Button variant="outline" disabled={state.step === 1} onClick={() => dispatch({ type: 'back' })}>Retour</Button>
              {state.step < 4 ? (
                <Button disabled={!canContinue(state)} onClick={() => dispatch({ type: 'next' })}>Continuer</Button>
              ) : (
                <Button type="submit" form={CONTACT_FORM_ID} disabled={createBooking.isPending}>
                  {createBooking.isPending ? 'Envoi…' : expressStep ? 'Réserver ce créneau' : 'Envoyer la demande'}
                </Button>
              )}
            </div>
          </section>

          <BookingSummary service={service} stylistName={stylistName} date={state.date} time={state.time} />
        </div>
      </div>
    </div>
  )
}

function Confirmation({ confirmation, service, contact, onRestart }: { confirmation: BookingConfirmation; service: Service | null; contact: ContactValues | null; onRestart: () => void }) {
  const [date, time] = confirmation.starts_at.split('T') as [string, string]
  const { data: user } = useMe()
  // Invitation à créer un compte : seulement pour une cliente sans compte, et une prestation qui a un rappel
  return (
    <div className="px-4 py-16 sm:px-6">
      <Seo title="Demande de rendez-vous envoyée" />
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center motion-safe:animate-fade-up">
        <span className="flex size-[72px] items-center justify-center rounded-full bg-gold text-ink"><Check className="size-9" aria-hidden="true" /></span>
        <h1 className="font-display text-4xl font-semibold">Demande de rendez-vous envoyée</h1>
        <p className="leading-relaxed text-muted">
          {confirmation.service_name} avec {confirmation.stylist_name}, le <span className="text-ivory">{formatLongDate(date)} à {time.slice(0, 5)}</span> ({formatPrice(confirmation.price)}).
          Le salon vous confirme le rendez-vous par SMS.
        </p>
        <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-gold px-7 py-4">
          <span className="text-[13px] text-muted">Code de réservation, à conserver</span>
          <strong className="text-2xl tracking-[0.08em] text-gold">{confirmation.reference}</strong>
        </div>
        <p className="text-sm text-muted">Annulation possible jusqu'à 24 h avant le rendez-vous avec ce code.</p>
        {service?.resserrage && <ResserrageDate date={addDaysIso(date, service.resserrage.after_days)} resserrage={service.resserrage} reference={confirmation.reference} />}
        {!user && service?.resserrage_reminder && (
          <section aria-labelledby="invitation-compte" className="flex w-full flex-col gap-3 rounded-[18px] border-2 border-gold bg-[#1d1810] p-5 text-left">
            <h2 id="invitation-compte" className="flex items-center gap-2.5 text-lg font-semibold"><Bell className="size-5 text-gold" aria-hidden="true" />Ne ratez pas votre resserrage</h2>
            <p className="text-[15px] leading-relaxed text-[#c9c4b8]">Créez votre compte en 30 secondes : nous vous rappellerons le bon moment pour le resserrage, dans votre espace client et par e-mail.</p>
            <Button asChild><Link to="/inscription" state={{ prefill: contact && { first_name: contact.first_name, last_name: contact.last_name, phone: contact.phone, email: contact.email } }}>Créer mon compte</Link></Button>
            <p className="text-center text-xs text-muted">Vos informations de réservation sont déjà remplies.</p>
          </section>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline"><Link to="/">Retour à l'accueil</Link></Button>
          <Button onClick={onRestart}><CalendarCheck aria-hidden="true" />Nouvelle réservation</Button>
        </div>
      </div>
    </div>
  )
}

/** Date conseillée du resserrage, dès la réservation (maquette validée le 27 novembre 2026) */
function ResserrageDate({ date, resserrage: r, reference }: { date: string; resserrage: NonNullable<Service['resserrage']>; reference: string }) {
  const label = formatLongDate(date)
  const addToCalendar = () => downloadIcs(
    resserrageIcs(date, `${r.name}, Dabo Hair`, `Resserrage conseillé ${r.delay_label} après votre twist. Réservez sur dabohair.com/reserver?prestation=${r.slug} ou au 77 602 62 00.`, `${reference}-resserrage`),
    `resserrage-${date}.ics`,
  )
  return (
    <section aria-labelledby="resserrage-date" className="flex w-full gap-3 rounded-2xl border border-gold bg-[#1d1810] p-4 text-left">
      <CalendarClock className="mt-0.5 size-6 shrink-0 text-gold" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h2 id="resserrage-date" className="text-base font-semibold">Resserrage conseillé vers le {label}</h2>
        <p className="text-sm leading-relaxed text-[#c9c4b8]">{r.delay_label.charAt(0).toUpperCase() + r.delay_label.slice(1)} après votre twist, pour garder des racines nettes. {r.name} : {formatDuration(r.duration_minutes)} · {formatPrice(r.price)}.</p>
        <button type="button" onClick={addToCalendar} className="mt-1 self-start text-sm font-semibold text-gold underline underline-offset-2">Ajouter à mon agenda</button>
      </div>
    </section>
  )
}

/** « 09:00 » + 120 min → « 11:00 » */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number) as [number, number]
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
