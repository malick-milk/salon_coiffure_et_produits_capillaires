/**
 * PARCOURS DE BOUT EN BOUT : la gamme au PRIX MEMBRE (lancement du 15 décembre 2026), sur téléphone.
 * Maquettes validées le 18 novembre 2026 : accueil, fiche de la gamme, panier sans compte,
 * inscription rapide (3 champs), panier au prix membre, commande à 10 000 F, une gamme par compte.
 * Utilisation : API Laravel + site lancés (base fraîche), puis
 *   node e2e/parcours-prix-membre.cjs ./captures
 */
const { chromium } = require('playwright')
const SHOTS = process.argv[2]
const BASE = 'http://localhost:5173'
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }
const text = async (locator) => (await locator.textContent()).replace(/[\u202f\u00a0]/g, ' ')

;(async () => {
  const browser = await chromium.launch()
  const errors = []

  // 0. Dans la base de démonstration, la crème est en rupture : la gamme aussi. Awa fabrique un lot de crème (ERP).
  const admin = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await admin.goto(BASE + '/connexion')
  await admin.getByLabel('E-mail ou téléphone').fill('admin@dabohair.test')
  await admin.getByLabel('Mot de passe', { exact: true }).fill('admin-dabo-2026')
  await admin.getByRole('button', { name: 'Se connecter' }).click()
  await admin.waitForURL('**/admin')
  const xsrf = decodeURIComponent((await admin.context().cookies()).find((c) => c.name === 'XSRF-TOKEN').value)
  const lot = await admin.request.post(BASE + '/api/v1/admin/production-batches', {
    headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf, Referer: BASE + '/admin' },
    data: { product_id: (await (await admin.request.get(BASE + '/api/v1/products/creme-capillaire', { headers: { Accept: 'application/json' } })).json()).data.id,
      batch_number: 'LOT-E2E-CREME', quantity_produced: 24, produced_on: new Date().toISOString().slice(0, 10) },
  })
  log(lot.status() === 201, `Fabrication de 24 crèmes : la gamme redevient disponible (${lot.status()})`)
  await admin.close()

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/40[134]|409|422|429/.test(m.text()) && errors.push(m.text()))
  const noScroll = async (where) => log(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `Mobile 390 px : ${where} sans défilement horizontal`)

  // 1. Accueil, visiteuse sans compte : deux prix et le compteur
  await page.goto(BASE + '/')
  const hero = page.locator('section', { has: page.getByRole('heading', { name: 'La gamme complète, six soins' }) })
  await hero.waitFor()
  const heroText = await text(hero)
  log(/Prix membre\s*10 000 F CFA/.test(heroText) && /Sans compte\s*15 000 F CFA/.test(heroText), 'Accueil : prix membre 10 000 F et prix sans compte 15 000 F côte à côte')
  log(heroText.includes('Plus que 20 gammes sur 20 au prix membre'), 'Accueil : compteur « Plus que 20 gammes sur 20 »')
  await page.screenshot({ path: `${SHOTS}/60-prix-membre-accueil.png`, fullPage: true })
  await noScroll('accueil')

  // 2. Fiche de la gamme : contenu, ajout au panier
  await hero.getByRole('link', { name: 'La gamme complète, six soins' }).click()
  await page.getByRole('heading', { name: 'Dans la gamme' }).waitFor()
  log(await page.locator('li', { has: page.getByRole('link', { name: 'Leave In' }) }).count() === 1, 'Fiche : les 6 soins de la gamme sont listés (Leave In compris)')
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.getByRole('link', { name: 'Voir le panier' }).click()

  // 3. Panier sans compte : l'encart propose le compte, la commande reste possible à 15 000 F
  await page.getByRole('heading', { name: /Payez 10.000.F CFA au lieu de 15.000.F CFA/ }).waitFor()
  log(await page.getByRole('link', { name: /Commander sans compte · 15.000.F CFA/ }).count() === 1, 'Panier sans compte : encart « Payez 10 000 F au lieu de 15 000 F » et commande possible à 15 000 F')
  await page.screenshot({ path: `${SHOTS}/61-prix-membre-panier-sans-compte.png`, fullPage: true })
  await noScroll('panier')

  // 4. Inscription rapide : 3 champs, le panier est rappelé
  await page.getByRole('link', { name: 'Créer mon compte gratuit' }).click()
  await page.waitForURL(/\/inscription\?redirect=/, { waitUntil: 'commit' }) // navigation interne : pas d'événement « load »
  log((await text(page.getByText(/vous attend dans le panier/))).includes('gamme à 10 000 F CFA'), 'Inscription : « Votre gamme à 10 000 F vous attend dans le panier »')
  await page.getByLabel('Prénom').fill('Aïssatou')
  await page.getByLabel('Téléphone mobile').fill('76 555 44 33')
  await page.getByLabel('Mot de passe', { exact: true }).fill('Lancement-2026')
  await page.getByLabel('Confirmer le mot de passe').fill('Lancement-2026')
  await page.getByRole('checkbox', { name: /politique de confidentialité/ }).check()
  await page.screenshot({ path: `${SHOTS}/62-prix-membre-inscription.png`, fullPage: true })
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  // 5. Retour au panier : prix membre appliqué
  await page.getByText('Bienvenue Aïssatou : votre prix membre est appliqué.').waitFor()
  const aside = await text(page.getByRole('complementary', { name: 'Total' }))
  log(/Prix membre\s*−5 000 F CFA/.test(aside) && /Total\s*10 000 F CFA/.test(aside), `Panier membre : −5 000 F, total 10 000 F (${aside.replace(/\s+/g, ' ').slice(0, 90)}…)`)
  await page.screenshot({ path: `${SHOTS}/63-prix-membre-panier-membre.png`, fullPage: true })

  // 6. Commande : le serveur facture bien 10 000 F ; le nom est demandé ici (il manquait à l'inscription)
  await page.getByRole('link', { name: 'Valider la commande' }).click()
  await page.getByLabel('Nom *', { exact: true }).fill('Ba')
  const consent = page.getByRole('checkbox', { name: /accepte|confidentialité/ })
  if (await consent.count()) await consent.first().check()
  await page.getByRole('button', { name: 'Confirmer la commande' }).click()
  await page.getByRole('heading', { name: 'Commande enregistrée' }).waitFor()
  log((await text(page.locator('main'))).includes('10 000 F CFA'), 'Commande enregistrée à 10 000 F (prix calculé par le serveur)')

  // 7. Une gamme par compte : la fiche le dit, et le compteur a baissé
  await page.goto(BASE + '/produits/gamme-complete-dabo-hair')
  await page.getByText('Vous avez déjà profité du prix membre : une gamme par compte.').waitFor()
  log((await text(page.locator('main'))).includes('Plus que 19 gammes sur 20'), 'Une gamme par compte : message affiché, compteur à 19 sur 20')
  await page.screenshot({ path: `${SHOTS}/64-prix-membre-deja-utilise.png`, fullPage: true })

  log(errors.length === 0, `Console : ${errors.length} erreur(s) JavaScript inattendue(s)${errors.length ? ' → ' + errors.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
