/**
 * « QUELLE GAMME POUR MOI ? » (maquette validée le 25 novembre 2026) : 2 questions, UNE gamme proposée.
 *
 * À AJUSTER quand Awa aura créé les gammes dans l'ERP : à chaque réponse correspond l'ADRESSE de la gamme
 * (la fin de son lien sur le site, par exemple /produits/gamme-au-coco → 'gamme-au-coco').
 * Une réponse dont la gamme n'existe pas (ou n'est plus en vente) est masquée toute seule ;
 * si aucune ne correspond, le bloc entier reste caché : on ne propose jamais une gamme absente.
 */
export interface QuizChoice { label: string; gamme: string }

export const quiz = {
  title: 'Quelle gamme pour moi ?',
  subtitle: '2 questions, une seule réponse.',
  /** 1re question : pour qui. « Pour moi » ouvre la 2e question ; les autres mènent directement à une gamme */
  who: [
    { label: 'Pour moi', gamme: '' },
    { label: 'Mon enfant', gamme: 'gamme-salma-hair' },
    { label: 'Mes locs', gamme: 'gamme-locs' },
  ] as QuizChoice[],
  /** 2e question (pour moi) : l'objectif */
  goal: [
    { label: 'Débuter', gamme: 'gamme-a-l-avocat-debutants' },
    { label: 'Longueur et volume', gamme: 'gamme-au-coco' },
    { label: 'Réparer', gamme: 'gamme-a-l-avocat' },
    { label: 'Faire pousser', gamme: 'gamme-a-la-palme' },
  ] as QuizChoice[],
}
