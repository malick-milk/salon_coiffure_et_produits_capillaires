import { safeRedirect } from '@/features/auth/components/RequireAuth'
import { registerSchema } from '@/features/auth/schema'
import { checkoutSchema } from './schema'

const base = {
  fulfillment_method: 'pickup' as const, delivery_zone_id: '', first_name: 'Awa', last_name: 'Ndiaye', phone: '77 123 45 67', email: '',
  city: 'Dakar', district: '', address_line: '', landmark: '', notes: '', consent: true as const,
}

describe('formulaire de commande', () => {
  it('retrait en boutique : l’adresse n’est pas demandée', () => {
    expect(checkoutSchema.safeParse(base).success).toBe(true)
  })

  it('livraison : zone et adresse deviennent obligatoires (validation conditionnelle)', () => {
    const r = checkoutSchema.safeParse({ ...base, fulfillment_method: 'delivery' })
    expect(r.success).toBe(false)
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['delivery_zone_id', 'address_line']))
    expect(checkoutSchema.safeParse({ ...base, fulfillment_method: 'delivery', delivery_zone_id: '1', address_line: 'Rue 10' }).success).toBe(true)
  })
})

describe('inscription', () => {
  const ok = { first_name: 'Awa', last_name: 'Ndiaye', email: 'awa@exemple.sn', phone: '771234567', password: 'secret-123', password_confirmation: 'secret-123', consent: true as const }
  it('accepte un formulaire valide', () => expect(registerSchema.safeParse(ok).success).toBe(true))
  it('refuse des mots de passe différents, en signalant le champ de confirmation', () => {
    const r = registerSchema.safeParse({ ...ok, password_confirmation: 'autre-chose' })
    expect(r.success).toBe(false)
    expect(r.success ? [] : r.error.issues[0]!.path).toEqual(['password_confirmation'])
  })
  it('refuse un mot de passe trop court', () => expect(registerSchema.safeParse({ ...ok, password: 'court', password_confirmation: 'court' }).success).toBe(false))
})

describe('redirection après connexion (anti « open redirect »)', () => {
  it('accepte un chemin interne', () => expect(safeRedirect('/compte/commandes')).toBe('/compte/commandes'))
  it('refuse une URL externe ou un chemin « //site.com »', () => {
    expect(safeRedirect('https://site-pirate.com')).toBe('/compte')
    expect(safeRedirect('//site-pirate.com')).toBe('/compte')
    expect(safeRedirect(null)).toBe('/compte')
  })
})
