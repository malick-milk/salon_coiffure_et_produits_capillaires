import { z } from 'zod'
import { normalizePhone, SENEGAL_MOBILE } from '@/features/booking/schema'

export const loginSchema = z.object({
  // E-mail OU téléphone : un compte créé par l'inscription rapide n'a parfois que son numéro
  email: z.string().trim().min(3, 'Saisissez votre e-mail ou votre numéro de téléphone.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
  remember: z.boolean(),
})
export type LoginValues = z.infer<typeof loginSchema>

// Inscription rapide (maquette validée le 18 novembre 2026) : prénom, téléphone, mot de passe.
// Nom et e-mail facultatifs : repris d'une réservation s'ils sont connus, sinon complétés à la 1re commande.
const optional = (v: string | undefined) => (v ?? '').trim() || null
export const registerSchema = z
  .object({
    first_name: z.string().trim().min(2, 'Indiquez votre prénom.').max(100),
    last_name: z.string().optional().transform(optional),
    email: z.string().optional().transform(optional).refine((v) => v === null || z.email().safeParse(v).success, 'Adresse email invalide.'),
    phone: z.string().transform(normalizePhone).refine((v) => SENEGAL_MOBILE.test(v), 'Numéro mobile invalide (exemple : 77 123 45 67).'),
    // Vérification renforcée (18 novembre 2026) : mêmes règles que le serveur (Password::defaults + RegisterRequest)
    password: z
      .string()
      .min(10, '10 caractères minimum.')
      .max(72, '72 caractères maximum.') // 72 = limite de bcrypt
      .regex(/\p{Lu}/u, 'Au moins une majuscule.')
      .regex(/\p{Ll}/u, 'Au moins une minuscule.')
      .regex(/\d/, 'Au moins un chiffre.'),
    password_confirmation: z.string(),
    consent: z.literal(true, { error: 'Votre accord est nécessaire pour créer un compte.' }),
  })
  // Règles qui portent sur PLUSIEURS champs : sur l'objet, en indiquant le champ où afficher l'erreur
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'Les mots de passe ne correspondent pas.' })
  .refine((v) => v.phone.length < 7 || !v.password.replace(/\D/g, '').includes(v.phone.replace(/\D/g, '').slice(-7)), { path: ['password'], message: 'Le mot de passe ne doit pas contenir votre numéro de téléphone.' })
  .refine((v) => v.first_name.length < 3 || !v.password.toLowerCase().includes(v.first_name.toLowerCase()), { path: ['password'], message: 'Le mot de passe ne doit pas contenir votre prénom.' })
export type RegisterInput = z.input<typeof registerSchema>
export type RegisterValues = z.output<typeof registerSchema>
