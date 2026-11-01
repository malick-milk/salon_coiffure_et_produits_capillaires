/**
 * PARCOURS DE BOUT EN BOUT : compte client et validation de commande (étape 5, partie 2).
 * Utilisation : serveur de dev lancé (VITE_ENABLE_MOCKS=true), puis
 *   node e2e/parcours-compte.cjs ./captures
 */
const { chromium } = require('playwright')
const SHOTS = process.argv[2]
const BASE = 'http://localhost:5173'
const log = (ok, msg) => console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`)

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
  await page.getByLabel('Email').fill('mariama@client.test')
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
  await page.evaluate(() => localStorage.setItem('dabo-hair-cart', JSON.stringify({ state: { items: [{ productId: 10, slug: 'serum-activ-pousse-30-ml', name: 'Sérum Activ’Pousse', unitSize: '30 ml', price: 3000, quantity: 30 }] }, version: 1 })))
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
  await page.getByLabel('Email').fill('mariama@client.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo-dabo-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByText('Commande introuvable').waitFor()
  log(true, 'IDOR : la commande d’un autre client est refusée (403) même en connaissant sa référence')
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await page.waitForURL(BASE + '/')

  // 11. Redirection externe refusée après connexion (open redirect)
  await page.goto(BASE + '/connexion?redirect=https://site-pirate.example')
  await page.getByLabel('Email').fill('mariama@client.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo-dabo-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(BASE + '/compte')
  log(true, 'Open redirect : une destination externe est remplacée par /compte')
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await page.waitForURL(BASE + '/')

  // 12. Limitation des tentatives (RG-SEC-02) : 6e essai bloqué
  await page.goto(BASE + '/connexion')
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Email').fill('cible@client.test')
    await page.getByLabel('Mot de passe', { exact: true }).fill(`essai-${i}`)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await page.getByText('Ces identifiants ne correspondent à aucun compte.').waitFor()
  }
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByText('Trop de tentatives. Réessayez dans une minute.').waitFor()
  log(true, 'Après 5 échecs, la 6e tentative est bloquée (429)')

  // 13. Inscription
  await page.goto(BASE + '/inscription')
  await page.getByLabel('Prénom').fill('Ndeye')
  await page.getByLabel('Nom', { exact: true }).fill('Gueye')
  await page.getByLabel('Email').fill('mariama@client.test')
  await page.getByLabel('Téléphone mobile').fill('70 222 33 44')
  await page.getByLabel('Mot de passe', { exact: true }).fill('nouveau-mdp-1')
  await page.getByLabel('Confirmer le mot de passe').fill('nouveau-mdp-2')
  await page.getByRole('checkbox', { name: /politique de confidentialité/ }).check()
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await page.getByText('Les mots de passe ne correspondent pas.').waitFor()
  await page.getByLabel('Confirmer le mot de passe').fill('nouveau-mdp-1')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await page.getByText('Un compte existe déjà avec cette adresse.').waitFor()
  log(true, 'Inscription : confirmation vérifiée côté navigateur, email déjà pris refusé par le serveur (422)')
  await page.getByLabel('Email').fill('ndeye@client.test')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await page.waitForURL('**/compte')
  await page.getByRole('heading', { name: 'Bonjour Ndeye' }).waitFor()
  log(true, 'Inscription réussie : connectée automatiquement')

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
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
