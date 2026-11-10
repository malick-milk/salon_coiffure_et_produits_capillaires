/**
 * CONTENU DE LA PAGE D'ACCUEIL — le fichier à modifier pour changer les textes et les images.
 *
 * Vous pouvez changer les textes entre apostrophes ' ' sans toucher au reste du code.
 * Attention : une apostrophe DANS un texte doit être typographique (’) ou le texte doit être
 * entre guillemets doubles "…", sinon le texte s'arrête trop tôt et la page ne s'affiche plus.
 *
 * Images : déposez le fichier dans frontend/public/images/, puis écrivez son chemin ici,
 * en commençant par /images/ (exemple : '/images/hero.webp'). null = emplacement gris provisoire.
 *
 * Ce qui n'est PAS ici : les produits, prix, prestations et horaires viennent de la base de
 * données (ERP ou seeders), voir docs/GUIDE_MODIFIER_LE_SITE.md.
 */
/** Une publicité de l'accueil. Les champs marqués « facultatif » peuvent être supprimés ou mis à null. */
export interface Ad {
  /** false = publicité préparée mais masquée (facultatif, true par défaut) */
  visible?: boolean
  /** Dates d'affichage au format 'AAAA-MM-JJ' (facultatif) : la publicité apparaît et disparaît toute seule */
  startsAt?: string | null
  endsAt?: string | null
  eyebrow: string
  title: string
  text: string
  tags: string[]
  /** Prix affiché tel quel, par exemple '15 000 F CFA'. null = pas de prix affiché */
  price: string | null
  /** Promotion (facultatif) : ancien prix barré, économie, quantité limitée */
  promo?: {
    oldPrice: string
    saving: string
    /** Nombre d'exemplaires en promotion (par exemple 20) */
    limit: number
    /** Exemplaires restants : TOUJOURS le vrai stock, jamais un chiffre inventé. null = compteur masqué. 0 = publicité masquée */
    remaining: number | null
  } | null
  /** Petite phrase sous le prix, sur ordinateur (facultatif) */
  note?: string | null
  primary: { label: string; to: string }
  secondary: { label: string; to: string } | null
  imageWide: string
  imageTall: string
  imageAlt: string
  badge: string | null
}

export const homeContent = {
  /**
   * PUBLICITÉS du haut de l'accueil (carrousel). Une publicité = une image, un message, un prix, un bouton.
   * Pour en ajouter une : copier un bloc { … } et le coller à la suite (3 au maximum : au-delà, presque
   * personne ne voit les suivantes). Avec une seule publicité, les flèches et les points sont masqués.
   * Images : imageWide pour ordinateur (environ 1600 × 1200 px), imageTall pour téléphone (1200 × 1600 px).
   * Les publicités s'affichent dans l'ordre de la liste.
   */
  ads: [
    {
      /** PROMOTION « 20 gammes à 10 000 F » (maquette validée le 10 novembre 2026). Pour l'afficher : visible: true */
      visible: false,
      startsAt: null,
      endsAt: null,
      eyebrow: 'Offre limitée · 20 gammes',
      title: 'Six soins pour des cheveux à l’état pur',
      text: 'La routine complète Dabo Hair à prix réduit, jusqu’à épuisement des 20 gammes en promotion.',
      tags: ['Shampooing', 'Masque', 'Leave In', 'Crème', 'Sérum', 'Spray hydratant'],
      price: '10 000 F CFA',
      promo: { oldPrice: '15 000 F', saving: '−5 000 F', limit: 20, remaining: null },
      note: 'Paiement à la réception · Livraison à Dakar ou retrait gratuit au salon',
      primary: { label: 'Profiter de l’offre', to: '/boutique' },
      secondary: { label: 'Voir les 6 produits', to: '/boutique' },
      imageWide: '/images/publicites/gamme-horizontale.webp',
      imageTall: '/images/publicites/gamme-verticale.webp',
      imageAlt: 'Les six soins Dabo Hair sur une table : Leave In, sérum, masque, crème, spray hydratant et shampooing',
      badge: 'Seulement 20 gammes en promotion',
    },
    {
      eyebrow: 'Nouveau · Gamme complète',
      title: 'Six soins pour des cheveux à l’état pur',
      text: 'Toute la routine Dabo Hair, fabriquée à Dakar : laver, nourrir, hydrater et faire pousser.',
      tags: ['Shampooing', 'Masque', 'Leave In', 'Crème', 'Sérum', 'Spray hydratant'],
      price: '15 000 F CFA',
      primary: { label: 'Commander la gamme', to: '/boutique' },
      secondary: { label: 'Voir les 6 produits', to: '/boutique' },
      imageWide: '/images/publicites/gamme-horizontale.webp',
      imageTall: '/images/publicites/gamme-verticale.webp',
      imageAlt: 'Les six soins Dabo Hair sur une table : Leave In, sérum, masque, crème, spray hydratant et shampooing',
      badge: 'Fabrication maison · Dakar',
    },
  ] satisfies Ad[] as Ad[],
  /** Bandeau des 4 engagements sous les publicités */
  commitments: [
    'Réservation en ligne, sans compte',
    'Retrait gratuit en boutique',
    'Livraison à Dakar et environs',
    'Paiement à la réception',
  ],
  /** Bannière promotionnelle : image large, environ 1280 × 320 px. null = emplacement provisoire */
  promoBanner: {
    image: null as string | null,
    imageAlt: '',
    /** Lien facultatif quand on clique sur la bannière, par exemple '/boutique?category=serums' */
    link: null as string | null,
  },
}
