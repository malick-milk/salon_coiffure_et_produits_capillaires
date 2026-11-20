/**
 * PARCOURS DE BOUT EN BOUT : compte client et validation de commande (étape 5, partie 2).
 * Utilisation : serveur de dev lancé (VITE_ENABLE_MOCKS=true), puis
 *   node e2e/parcours-compte.cjs ./captures
 */
const { chromium } = require('playwright')
const SHOTS = process.argv[2]
const BASE = 'http://localhost:5173'
// Chaque échec est compté : le script se termine en erreur (code 1), ce que l'intégration continue détecte
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/40[134]|409|422|429/.test(m.text()) && errors.push(m.text()))

  // 1. Une page protégée redirige vers la connexion, en mémorisant la destination
  await page.goto(BASE + '/compte/reservations')
  await page.waitForURL('**/connexion?redirect=*')
  log(page.url().includes('redirect=%2Fcompte%2Freservations'), 'Page protégée : redirection vers /connexion avec retour prévu')

  // 2. Mauvais mot de passe : message vague (pas d'énumération des comptes)
  await page.getByLabel('E-mail ou téléphone').fill('mariama@client.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByText('Ces identifiants ne correspondent à aucun compte.').waitFor()
  log(true, 'Connexion refusée avec un message qui ne révèle pas si le compte existe')
  await page.screenshot({ path: `${SHOTS}/10-connexion-erreur.png` })

  // 3. Bon mot de passe : retour vers la page demandée
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo-dabo-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('**/compte/reservations')
  log(true, 'Connexion réussie : retour automatique sur /compte/reservations')
  log((await page.getByRole('link', { name: 'Mon compte (Mariama)' }).count()) === 1, 'En-tête : prénom affiché')

  // 4. Annulation d'une réservation à plus de 24 h
  await page.getByText('RDV-2026-000201').waitFor()
  await page.getByRole('button', { name: 'Annuler' }).click()
  await page.getByRole('button', { name: 'Oui, annuler' }).click()
  await page.getByText('Annulée').first().waitFor()
  log((await page.getByRole('button', { name: 'Annuler' }).count()) === 0, 'Réservation annulée (plus de bouton « Annuler »)')
  await page.screenshot({ path: `${SHOTS}/11-mes-reservations.png`, fullPage: true })

  // 4 bis. Rappel de resserrage (démo : twist simple il y a 30 jours, délai de 4 semaines) — maquette du 16 novembre
  log((await page.getByRole('link', { name: 'Notifications, 1 non lue' }).count()) === 1, 'Cloche : 1 notification non lue')
  await page.goto(BASE + '/compte')
  await page.getByRole('heading', { name: 'Votre resserrage approche' }).waitFor()
  log((await page.getByText(/Votre twist simple a été fait le/).count()) === 1, 'Vue d’ensemble : la carte « Votre resserrage approche » est en tête')
  await page.screenshot({ path: `${SHOTS}/11b-rappel-resserrage.png`, fullPage: true })
  await page.getByRole('link', { name: /Réserver mon resserrage/ }).click()
  await page.waitForURL('**/reserver?prestation=resserrage-twist')
  await page.locator('aside').getByText('Resserrage twist simple').waitFor() // attendre le chargement des prestations
  log(await page.getByRole('button', { name: 'Continuer' }).isEnabled(), 'Réserver : le « Resserrage twist simple » est déjà choisi (Continuer actif)')
  await page.goto(BASE + '/compte/notifications')
  await page.getByRole('link', { name: 'Notifications', exact: true }).first().waitFor()
  log((await page.getByRole('link', { name: /non lue/ }).count()) === 0, 'Rubrique ouverte : la pastille de la cloche disparaît')
  await page.getByRole('button', { name: 'Me le rappeler dans 1 semaine' }).click()
  await page.getByText('Aucune notification').waitFor()
  log(true, '« Me le rappeler dans 1 semaine » : le rappel disparaît jusqu’au report')

  // 5. Commandes : liste puis détail avec prix figés
  await page.getByRole('link', { name: 'Mes commandes' }).click()
  await page.getByRole('link', { name: /CMD-2026-000101/ }).click()
  await page.getByRole('heading', { name: 'CMD-2026-000101' }).waitFor()
  log((await page.getByText('12 000 F CFA').count()) >= 1, 'Détail de commande : total 11 000 + 1 000 de livraison = 12 000 F CFA')
  await page.screenshot({ path: `${SHOTS}/12-detail-commande.png`, fullPage: true })

  // 6. Profil
  await page.getByRole('link', { name: 'Profil' }).click()
  await page.getByLabel('Téléphone mobile').fill('12')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByText('Numéro mobile invalide.').waitFor()
  await page.getByLabel('Téléphone mobile').fill('78 555 44 33')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByText('Profil mis à jour').waitFor()
  log(true, 'Profil : numéro invalide refusé, puis enregistrement réussi')

  // 7. Commande d'un client connecté : coordonnées préremplies
  await page.goto(BASE + '/produits/spray-hydratant-250-ml')
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.goto(BASE + '/commande')
  await page.getByRole('heading', { name: 'Validation de la commande' }).waitFor()
  await page.waitForFunction(() => document.querySelector('input[name=first_name]')?.value === 'Mariama', null, { timeout: 5000 }).catch(() => {})
  log((await page.getByLabel('Prénom *').inputValue()) === 'Mariama', 'Commande : coordonnées préremplies depuis le compte')
  await page.getByLabel('Livraison').check()
  await page.getByRole('checkbox', { name: /conditions de vente/ }).check()
  await page.getByRole('button', { name: 'Confirmer la commande' }).click()
  await page.getByText('Choisissez votre zone de livraison.').waitFor()
  log((await page.getByText('Indiquez l’adresse de livraison.').count()) === 1, 'Livraison : zone et adresse exigées (validation conditionnelle)')
  await page.getByLabel('Zone de livraison *').selectOption({ label: 'Parcelles Assainies — 1 500 F CFA' })
  await page.getByLabel('Adresse *').fill('Unité 15, villa 42')
  await page.getByLabel('Point de repère').fill('Derrière la mosquée')
  log((await page.locator('aside').getByText('6 500 F CFA').count()) === 1, 'Récapitulatif : 5 000 + 1 500 de livraison = 6 500 F CFA')
  await page.screenshot({ path: `${SHOTS}/13-commande.png`, fullPage: true })
  await page.getByRole('button', { name: 'Confirmer la commande' }).click()
  await page.getByText('Commande enregistrée').waitFor()
  const ref = (await page.getByText(/CMD-2026-\d{6}/).textContent()).trim()
  log(ref === 'CMD-2026-000010', `Commande enregistrée : ${ref}`)
  log((await page.getByRole('link', { name: /Panier, 0 article/ }).count()) === 1, 'Panier vidé après la commande')
  await page.getByRole('link', { name: 'Suivre ma commande' }).click()
  await page.getByRole('heading', { name: ref }).waitFor()
  log((await page.getByText('Derrière la mosquée').count()) === 1, 'Suivi : la commande et son point de repère apparaissent dans le compte')

  // 8. Déconnexion : le cache est vidé et les pages du compte redeviennent protégées
  await page.goto(BASE + '/compte')
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await page.waitForURL(BASE + '/')
  await page.goto(BASE + '/compte/commandes')
  await page.waitForURL('**/connexion*')
  log(true, 'Déconnexion : /compte/commandes redirige vers la connexion')

  // 9. Commande INVITÉ + conflit de stock (30 sérums demandés, 24 en stock)
  // L'identifiant du produit est demandé à l'API (il diffère entre le faux serveur et la vraie base)
  await page.evaluate(async () => {
    const { data } = await (await fetch('/api/v1/products/serum-activ-pousse-30-ml', { headers: { Accept: 'application/json' } })).json()
    localStorage.setItem('dabo-hair-cart', JSON.stringify({ state: { items: [{ productId: data.id, slug: data.slug, name: data.name, unitSize: data.unit_size, price: data.price, quantity: 30 }] }, version: 1 }))
  })
  await page.goto(BASE + '/commande')
  await page.getByLabel('Prénom *').fill('Khady')
  await page.getByLabel('Nom *', { exact: true }).fill('Fall')
  await page.getByLabel('Téléphone mobile *').fill('76 111 22 33')
  await page.getByRole('checkbox', { name: /conditions de vente/ }).check()
  await page.getByRole('button', { name: 'Confirmer la commande' }).click()
  await page.getByText('Stock insuffisant pour certains produits.').waitFor()
  log((await page.getByText(/30 demandés, 24 disponibles/).count()) === 1, 'Conflit de stock (409) : « 30 demandés, 24 disponibles »')
  await page.screenshot({ path: `${SHOTS}/14-conflit-stock.png`, fullPage: true })
  await page.getByRole('button', { name: 'Passer à 24' }).click()
  await page.getByRole('button', { name: 'Confirmer la commande' }).click()
  await page.getByText('Commande enregistrée').waitFor()
  log((await page.getByText('72 000 F CFA').count()) >= 1, 'Commande invité réussie après ajustement : 24 × 3 000 = 72 000 F CFA')
  await page.goto(BASE + '/produits/serum-activ-pousse-30-ml')
  await page.getByText('Rupture de stock').waitFor()
  log(await page.getByRole('button', { name: 'Indisponible' }).isDisabled(), 'Stock mis à jour : le sérum 30 ml est maintenant en rupture')

  // 10. Protection IDOR : Mariama ne peut pas voir la commande de l'invité
  await page.goto(BASE + '/connexion?redirect=/compte/commandes/CMD-2026-000011')
  await page.getByLabel('E-mail ou téléphone').fill('mariama@client.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo-dabo-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByText('Commande introuvable').waitFor()
  log(true, 'IDOR : la commande d’un autre client est refusée (403) même en connaissant sa référence')
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await page.waitForURL(BASE + '/')

  // 11. Redirection externe refusée après connexion (open redirect)
  await page.goto(BASE + '/connexion?redirect=https://site-pirate.example')
  await page.getByLabel('E-mail ou téléphone').fill('mariama@client.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo-dabo-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(BASE + '/compte')
  log(true, 'Open redirect : une destination externe est remplacée par /compte')
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await page.waitForURL(BASE + '/')

  // 12. Limitation des tentatives (RG-SEC-02) : 6e essai bloqué
  await page.goto(BASE + '/connexion')
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('E-mail ou téléphone').fill('cible@client.test')
    await page.getByLabel('Mot de passe', { exact: true }).fill(`essai-${i}`)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await page.getByText('Ces identifiants ne correspondent à aucun compte.').waitFor()
  }
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByText('Trop de tentatives. Réessayez dans une minute.').waitFor()
  log(true, 'Après 5 échecs, la 6e tentative est bloquée (429)')

  // 13. Inscription rapide (18 novembre 2026) : prénom, téléphone, mot de passe
  await page.goto(BASE + '/inscription')
  await page.getByLabel('Confirmer le mot de passe').waitFor() // la page est chargée à la demande : attendre le formulaire
  log(await page.getByLabel('Nom', { exact: true }).count() === 0 && await page.getByLabel('Confirmer le mot de passe').count() === 1, 'Inscription : prénom, téléphone, mot de passe saisi deux fois (ni nom, ni e-mail)')
  await page.getByLabel('Prénom').fill('Ndeye')
  await page.getByLabel('Téléphone mobile').fill('78 555 44 33') // numéro ACTUEL de Mariama (changé à l'étape Profil)
  await page.getByLabel('Mot de passe', { exact: true }).fill('Ndeye-Mdp-2026x')
  await page.getByLabel('Confirmer le mot de passe').fill('Autre-Mdp-2026x')
  await page.getByRole('checkbox', { name: /politique de confidentialité/ }).check()
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await page.getByText('Les mots de passe ne correspondent pas.').waitFor()
  log(true, 'Inscription : deux mots de passe différents refusés')
  await page.getByLabel('Mot de passe', { exact: true }).fill('Dakar-Mdp-2026')
  await page.getByLabel('Confirmer le mot de passe').fill('Dakar-Mdp-2026')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await page.getByText('Ce numéro est déjà utilisé.').waitFor()
  log(true, 'Inscription : numéro déjà pris refusé par le serveur (422)')
  await page.getByLabel('Téléphone mobile').fill('70 222 33 44')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await page.waitForURL('**/compte')
  await page.getByRole('heading', { name: 'Bonjour Ndeye' }).waitFor()
  log(true, 'Inscription réussie : connectée automatiquement')
  // Sans e-mail, on se connecte avec son numéro
  await page.getByRole('button', { name: 'Se déconnecter' }).first().click()
  await page.waitForURL(BASE + '/') // la déconnexion ramène à l'accueil : attendre qu'elle soit finie
  // Bug du 18 novembre 2026 : après la déconnexion, l'en-tête gardait le prénom de la cliente précédente
  log(await page.getByRole('banner').getByRole('link', { name: 'Se connecter' }).count() >= 1 && await page.getByRole('banner').getByRole('link', { name: /Mon compte \(/ }).count() === 0,
    'Déconnexion : l’en-tête n’affiche plus le prénom de la cliente précédente')
  await page.goto(BASE + '/connexion')
  await page.getByLabel('E-mail ou téléphone').fill('70 222 33 44')
  await page.getByLabel('Mot de passe', { exact: true }).fill('Dakar-Mdp-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('**/compte')
  log(true, 'Connexion avec le numéro de téléphone (compte sans e-mail)')

  // 13 bis. Bug du 19 novembre 2026 : après une cliente, la gérante se connecte. Elle doit arriver dans l'ERP
  // et ne JAMAIS voir les réservations de la cliente (elles restaient en mémoire dans le navigateur)
  await page.getByRole('button', { name: 'Se déconnecter' }).first().click()
  await page.waitForURL(BASE + '/')
  await page.goto(BASE + '/connexion?redirect=/compte/reservations')
  await page.getByLabel('E-mail ou téléphone').fill('mariama@client.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo-dabo-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByText(/RDV-2026-\d{6}/).first().waitFor()
  // Mariama met un produit dans son panier (bug du 20 novembre 2026 : il réapparaissait chez la gérante)
  await page.goto(BASE + '/produits/spray-hydratant-250-ml')
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.getByRole('link', { name: 'Voir le panier' }).waitFor()
  await page.goto(BASE + '/compte/reservations')
  await page.getByRole('button', { name: 'Se déconnecter' }).first().click()
  await page.waitForURL(BASE + '/')
  log(true, 'Déconnexion depuis « Mes réservations » : retour à l’accueil (et non /connexion?redirect=…)')
  await page.goto(BASE + '/connexion?redirect=/compte/reservations') // comme si la page de la cliente avait été gardée
  await page.getByLabel('E-mail ou téléphone').fill('admin@dabohair.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin-dabo-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(BASE + '/admin')
  log(true, 'Gérante connectée après une cliente : arrive dans l’ERP, pas dans l’espace de la cliente')
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('dabo-hair-cart') ?? '{"state":{"items":[]}}').state.items.length)
  log(cart === 0, `Gérante : le panier de la cliente précédente n’est plus là (${cart} article)`)
  await page.goto(BASE + '/compte/reservations')
  await page.getByRole('heading', { name: 'Mes réservations' }).waitFor()
  await page.waitForTimeout(1000)
  log(await page.getByText(/RDV-2026-\d{6}/).count() === 0, 'Gérante : aucune réservation de la cliente précédente à l’écran')
  await page.getByRole('button', { name: 'Se déconnecter' }).first().click()
  await page.waitForURL(BASE + '/')

  // 14. Mobile
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
  for (const path of ['/connexion', '/inscription', '/commande', '/panier']) {
    await m.goto(BASE + path)
    await m.waitForLoadState('networkidle')
    log(!(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `Mobile 390 px : ${path} sans défilement horizontal`)
  }
  await m.screenshot({ path: `${SHOTS}/15-mobile-panier.png`, fullPage: true })

  log(errors.length === 0, `Console : ${errors.length} erreur(s) JavaScript inattendue(s)${errors.length ? ' → ' + errors.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
