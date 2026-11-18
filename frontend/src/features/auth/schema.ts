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
    password: z
      .string()
      .min(8, '8 caractères minimum.')
      .max(72, '72 caractères maximum.') // 72 = limite de bcrypt
      .regex(/\p{L}/u, 'Au moins une lettre.')
      .regex(/\d/, 'Au moins un chiffre.'), // mêmes règles que le serveur (Password::defaults)
    consent: z.literal(true, { error: 'Votre accord est nécessaire pour créer un compte.' }),
  })
export type RegisterInput = z.input<typeof registerSchema>
export type RegisterValues = z.output<typeof registerSchema>
