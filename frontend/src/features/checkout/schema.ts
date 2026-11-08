import { z } from 'zod'
import { normalizePhone, SENEGAL_MOBILE } from '@/features/booking/schema'

/**
 * Formulaire de commande. L'adresse n'est obligatoire QUE pour une livraison :
 * cette règle « conditionnelle » s'écrit avec superRefine, qui voit tout l'objet.
 */
export const checkoutSchema = z
  .object({
    fulfillment_method: z.enum(['pickup', 'delivery', 'pickup_point']),
    delivery_zone_id: z.string(),
    pickup_point_id: z.string(),
    first_name: z.string().trim().min(2, 'Indiquez votre prénom.').max(100),
    last_name: z.string().trim().min(2, 'Indiquez votre nom.').max(100),
    phone: z.string().transform(normalizePhone).refine((v) => SENEGAL_MOBILE.test(v), 'Numéro mobile invalide (exemple : 77 123 45 67).'),
    email: z.union([z.literal(''), z.email('Adresse email invalide.')]),
    city: z.string().trim().max(100),
    district: z.string().trim().max(100),
    address_line: z.string().trim().max(255),
    landmark: z.string().trim().max(255),
    notes: z.string().max(500),
    consent: z.literal(true, { error: 'Votre accord est nécessaire pour enregistrer la commande.' }),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment_method === 'pickup_point' && !v.pickup_point_id) {
      ctx.addIssue({ code: 'custom', path: ['pickup_point_id'], message: 'Choisissez le point de retrait de votre région.' })
    }
    if (v.fulfillment_method !== 'delivery') return
    if (!v.delivery_zone_id) ctx.addIssue({ code: 'custom', path: ['delivery_zone_id'], message: 'Choisissez votre zone de livraison.' })
    if (v.city.length < 2) ctx.addIssue({ code: 'custom', path: ['city'], message: 'Indiquez la ville.' })
    if (v.address_line.length < 3) ctx.addIssue({ code: 'custom', path: ['address_line'], message: 'Indiquez l’adresse de livraison.' })
  })

export type CheckoutInput = z.input<typeof checkoutSchema>
export type CheckoutValues = z.output<typeof checkoutSchema>
