import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { applyServerErrors, Field } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiErrorMessage, apiErrorStatus, type ValidationErrorBody } from '@/lib/http'
import { useCart } from '@/features/cart/store'
import { formatPrice } from '@/lib/format'
import { PasswordInput } from '../components/PasswordInput'
import { customerRedirect } from '../components/RequireAuth'
import { useMe, useRegister } from '../hooks'
import { registerSchema, type RegisterInput, type RegisterValues } from '../schema'
import { AuthShell } from './LoginPage'

export function RegisterPage() {
  const [params] = useSearchParams()
  const redirect = customerRedirect(params.get('redirect')) // un compte créé ici est un compte CLIENT : jamais l'ERP
  const navigate = useNavigate()
  const me = useMe()
  const [submitted, setSubmitted] = useState(false)
  // Venue du panier avec un article à prix membre : on le rappelle en haut du formulaire
  const memberItem = useCart((st) => st.items.find((i) => i.memberPrice != null))
  const registerUser = useRegister()
  // Venue de la confirmation d'une réservation : les coordonnées déjà saisies sont reprises
  const prefill = (useLocation().state as { prefill?: Partial<Record<'first_name' | 'last_name' | 'phone' | 'email', string>> } | null)?.prefill
  const { register, handleSubmit, setError, formState: { errors } } = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: prefill?.first_name ?? '', last_name: prefill?.last_name ?? '', email: prefill?.email ?? '', phone: prefill?.phone ?? '',
      password: '', consent: false as unknown as true,
    },
    mode: 'onTouched',
  })

  // Dès que la cliente est connectée, ce <Navigate> redirige… AVANT le onSuccess plus bas.
  // submitted dit qu'elle vient de s'inscrire : le panier affiche alors « Bienvenue … »
  if (me.data) return <Navigate to={redirect} replace state={submitted ? { welcome: true } : undefined} />

  const onSubmit = (values: RegisterValues) => {
    setSubmitted(true)
    registerUser.mutate(values, {
      // « welcome » : le panier affiche « Bienvenue … : votre prix membre est appliqué »
      onSuccess: () => navigate(redirect, { replace: true, state: { welcome: true } }),
      onError: (error) => {
        setSubmitted(false)
        if (apiErrorStatus(error) === 422 && axios.isAxiosError<ValidationErrorBody>(error)) applyServerErrors(error.response?.data.errors, setError)
      },
    })
  }

  return (
    <AuthShell title="Créer mon compte" subtitle="Gratuit, en quelques secondes. Commandez plus vite et retrouvez tout votre historique.">
      {memberItem && (
        <p className="rounded-xl border border-[#4a3f1c] bg-gold-soft px-3.5 py-2.5 text-sm text-[#e6e1d6]">
          Votre {memberItem.name.toLowerCase().startsWith('gamme') ? 'gamme' : 'article'} à <strong className="text-gold">{formatPrice(memberItem.memberPrice ?? 0)}</strong> vous attend dans le panier.
        </p>
      )}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Field label="Prénom" error={errors.first_name?.message}>
          {(id, d) => <Input id={id} autoComplete="given-name" aria-invalid={!!errors.first_name} aria-describedby={d} {...register('first_name')} />}
        </Field>
        <Field label="Téléphone mobile" hint="Pour vous prévenir quand la commande est prête. Il sert aussi à vous connecter." error={errors.phone?.message}>
          {(id, d) => <Input id={id} type="tel" inputMode="tel" autoComplete="tel" placeholder="77 123 45 67" aria-invalid={!!errors.phone} aria-describedby={d} {...register('phone')} />}
        </Field>
        <Field label="Mot de passe" hint="8 caractères minimum, avec au moins une lettre et un chiffre." error={errors.password?.message}>
          {(id, d) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby={d} {...register('password')} />}
        </Field>
        {(errors.last_name || errors.email) && <p role="alert" className="text-sm text-[#f87171]">{errors.last_name?.message ?? errors.email?.message}</p>}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-3 text-sm leading-relaxed text-[#d9d9d9]">
            <input type="checkbox" className="mt-0.5 size-[18px] accent-gold" aria-invalid={!!errors.consent} {...register('consent')} />
            J'accepte la politique de confidentialité (gestion de mon compte, de mes commandes et rendez-vous).
          </label>
          {errors.consent && <p role="alert" className="text-sm font-medium text-[#f87171]">{errors.consent.message}</p>}
        </div>
        {registerUser.isError && apiErrorStatus(registerUser.error) !== 422 && <p role="alert" className="text-sm text-[#f87171]">{apiErrorMessage(registerUser.error)}</p>}
        <Button type="submit" disabled={registerUser.isPending}>{registerUser.isPending ? 'Création…' : 'Créer mon compte'}</Button>
        <p className="text-center text-xs text-muted">Nom et e-mail : à compléter plus tard, à votre première commande (facultatifs).</p>
      </form>
      <p className="text-center text-sm text-muted">
        Déjà inscrit ? <Link to={`/connexion?redirect=${encodeURIComponent(redirect)}`} className="font-semibold text-gold underline underline-offset-4">Se connecter</Link>
      </p>
    </AuthShell>
  )
}
