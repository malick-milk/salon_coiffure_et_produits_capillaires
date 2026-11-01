import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { applyServerErrors, Field } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiErrorMessage, apiErrorStatus, type ValidationErrorBody } from '@/lib/http'
import { PasswordInput } from '../components/PasswordInput'
import { safeRedirect } from '../components/RequireAuth'
import { useMe, useRegister } from '../hooks'
import { registerSchema, type RegisterInput, type RegisterValues } from '../schema'
import { AuthShell } from './LoginPage'

export function RegisterPage() {
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const navigate = useNavigate()
  const me = useMe()
  const registerUser = useRegister()
  const { register, handleSubmit, setError, formState: { errors } } = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { first_name: '', last_name: '', email: '', phone: '', password: '', password_confirmation: '', consent: false as unknown as true },
    mode: 'onTouched',
  })

  if (me.data) return <Navigate to={redirect} replace />

  const onSubmit = (values: RegisterValues) =>
    registerUser.mutate(values, {
      onSuccess: () => navigate(redirect, { replace: true }),
      onError: (error) => {
        if (apiErrorStatus(error) === 422 && axios.isAxiosError<ValidationErrorBody>(error)) applyServerErrors(error.response?.data.errors, setError)
      },
    })

  return (
    <AuthShell title="Créer un compte" subtitle="Commandez plus vite et retrouvez tout votre historique.">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Prénom" error={errors.first_name?.message}>
            {(id, d) => <Input id={id} autoComplete="given-name" aria-invalid={!!errors.first_name} aria-describedby={d} {...register('first_name')} />}
          </Field>
          <Field label="Nom" error={errors.last_name?.message}>
            {(id, d) => <Input id={id} autoComplete="family-name" aria-invalid={!!errors.last_name} aria-describedby={d} {...register('last_name')} />}
          </Field>
        </div>
        <Field label="Email" error={errors.email?.message}>
          {(id, d) => <Input id={id} type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={d} {...register('email')} />}
        </Field>
        <Field label="Téléphone mobile" error={errors.phone?.message}>
          {(id, d) => <Input id={id} type="tel" inputMode="tel" autoComplete="tel" placeholder="77 123 45 67" aria-invalid={!!errors.phone} aria-describedby={d} {...register('phone')} />}
        </Field>
        <Field label="Mot de passe" hint="8 caractères minimum." error={errors.password?.message}>
          {(id, d) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby={d} {...register('password')} />}
        </Field>
        <Field label="Confirmer le mot de passe" error={errors.password_confirmation?.message}>
          {(id, d) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={!!errors.password_confirmation} aria-describedby={d} {...register('password_confirmation')} />}
        </Field>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-3 text-sm leading-relaxed text-[#d9d9d9]">
            <input type="checkbox" className="mt-0.5 size-[18px] accent-gold" aria-invalid={!!errors.consent} {...register('consent')} />
            J'accepte la politique de confidentialité (gestion de mon compte, de mes commandes et rendez-vous).
          </label>
          {errors.consent && <p role="alert" className="text-sm font-medium text-[#f87171]">{errors.consent.message}</p>}
        </div>
        {registerUser.isError && apiErrorStatus(registerUser.error) !== 422 && <p role="alert" className="text-sm text-[#f87171]">{apiErrorMessage(registerUser.error)}</p>}
        <Button type="submit" disabled={registerUser.isPending}>{registerUser.isPending ? 'Création…' : 'Créer mon compte'}</Button>
      </form>
      <p className="text-center text-sm text-muted">
        Déjà inscrit ? <Link to={`/connexion?redirect=${encodeURIComponent(redirect)}`} className="font-semibold text-gold underline underline-offset-4">Se connecter</Link>
      </p>
    </AuthShell>
  )
}
