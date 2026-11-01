/**
 * TUNNEL DE RÉSERVATION (sans compte, EF-PUB-08).
 * L'état du tunnel est géré par un « reducer » : une fonction qui reçoit l'état actuel et une
 * action, et renvoie le nouvel état. Toutes les transitions sont au même endroit, donc faciles
 * à lire et à tester.
 */
import { CalendarCheck, Check } from 'lucide-react'
import { useReducer, useState } from 'react'
import { Link } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLongDate, formatPrice } from '@/lib/format'
import { apiErrorMessage, apiErrorStatus, type ValidationErrorBody } from '@/lib/http'
import type { BookingConfirmation } from '@/types/api'
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
  const services = useServices()
  const stylists = useStylists(state.serviceId)
  const hours = useBusinessHours()
  const createBooking = useCreateBooking()

  const service = services.data?.find((s) => s.id === state.serviceId) ?? null
  const stylistId = typeof state.stylist === 'number' ? state.stylist : null
  const stylistName = state.stylist === 'any' ? 'Peu importe' : stylists.data?.find((s) => s.id === state.stylist)?.display_name ?? null

  const submit = (values: ContactValues, setError: ContactSetError) => {
    if (!state.serviceId || !state.date || !state.time) return
    setConflictMessage(null)
    createBooking.mutate(
      {
        service_id: state.serviceId,
        stylist_id: stylistId,
        date: state.date,
        time: state.time,
        customer: { first_name: values.first_name, last_name: values.last_name, phone: values.phone, email: values.email || null },
        notes: values.notes || null,
        consent: values.consent,
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
          }
        },
      },
    )
  }

  if (state.step === 5 && state.confirmation) {
    return <Confirmation confirmation={state.confirmation} onRestart={() => dispatch({ type: 'reset' })} />
  }

  const loading = services.isPending || hours.isPending
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
              {state.step}. {['Choisissez votre prestation', 'Avec qui ?', 'Date et heure', 'Vos coordonnées'][state.step - 1]}
            </h2>

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
                {state.step === 4 && <ContactStep formId={CONTACT_FORM_ID} onSubmit={submit} />}
              </>
            )}

            {createBooking.isError && ![409, 422].includes(apiErrorStatus(createBooking.error) ?? 0) && (
              <p role="alert" className="text-[15px] text-[#f87171]">{apiErrorMessage(createBooking.error)}</p>
            )}

            <div className="flex justify-between gap-3 border-t border-ink-line pt-6">
              <Button variant="outline" disabled={state.step === 1} onClick={() => dispatch({ type: 'back' })}>Retour</Button>
              {state.step < 4 ? (
                <Button disabled={!canContinue(state)} onClick={() => dispatch({ type: 'next' })}>Continuer</Button>
              ) : (
                <Button type="submit" form={CONTACT_FORM_ID} disabled={createBooking.isPending}>
                  {createBooking.isPending ? 'Envoi…' : 'Envoyer la demande'}
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

function Confirmation({ confirmation, onRestart }: { confirmation: BookingConfirmation; onRestart: () => void }) {
  const [date, time] = confirmation.starts_at.split('T') as [string, string]
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
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline"><Link to="/">Retour à l'accueil</Link></Button>
          <Button onClick={onRestart}><CalendarCheck aria-hidden="true" />Nouvelle réservation</Button>
        </div>
      </div>
    </div>
  )
}
