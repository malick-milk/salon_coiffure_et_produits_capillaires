/**
 * Étape « Coordonnées » : formulaire géré par React Hook Form et validé par Zod.
 * React Hook Form évite de re-rendre toute la page à chaque lettre tapée (formulaires rapides).
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type UseFormSetError } from 'react-hook-form'
import { Field } from '@/components/common/FormField'
import { Input, Textarea } from '@/components/ui/input'
import { contactSchema, type ContactInput, type ContactValues } from '../schema'

export type ContactSetError = UseFormSetError<ContactInput>

export function ContactStep({ formId, onSubmit }: { formId: string; onSubmit: (values: ContactValues, setError: ContactSetError) => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ContactInput, unknown, ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { first_name: '', last_name: '', phone: '', email: '', notes: '', consent: false as unknown as true },
    mode: 'onTouched', // erreur affichée en quittant le champ, pas pendant la saisie
  })

  return (
    <form id={formId} noValidate onSubmit={handleSubmit((values) => onSubmit(values, setError))} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prénom *" error={errors.first_name?.message}>
          {(id, describedBy) => <Input id={id} autoComplete="given-name" aria-invalid={!!errors.first_name} aria-describedby={describedBy} {...register('first_name')} />}
        </Field>
        <Field label="Nom *" error={errors.last_name?.message}>
          {(id, describedBy) => <Input id={id} autoComplete="family-name" aria-invalid={!!errors.last_name} aria-describedby={describedBy} {...register('last_name')} />}
        </Field>
        <Field label="Téléphone mobile *" hint="Pour confirmer et vous rappeler la veille." error={errors.phone?.message}>
          {(id, describedBy) => <Input id={id} type="tel" inputMode="tel" autoComplete="tel" placeholder="77 123 45 67" aria-invalid={!!errors.phone} aria-describedby={describedBy} {...register('phone')} />}
        </Field>
        <Field label="Email (facultatif)" hint="Pour recevoir la confirmation par email." error={errors.email?.message}>
          {(id, describedBy) => <Input id={id} type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={describedBy} {...register('email')} />}
        </Field>
      </div>
      <Field label="Précisions pour le coiffeur (facultatif)" error={errors.notes?.message}>
        {(id, describedBy) => <Textarea id={id} rows={3} maxLength={500} aria-describedby={describedBy} {...register('notes')} />}
      </Field>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-3 text-sm leading-relaxed text-[#d9d9d9]">
          <input type="checkbox" className="mt-0.5 size-[18px] accent-gold" aria-invalid={!!errors.consent} {...register('consent')} />
          J'accepte que mes données soient utilisées pour gérer ce rendez-vous (politique de confidentialité).
        </label>
        {errors.consent && <p role="alert" className="text-sm font-medium text-[#f87171]">{errors.consent.message}</p>}
      </div>
    </form>
  )
}
