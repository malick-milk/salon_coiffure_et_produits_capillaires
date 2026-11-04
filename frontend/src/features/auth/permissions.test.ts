import { describe, expect, it } from 'vitest'
import type { User } from '@/types/api'
import { can, isStaff, ROLE_LABELS } from './permissions'

const user = (roles: string[], permissions: string[]): User => ({ id: 1, first_name: 'A', last_name: 'B', email: 'a@b.sn', phone: null, roles, permissions })

describe('permissions de l’interface (confort ; le serveur reste juge)', () => {
  it('on vérifie une PERMISSION, jamais un nom de rôle', () => {
    const cashier = user(['cashier'], ['orders.view', 'orders.manage'])
    expect(can(cashier, 'orders.manage')).toBe(true)
    expect(can(cashier, 'analytics.view')).toBe(false)
    // un rôle renommé ou un nouveau rôle ne change rien au code : seules les permissions comptent
    expect(can(user(['caissiere_principale'], ['analytics.view']), 'analytics.view')).toBe(true)
  })

  it('personnel = au moins une permission ; un client ou un visiteur n’en a aucune', () => {
    expect(isStaff(user(['stylist'], ['bookings.view']))).toBe(true)
    expect(isStaff(user(['customer'], []))).toBe(false)
    expect(isStaff(null)).toBe(false)
    expect(can(undefined, 'orders.view')).toBe(false)
  })

  it('chaque rôle du serveur a un libellé français', () => {
    for (const role of ['super_admin', 'manager', 'cashier', 'stylist', 'stock_keeper', 'customer']) expect(ROLE_LABELS[role]).toBeTruthy()
  })
})
