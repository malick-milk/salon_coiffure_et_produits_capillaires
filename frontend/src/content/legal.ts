/**
 * PAGES LÉGALES — mentions légales, conditions de vente, confidentialité (rédigées le 25 novembre 2026).
 *
 * À COMPLÉTER PAR AWA : chaque « [À COMPLÉTER : …] » est une information que seule l'entreprise connaît
 * (NINEA, RCCM, adresse exacte…). Sur le site, ces cases s'affichent surlignées en jaune tant qu'elles
 * ne sont pas remplies : impossible de les oublier. Remplacez tout le crochet par la vraie valeur.
 *
 * Ces textes suivent le droit sénégalais (loi n° 2008-08 sur les transactions électroniques, loi
 * n° 2008-12 sur la protection des données personnelles). Ils ne remplacent pas l'avis d'un juriste :
 * faites-les relire avant le lancement si possible.
 *
 * Une section = un titre et des paragraphes. Un paragraphe qui commence par « • » s'affiche comme une puce.
 */
export interface LegalSection { title: string; paragraphs: string[] }
export interface LegalPage { slug: string; title: string; updated: string; intro: string; sections: LegalSection[] }

const COMPANY = 'Dabo Hair'
const ADDRESS = 'Cité Almadies 2, ZAC Mbao (Extension Jaxaay), Dakar, Sénégal'
const PHONE = '77 602 62 00'
const EMAIL = 'contact@dabohair.com'

export const legalPages: LegalPage[] = [
  {
    slug: 'mentions-legales',
    title: 'Mentions légales',
    updated: '25 novembre 2026',
    intro: `Le site dabohair.com est édité par ${COMPANY}. Voici qui nous sommes et comment nous joindre.`,
    sections: [
      {
        title: 'L’entreprise',
        paragraphs: [
          `• Nom commercial : ${COMPANY}`,
          '• Forme juridique : [À COMPLÉTER : entreprise individuelle, SARL, SUARL…]',
          '• Nom de la responsable : [À COMPLÉTER : prénom et nom d’Awa, gérante]',
          `• Adresse : ${ADDRESS}`,
          `• Téléphone : ${PHONE}`,
          `• E-mail : ${EMAIL}`,
          '• NINEA : [À COMPLÉTER : numéro NINEA]',
          '• Registre du commerce (RCCM) : [À COMPLÉTER : numéro RCCM, ex. SN-DKR-2026-A-…]',
        ],
      },
      {
        title: 'Directrice de la publication',
        paragraphs: ['[À COMPLÉTER : prénom et nom de la personne responsable du contenu du site]'],
      },
      {
        title: 'Hébergement',
        paragraphs: [
          'Le site est hébergé par OVHcloud (OVH SAS), 2 rue Kellermann, 59100 Roubaix, France — www.ovhcloud.com.',
        ],
      },
      {
        title: 'Propriété des contenus',
        paragraphs: [
          `Les textes, photos, logos et la devise « Vos cheveux à l’état pur » appartiennent à ${COMPANY}. Toute reproduction sans accord écrit est interdite.`,
          'Les avis publiés sont ceux de nos clientes, avec leur accord, sous leur prénom et l’initiale de leur nom.',
        ],
      },
      {
        title: 'Nous contacter',
        paragraphs: [`Pour toute question : ${PHONE} (appel ou WhatsApp) ou ${EMAIL}. Nous répondons du lundi au samedi, aux horaires du salon.`],
      },
    ],
  },
  {
    slug: 'conditions-de-vente',
    title: 'Conditions de vente',
    updated: '25 novembre 2026',
    intro: 'Ce qui s’applique quand vous commandez nos soins ou réservez une prestation au salon. Nous avons voulu les écrire simplement.',
    sections: [
      {
        title: '1. Les prix',
        paragraphs: [
          'Les prix sont affichés en francs CFA, toutes taxes comprises. Le prix appliqué est celui affiché au moment où vous validez la commande.',
          'Les frais de livraison dépendent de votre zone et sont affichés avant la confirmation. Le retrait au salon est gratuit.',
          'Prix membre : réservé aux clientes qui ont un compte, dans la limite des quantités annoncées et d’une gamme par compte. Promotions : valables aux dates indiquées.',
        ],
      },
      {
        title: '2. La commande',
        paragraphs: [
          'Votre commande est enregistrée quand vous cliquez sur « Confirmer la commande ». Vous recevez sa référence à l’écran, et par SMS ou e-mail.',
          'Nous pouvons refuser ou annuler une commande si un produit n’est plus disponible ou si les coordonnées sont incomplètes : nous vous prévenons alors sans frais.',
        ],
      },
      {
        title: '3. Le paiement',
        paragraphs: [
          'Vous payez à la réception de votre commande, ou au salon pour une prestation : espèces, Wave, Orange Money ou Free Money. Rien n’est payé en ligne.',
          'Une facture vous est remise après le paiement.',
        ],
      },
      {
        title: '4. Livraison et retrait',
        paragraphs: [
          '• Retrait au salon : gratuit, commande prête sous 24 h (jours d’ouverture). Nous vous prévenons par SMS.',
          '• Livraison à Dakar et environs : frais et délai selon la zone, affichés à la commande.',
          '• Point de retrait partenaire : gratuit, avec un code de retrait envoyé par SMS quand la commande est prête.',
          'Une commande non retirée sous [À COMPLÉTER : nombre de jours, ex. 7] jours peut être annulée.',
        ],
      },
      {
        title: '5. Retours et échanges',
        paragraphs: [
          'Pour des raisons d’hygiène, un soin ouvert ne peut être ni repris ni échangé.',
          'Un produit non ouvert peut être échangé sous [À COMPLÉTER : nombre de jours, ex. 7] jours après la réception, sur présentation de la facture.',
          'Un produit abîmé ou non conforme à la livraison : signalez-le-nous sous 48 h (photo par WhatsApp au ' + PHONE + ') ; nous le remplaçons sans frais.',
        ],
      },
      {
        title: '6. Rendez-vous au salon',
        paragraphs: [
          'Votre demande de rendez-vous est confirmée par le salon. Vous pouvez l’annuler gratuitement en ligne jusqu’à 24 h avant ; au-delà, appelez le salon.',
          'En cas de retard de plus de [À COMPLÉTER : minutes, ex. 20] minutes, le rendez-vous peut être déplacé.',
          'Les twists sont réalisés sur vos propres cheveux, sans mèches.',
        ],
      },
      {
        title: '7. Bon usage des soins',
        paragraphs: ['Nos soins sont fabriqués par nos soins à Dakar. Suivez les conseils d’utilisation de chaque fiche. En cas de réaction (rougeur, démangeaison), arrêtez l’utilisation et contactez-nous.'],
      },
      {
        title: '8. Une question, un désaccord',
        paragraphs: [
          `Contactez-nous d’abord : ${PHONE} ou ${EMAIL}. Nous cherchons toujours une solution amiable.`,
          'À défaut, le droit sénégalais s’applique et les tribunaux de Dakar sont compétents.',
        ],
      },
    ],
  },
  {
    slug: 'confidentialite',
    title: 'Politique de confidentialité',
    updated: '25 novembre 2026',
    intro: 'Nous ne demandons que ce qui sert à traiter vos commandes et vos rendez-vous. Nous ne vendons jamais vos données.',
    sections: [
      {
        title: 'Responsable',
        paragraphs: [`${COMPANY}, ${ADDRESS}. Contact : ${EMAIL} ou ${PHONE}.`],
      },
      {
        title: 'Ce que nous recevons, et pourquoi',
        paragraphs: [
          '• Prénom, nom, téléphone, e-mail : pour confirmer vos commandes et rendez-vous et vous prévenir (SMS, e-mail).',
          '• Adresse de livraison : uniquement pour vous livrer.',
          '• Historique de commandes et de rendez-vous : pour votre espace client, vos factures et les rappels de resserrage.',
          '• Votre avis : publié seulement si vous avez coché la case, sous votre prénom et l’initiale de votre nom.',
          '• Mot de passe : enregistré chiffré ; personne au salon ne peut le lire.',
        ],
      },
      {
        title: 'Qui y a accès',
        paragraphs: [
          'Seule l’équipe Dabo Hair, selon son rôle (la caisse ne voit pas ce que voit la gérante). Nos prestataires techniques n’y accèdent que pour faire fonctionner le service :',
          '• hébergement du site : OVHcloud (France) ;',
          '• envoi des e-mails : Brevo (France) ;',
          '• envoi des SMS : [À COMPLÉTER : nom du fournisseur SMS une fois choisi].',
        ],
      },
      {
        title: 'Combien de temps',
        paragraphs: [
          '• Compte client : tant qu’il est utilisé ; sur simple demande, nous le supprimons.',
          '• Commandes et factures : [À COMPLÉTER : durée légale de conservation des pièces comptables, ex. 10 ans].',
          '• Rapports d’erreurs techniques : 90 jours, sans données personnelles (e-mails et téléphones masqués).',
        ],
      },
      {
        title: 'Vos droits',
        paragraphs: [
          'Vous pouvez consulter, corriger ou faire supprimer vos données, et vous opposer aux rappels : écrivez à ' + EMAIL + ' ou appelez le ' + PHONE + '. Nous répondons sous 30 jours.',
          'Chaque e-mail de rappel contient un lien pour ne plus en recevoir.',
          'Vous pouvez aussi saisir la Commission de protection des données personnelles (CDP), www.cdp.sn.',
        ],
      },
      {
        title: 'Cookies',
        paragraphs: [
          'Le site n’utilise que les cookies indispensables : rester connectée et protéger les formulaires. Aucun cookie publicitaire, aucun pistage.',
        ],
      },
      {
        title: 'Déclaration',
        paragraphs: ['Traitement déclaré à la CDP sous le numéro [À COMPLÉTER : numéro de récépissé de la CDP].'],
      },
    ],
  },
]

/** Les cases à remplir, pour la liste de contrôle avant le lancement */
export function legalPlaceholders(pages: LegalPage[] = legalPages): string[] {
  return pages.flatMap((p) => p.sections.flatMap((s) => s.paragraphs.flatMap((t) => t.match(/\[À COMPLÉTER : [^\]]+\]/g) ?? [])))
}
