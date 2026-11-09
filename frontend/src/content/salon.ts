/**
 * COORDONNÉES DU SALON — affichées sur l'accueil (horaires, adresse, téléphone) et dans les données
 * pour Google (référencement local). Les factures et les SMS lisent les mêmes informations côté serveur
 * (commande « php artisan app:company »).
 */
export const salon = {
  name: 'Dabo Hair',
  address: 'Cité Almadies 2, ZAC Mbao (Extension Jaxaay)',
  city: 'Dakar',
  country: 'Sénégal',
  phoneDisplay: '77 602 62 00',
  phoneE164: '+221776026200', // format international, pour le lien « appeler »
} as const

/** Lien Google Maps vers l'adresse (ouvre l'application Plans sur téléphone) */
export const salonMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salon.address}, ${salon.city}, ${salon.country}`)}`
