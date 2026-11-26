import { describe, expect, it } from 'vitest'
import { fileNameFrom } from './downloadFile'

describe('fileNameFrom', () => {
  it('lit le nom envoyé par le serveur', () => {
    expect(fileNameFrom('attachment; filename=contrat-fatou-ndiaye.pdf', 'x.pdf')).toBe('contrat-fatou-ndiaye.pdf')
    expect(fileNameFrom('attachment; filename="CNI recto.pdf"', 'x.pdf')).toBe('CNI recto.pdf')
    expect(fileNameFrom("attachment; filename=\"contrat.pdf\"; filename*=UTF-8''contrat-a%C3%AFda.pdf", 'x.pdf')).toBe('contrat-aïda.pdf')
  })
  it('garde le nom par défaut sans en-tête', () => {
    expect(fileNameFrom(undefined, 'contrat.pdf')).toBe('contrat.pdf')
  })
})
