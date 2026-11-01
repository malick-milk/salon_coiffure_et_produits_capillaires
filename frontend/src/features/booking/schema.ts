/**
 * Validation du formulaire de coordonnées avec Zod.
 * Rappel : cette validation sert le CONFORT de l'utilisateur (erreur immédiate).
 * La SÉCURITÉ, elle, vient de la validation côté serveur, qui refait tous les contrôles.
 */
import { z } from 'zod'

/** Mobile sénégalais : 77, 78, 76, 75 ou 70 + 7 chiffres, avec ou sans +221 et espaces */
export const SENEGAL_MOBILE = /^(\+221)?7[05678]\d{7}$/
export const normalizePhone = (v: string) => v.replace(/[\s.-]/g, '')

export const contactSchema = z.object({
  first_name: z.string().trim().min(2, 'Indiquez votre prénom.').max(100),
  last_name: z.string().trim().min(2, 'Indiquez votre nom.').max(100),
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((v) => SENEGAL_MOBILE.test(v), 'Numéro mobile invalide (exemple : 77 123 45 67).'),
  email: z.union([z.literal(''), z.email('Adresse email invalide.')]),
  notes: z.string().max(500, '500 caractères maximum.'),
  consent: z.literal(true, { error: 'Votre accord est nécessaire pour enregistrer le rendez-vous.' }),
})

export type ContactInput = z.input<typeof contactSchema>
export type ContactValues = z.output<typeof contactSchema>
