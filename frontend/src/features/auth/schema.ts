import { z } from 'zod'
import { normalizePhone, SENEGAL_MOBILE } from '@/features/booking/schema'

export const loginSchema = z.object({
  email: z.email('Adresse email invalide.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
  remember: z.boolean(),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    first_name: z.string().trim().min(2, 'Indiquez votre prénom.').max(100),
    last_name: z.string().trim().min(2, 'Indiquez votre nom.').max(100),
    email: z.email('Adresse email invalide.'),
    phone: z.string().transform(normalizePhone).refine((v) => SENEGAL_MOBILE.test(v), 'Numéro mobile invalide (exemple : 77 123 45 67).'),
    password: z
      .string()
      .min(8, '8 caractères minimum.')
      .max(72, '72 caractères maximum.') // 72 = limite de bcrypt
      .regex(/\p{L}/u, 'Au moins une lettre.')
      .regex(/\d/, 'Au moins un chiffre.'), // mêmes règles que le serveur (Password::defaults)
    password_confirmation: z.string(),
    consent: z.literal(true, { error: 'Votre accord est nécessaire pour créer un compte.' }),
  })
  // Règle qui porte sur DEUX champs : on la place sur l'objet, et on indique quel champ afficher
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'Les mots de passe ne correspondent pas.' })
export type RegisterInput = z.input<typeof registerSchema>
export type RegisterValues = z.output<typeof registerSchema>
