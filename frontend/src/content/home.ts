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
export const homeContent = {
  /**
   * PUBLICITÉS du haut de l'accueil (carrousel). Une publicité = une image, un message, un prix, un bouton.
   * Pour en ajouter une : copier un bloc { … } et le coller à la suite (3 au maximum : au-delà, presque
   * personne ne voit les suivantes). Avec une seule publicité, les flèches et les points sont masqués.
   * Images : imageWide pour ordinateur (environ 1600 × 1200 px), imageTall pour téléphone (1200 × 1600 px).
   */
  ads: [
    {
      eyebrow: 'Nouveau · Gamme complète',
      title: 'Six soins pour des cheveux à l’état pur',
      text: 'Toute la routine Dabo Hair, fabriquée à Dakar : laver, nourrir, hydrater et faire pousser.',
      tags: ['Shampooing', 'Masque', 'Leave In', 'Crème', 'Sérum', 'Spray hydratant'],
      /** Prix affiché tel quel, par exemple '15 000 F CFA'. null = pas de prix affiché (en attente du prix de la gamme) */
      price: '15 000 F CFA' as string | null,
      primary: { label: 'Commander la gamme', to: '/boutique' },
      secondary: { label: 'Voir les 6 produits', to: '/boutique' } as { label: string; to: string } | null,
      imageWide: '/images/publicites/gamme-horizontale.webp',
      imageTall: '/images/publicites/gamme-verticale.webp',
      imageAlt: 'Les six soins Dabo Hair sur une table : Leave In, sérum, masque, crème, spray hydratant et shampooing',
      badge: 'Fabrication maison · Dakar',
    },
  ],
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
