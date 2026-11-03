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
  hero: {
    eyebrow: 'Salon de coiffure et soins capillaires',
    title: 'L’art du soin capillaire, au salon comme chez vous',
    subtitle: 'Réservez votre prestation en quelques clics et découvrez les soins Dabo Hair, fabriqués par nos soins.',
    primaryButton: 'Réserver une prestation',
    secondaryButton: 'Découvrir la boutique',
    /** Photo verticale, environ 1200 × 1400 px, format .webp ou .jpg, moins de 300 Ko */
    image: null as string | null,
    /** Description de la photo pour les personnes malvoyantes et pour Google (obligatoire si image) */
    imageAlt: 'Coiffure réalisée au salon Dabo Hair',
  },
  /** Bandeau des 4 engagements sous le hero */
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
