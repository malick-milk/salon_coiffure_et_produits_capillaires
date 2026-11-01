import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { applyServerErrors, Field } from '@/components/common/FormField'
import { Seo } from '@/components/common/Seo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiErrorMessage, apiErrorStatus, type ValidationErrorBody } from '@/lib/http'
import { PasswordInput } from '../components/PasswordInput'
import { safeRedirect } from '../components/RequireAuth'
import { useLogin, useMe } from '../hooks'
import { isStaff } from '../permissions'
import { loginSchema, type LoginValues } from '../schema'

export function LoginPage() {
  const [params] = useSearchParams()
  // Sans redirection demandée, le personnel arrive sur l'ERP et le client sur son espace
  const target = (user: Parameters<typeof isStaff>[0]) => safeRedirect(params.get('redirect'), isStaff(user) ? '/admin' : '/compte')
  const navigate = useNavigate()
  const me = useMe()
  const login = useLogin()
  const { register, handleSubmit, setError, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  })

  if (me.data) return <Navigate to={target(me.data)} replace />

  const onSubmit = (values: LoginValues) =>
    login.mutate(values, {
      onSuccess: (user) => navigate(target(user), { replace: true }),
      onError: (error) => {
        if (apiErrorStatus(error) === 422 && axios.isAxiosError<ValidationErrorBody>(error)) applyServerErrors(error.response?.data.errors, setError)
      },
    })

  const status = apiErrorStatus(login.error)
  return (
    <AuthShell title="Connexion" subtitle="Suivez vos commandes et vos rendez-vous.">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Field label="Email" error={errors.email?.message}>
          {(id, d) => <Input id={id} type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={d} {...register('email')} />}
        </Field>
        <Field label="Mot de passe" error={errors.password?.message}>
          {(id, d) => <PasswordInput id={id} autoComplete="current-password" aria-invalid={!!errors.password} aria-describedby={d} {...register('password')} />}
        </Field>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="size-[18px] accent-gold" {...register('remember')} />
          Rester connecté sur cet appareil
        </label>
        {login.isError && status !== 422 && <p role="alert" className="text-sm font-medium text-[#f87171]">{apiErrorMessage(login.error)}</p>}
        <Button type="submit" disabled={login.isPending}>{login.isPending ? 'Connexion…' : 'Se connecter'}</Button>
      </form>
      <p className="text-center text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link to={`/inscription?redirect=${encodeURIComponent(safeRedirect(params.get('redirect')))}`} className="font-semibold text-gold underline underline-offset-4">Créer un compte</Link>
      </p>
    </AuthShell>
  )
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-14 sm:px-6">
      <Seo title={title} />
      <div className="mx-auto flex max-w-md flex-col gap-7 rounded-[20px] border border-ink-line bg-ink-soft p-6 sm:p-9">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-4xl font-semibold">{title}</h1>
          <p className="text-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
