/**
 * PARCOURS DE BOUT EN BOUT : l'ERP (étape 7, partie 2), contre la VRAIE API Laravel.
 * Préparation : cd backend && php artisan migrate:fresh --seed && php artisan serve
 *               cd frontend && npm run dev   (VITE_ENABLE_MOCKS=false)
 * Utilisation : node e2e/parcours-admin.cjs ./captures
 */
const { chromium } = require('playwright')
const SHOTS = process.argv[2] || '.'
const BASE = 'http://localhost:5173'
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }

async function login(page, email, password) {
  await page.goto(BASE + '/connexion')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/40[134]|409|422|429/.test(m.text()) && errors.push(m.text()))
  const menu = page.getByRole('navigation', { name: 'Menu ERP' })

  // 1. Un visiteur est renvoyé vers la connexion
  await page.goto(BASE + '/admin')
  await page.waitForURL('**/connexion?redirect=*')
  log(true, '/admin sans session : redirection vers /connexion')

  // 2. Le propriétaire se connecte : il arrive sur l'ERP
  await login(page, 'admin@dabohair.test', 'admin-dabo-2026')
  await page.waitForURL('**/admin')
  await page.getByRole('heading', { name: 'Tableau de bord' }).waitFor()
  log(true, 'Connexion du propriétaire : arrivée sur /admin')
  await page.getByText('CA du mois').waitFor()
  log(true, 'Tableau de bord : le chiffre d’affaires est visible (permission analytics.view)')
  log(await page.getByText(/Crème capillaire.*rupture de stock/).count() === 1, 'Alerte stock : Crème capillaire en rupture')
  const ALL = ['Tableau de bord', 'Commandes', 'Planning', 'Clients', 'Produits et stock', 'Fabrication', 'Équipe et rôles', 'Journal d’audit']
  const visible = async (m) => { const r = []; for (const n of ALL) if (await m.getByRole('link', { name: n, exact: true }).count()) r.push(n); return r }
  log((await visible(menu)).length === 8, 'Menu complet : 8 entrées pour le super administrateur')
  await page.screenshot({ path: `${SHOTS}/40-erp-dashboard.png`, fullPage: true })

  // 3. Commandes : filtre puis traitement complet d'un retrait en boutique
  await menu.getByRole('link', { name: 'Commandes', exact: true }).click()
  await page.getByLabel('Rechercher (référence, client, téléphone)').fill('Mariama')
  await page.getByRole('button', { name: 'Filtrer' }).click()
  await page.waitForURL(/search=Mariama/)
  await page.getByRole('link', { name: 'CMD-2026-000009' }).waitFor({ state: 'detached' })
  log(await page.getByRole('link', { name: 'CMD-2026-000102' }).count() === 1, 'Filtre « Mariama » : la commande du revendeur est masquée, filtre dans l’URL')
  await page.screenshot({ path: `${SHOTS}/41-erp-commandes.png` })
  await page.getByRole('link', { name: 'CMD-2026-000102' }).click()
  await page.getByRole('heading', { name: 'CMD-2026-000102' }).waitFor()
  for (const step of ['Mettre en préparation', 'Prête à retirer']) {
    await page.getByRole('button', { name: step }).click()
    await page.getByRole('button', { name: step }).waitFor({ state: 'detached' })
  }
  log(true, 'Commande : confirmée → en préparation → prête (boutons calculés par le serveur)')

  // Encaissement Wave : facture émise automatiquement
  await page.getByLabel('Moyen de paiement').selectOption('wave')
  await page.getByLabel('Référence de transaction (facultatif)').fill('WAVE-TEST-001')
  await page.getByRole('button', { name: /Encaisser/ }).click()
  await page.getByText('Paiement enregistré, facture émise.').waitFor()
  const invoice = page.getByRole('link', { name: /Facture FAC-2026-\d{6} \(PDF\)/ })
  await invoice.waitFor()
  log(true, `Paiement Wave enregistré, ${await invoice.textContent()}`)
  const pdf = await page.request.get(BASE + (await invoice.getAttribute('href')), { headers: { Referer: BASE + '/admin' } })
  log(pdf.status() === 200 && pdf.headers()['content-type'] === 'application/pdf', 'Le PDF de la facture se télécharge (application/pdf)')
  await page.getByRole('button', { name: 'Marquer livrée' }).click()
  await page.getByRole('button', { name: 'Marquer livrée' }).waitFor({ state: 'detached' })
  log(await page.getByRole('button', { name: 'Annuler…' }).count() === 0, 'Commande livrée : plus aucune action possible (état final)')
  await page.screenshot({ path: `${SHOTS}/42-erp-commande-detail.png`, fullPage: true })

  // 4. Planning : retrouver le rendez-vous à J+10 et l'annuler avec un motif
  await menu.getByRole('link', { name: 'Planning', exact: true }).click()
  await page.getByRole('heading', { name: 'Planning' }).waitFor()
  const rdv = page.locator('li', { hasText: 'RDV-2026-000201' })
  for (let i = 0; i < 3 && !(await rdv.count()); i++) {
    await page.getByRole('button', { name: 'Semaine suivante' }).click()
    await page.waitForTimeout(600)
  }
  await rdv.waitFor()
  log(true, 'Planning : navigation par semaine jusqu’au rendez-vous de Mariama')
  await rdv.getByRole('button', { name: 'Annuler…' }).click()
  await rdv.getByLabel('Motif (prévenir le client)').fill('Coiffeuse malade, client prévenu')
  await page.screenshot({ path: `${SHOTS}/43-erp-planning.png` })
  await rdv.getByRole('button', { name: 'Confirmer l’annulation' }).click()
  await rdv.getByText('Annulée').waitFor()
  log(true, 'Rendez-vous annulé avec motif')

  // 5. Produits : prix, perte de stock tracée
  await menu.getByRole('link', { name: 'Produits et stock' }).click()
  const price = page.getByLabel('Prix de Masque capillaire', { exact: false })
  await price.fill('3500')
  await page.getByRole('button', { name: 'OK' }).click()
  await page.getByRole('button', { name: 'OK' }).waitFor({ state: 'detached' })
  const prices = await (await page.request.get(BASE + '/api/v1/products?per_page=50')).json()
  log(prices.data.some((p) => p.name.startsWith('Masque') && p.price === 3500), 'Nouveau prix du masque visible dans la boutique (3 500)')
  const row = page.locator('tr', { hasText: 'Shampooing sans sulfate' })
  await row.getByRole('button', { name: 'Stock' }).click()
  await page.getByLabel('Quantité', { exact: true }).fill('2')
  await page.getByLabel('Motif (obligatoire)').fill('Flacons cassés au déballage')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText('Mouvement enregistré dans le grand livre').waitFor()
  await page.getByRole('heading', { name: /Stock — Shampooing sans sulfate.*\(46\)/ }).waitFor()
  log(true, 'Perte de 2 shampooings : stock 48 → 46, mouvement dans le grand livre')
  await page.screenshot({ path: `${SHOTS}/44-erp-stock.png`, fullPage: true })

  // 6. Fabrication : lot du spray anti-chute dont le coût était inconnu
  await menu.getByRole('link', { name: 'Fabrication' }).click()
  await page.getByLabel('Produit', { exact: true }).selectOption({ label: 'Spray anti-chute 250 ml' }).catch(async () => {
    const opts = await page.getByLabel('Produit', { exact: true }).locator('option').allTextContents()
    await page.getByLabel('Produit', { exact: true }).selectOption({ label: opts.find((o) => o.startsWith('Spray anti-chute')) })
  })
  await page.getByLabel('Numéro de lot (imprimé sur le flacon)').fill('LOT-E2E-SAC')
  await page.getByLabel('Quantité fabriquée (unités)').fill('96')
  await page.getByLabel('Description du poste 1').fill('Matières premières')
  await page.getByLabel('Montant du poste 1 en F CFA').fill('15000')
  await page.getByRole('button', { name: 'Ajouter un poste' }).click()
  await page.getByLabel('Description du poste 2').fill('Flacons 250 ml')
  await page.getByLabel('Montant du poste 2 en F CFA').fill('10000')
  await page.getByRole('button', { name: 'Enregistrer le lot' }).click()
  await page.getByText(/Lot enregistré\. 96 unités.*260,42 F par unité/).waitFor()
  log(true, 'Lot enregistré : 25 000 F / 96 unités = 260,42 F de coût de revient (calculé par MySQL)')
  await page.screenshot({ path: `${SHOTS}/45-erp-fabrication.png`, fullPage: true })

  // 7. Clients
  await menu.getByRole('link', { name: 'Clients', exact: true }).click()
  await page.getByLabel('Rechercher (nom, téléphone, email)').fill('Mariama')
  await page.getByRole('button', { name: 'Rechercher' }).click()
  const mariama = page.locator('tr', { hasText: 'Mariama' })
  await mariama.first().waitFor()
  // 12 000 (commande livrée) + 6 000 (encaissée à l'étape 3) + prestation terminée : la valeur vie client suit les paiements
  const spent = (await mariama.first().locator('td', { hasText: 'F CFA' }).textContent()).replace(/[\u202f\u00a0]/g, ' ').trim()
  log(spent === '26 000 F CFA', `Clients : valeur vie client de Mariama à jour après l’encaissement (${spent})`)

  // 8. Équipe : création d'un caissier
  await menu.getByRole('link', { name: 'Équipe et rôles' }).click()
  await page.getByLabel('Prénom').fill('Khady')
  await page.getByLabel('Nom', { exact: true }).fill('Fall')
  await page.getByLabel('Email').fill('khady@dabohair.test')
  await page.getByLabel('Rôle', { exact: true }).selectOption('cashier')
  await page.getByLabel(/Mot de passe initial/).fill('caisse2026dabo')
  await page.getByRole('button', { name: 'Créer le compte' }).click()
  await page.locator('tr', { hasText: 'khady@dabohair.test' }).waitFor()
  log(true, 'Compte caissier créé (Khady Fall)')
  await page.screenshot({ path: `${SHOTS}/46-erp-equipe.png`, fullPage: true })

  // 9. Journal d'audit : les actions précédentes sont tracées
  await menu.getByRole('link', { name: 'Journal d’audit' }).click()
  await page.getByRole('heading', { name: 'Journal d’audit' }).waitFor()
  await page.locator('tbody tr').first().waitFor()
  const audit = await page.locator('main').textContent()
  log(/Masque/.test(audit) && /CMD-2026-000102/.test(audit), 'Audit : changement de prix et commande tracés')
  await page.screenshot({ path: `${SHOTS}/47-erp-audit.png`, fullPage: true })

  // 10. Le caissier : menu réduit, pas de chiffre d'affaires, pages interdites
  await ctx.clearCookies()
  const p2 = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  p2.on('pageerror', (e) => errors.push(e.message))
  await login(p2, 'khady@dabohair.test', 'caisse2026dabo')
  await p2.waitForURL('**/admin')
  await p2.getByText('Chiffre d’affaires').waitFor()
  log(await p2.getByText('CA du mois').count() === 0, 'Caissier : le chiffre d’affaires est masqué (le serveur ne l’envoie pas)')
  const m2 = p2.getByRole('navigation', { name: 'Menu ERP' })
  const v2 = await visible(m2)
  log(!v2.includes('Équipe et rôles') && !v2.includes('Journal d’audit') && v2.includes('Commandes'), `Caissier : menu réduit (${v2.join(', ')})`)
  await m2.getByRole('link', { name: 'Fabrication', exact: true }).click()
  await p2.getByRole('heading', { name: 'Lots fabriqués' }).waitFor()
  log(await p2.getByRole('button', { name: 'Enregistrer le lot' }).count() === 0, 'Caissier : consulte les lots (stock.view) mais sans formulaire de fabrication (production.manage)')
  const api = await p2.request.get(BASE + '/api/v1/admin/users', { headers: { Accept: 'application/json', Referer: BASE + '/admin' } })
  log(api.status() === 403, 'Caissier : l’API /admin/users répond 403 même si on tape l’URL')
  await p2.screenshot({ path: `${SHOTS}/48-erp-caissier.png`, fullPage: true })

  // 11. La cliente : page « accès refusé »
  const p3 = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await login(p3, 'mariama@client.test', 'demo-dabo-2026')
  await p3.waitForURL('**/compte')
  log(await p3.getByRole('link', { name: 'ERP' }).count() === 0, 'Cliente : pas de lien ERP dans l’en-tête')
  await p3.goto(BASE + '/admin')
  await p3.getByText(/accès|Accès/).first().waitFor()
  log(await p3.getByRole('navigation', { name: 'Menu ERP' }).count() === 0, 'Cliente sur /admin : page « accès refusé », aucun menu ERP')
  await p3.screenshot({ path: `${SHOTS}/49-erp-refus-mobile.png` })

  log(errors.length === 0, `Aucune erreur JavaScript (${errors.join(' | ') || 'aucune'})`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
