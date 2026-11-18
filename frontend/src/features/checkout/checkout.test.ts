import { safeRedirect } from '@/features/auth/components/RequireAuth'
import { registerSchema } from '@/features/auth/schema'
import { checkoutSchema } from './schema'

const base = {
  fulfillment_method: 'pickup' as const, delivery_zone_id: '', pickup_point_id: '', first_name: 'Awa', last_name: 'Ndiaye', phone: '77 123 45 67', email: '',
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

describe('inscription rapide (prénom, téléphone, mot de passe)', () => {
  const ok = { first_name: 'Awa', phone: '77 123 45 67', password: 'secret-123', consent: true as const }
  it('accepte les 3 champs seuls : nom et e-mail vides deviennent null', () => {
    const r = registerSchema.safeParse({ ...ok, last_name: '', email: '  ' })
    expect(r.success && [r.data.last_name, r.data.email, r.data.phone]).toEqual([null, null, '771234567'])
  })
  it('garde le nom et l’e-mail repris d’une réservation', () => {
    const r = registerSchema.safeParse({ ...ok, last_name: 'Ndiaye', email: 'awa@exemple.sn' })
    expect(r.success && [r.data.last_name, r.data.email]).toEqual(['Ndiaye', 'awa@exemple.sn'])
  })
  it('refuse un e-mail mal écrit, un mot de passe trop court ou sans chiffre', () => {
    expect(registerSchema.safeParse({ ...ok, email: 'awa@' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...ok, password: 'court' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...ok, password: 'sanschiffre' }).success).toBe(false)
  })
})

describe('redirection après connexion (anti « open redirect »)', () => {
  it('accepte un chemin interne', () => expect(safeRedirect('/compte/commandes')).toBe('/compte/commandes'))
  it('refuse une URL externe ou un chemin « //site.com »', () => {
    expect(safeRedirect('https://site-pirate.com')).toBe('/compte')
    expect(safeRedirect('//site-pirate.com')).toBe('/compte')
    expect(safeRedirect(null)).toBe('/compte')
  })
  it('refuse les contournements connus (barre oblique inverse, tabulation, retour à la ligne)', () => {
    for (const trick of ['/\\site-pirate.com', '/\t/site-pirate.com', '/\n/site-pirate.com', '/\\/site-pirate.com', 'javascript:alert(1)', '/%5C%5Csite-pirate.com']) {
      const result = safeRedirect(trick)
      expect(new URL(result, window.location.origin).origin, trick).toBe(window.location.origin)
    }
    expect(safeRedirect('/compte/commandes?page=2#haut')).toBe('/compte/commandes?page=2#haut') // l'usage normal est préservé
  })
  it('point de retrait (étape 14) : le point est obligatoire, l’adresse ne l’est pas', () => {
    const r = checkoutSchema.safeParse({ ...base, fulfillment_method: 'pickup_point' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toEqual(['pickup_point_id'])
    expect(checkoutSchema.safeParse({ ...base, fulfillment_method: 'pickup_point', pickup_point_id: '2' }).success).toBe(true)
  })
})
