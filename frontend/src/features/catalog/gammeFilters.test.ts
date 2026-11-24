/** Menu « Gammes » : un filtre n'apparaît que si au moins une gamme lui correspond */
import { describe, expect, it } from 'vitest'
import type { ProductSummary } from '@/types/api'
import { gammeFilters } from './gammeFilters'

const g = (name: string, price: number, short_description: string | null = null) => ({ name, price, short_description }) as ProductSummary

describe('gammeFilters', () => {
  it('les 8 gammes du lancement : avocat, coco, palme, enfants, locs, petits prix', () => {
    const list = [
      g('Gamme à l’avocat', 10000, 'Pour les débutants'), g('Gamme à l’avocat', 15000, 'Longueur, volume, réparatrice'),
      g('Gamme au coco', 15000), g('Gamme à la palme', 15000), g('Gamme Salma Hair', 8000, 'Pour les enfants'),
      g('Gamme Locs', 13000), g('Crème, huile, shampoing', 5000), g('Crème, spray, shampoing', 5000),
    ]
    expect(gammeFilters(list).map((f) => f.label)).toEqual(['Avocat', 'Coco', 'Palme', 'Enfants', 'Locs', 'Petits prix (5 000 F)'])
  })
  it('seulement la gamme complète actuelle : aucun filtre inutile', () => {
    expect(gammeFilters([g('Gamme complète Dabo Hair', 15000, 'Les six soins Dabo Hair')])).toEqual([])
  })
})
