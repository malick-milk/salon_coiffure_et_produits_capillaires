/**
 * PARCOURS DE BOUT EN BOUT : promotion en pourcentage (maquettes validées le 20 novembre 2026).
 * La gérante crée « −20 % » dans l'ERP ; une cliente la voit sur le site et commande au prix promo ;
 * le prix initial ne bouge pas ; résultats ; « Arrêter maintenant » remet le prix initial.
 * Utilisation : API Laravel + site lancés (base fraîche), puis
 *   node e2e/parcours-promotions.cjs ./captures
 */
const { chromium } = require('playwright')
const SHOTS = process.argv[2]
const BASE = 'http://localhost:5173'
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }
const text = async (locator) => (await locator.textContent()).replace(/[\u202f\u00a0]/g, ' ')
const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const admin = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  admin.on('pageerror', (e) => errors.push(e.message))

  // 1. La gérante crée la promotion dans l'ERP
  await admin.goto(BASE + '/connexion')
  await admin.getByLabel('E-mail ou téléphone').fill('admin@dabohair.test')
  await admin.getByLabel('Mot de passe', { exact: true }).fill('admin-dabo-2026')
  await admin.getByRole('button', { name: 'Se connecter' }).click()
  await admin.waitForURL('**/admin')
  await admin.getByRole('navigation', { name: 'Menu ERP' }).getByRole('link', { name: 'Promotions' }).click()
  await admin.getByRole('link', { name: 'Nouvelle promotion' }).click()
  await admin.getByLabel('Nom (pour vous, pas affiché sur le site)').fill('Fêtes de fin d’année')
  await admin.getByRole('button', { name: '20 %' }).click()
  await admin.getByLabel('Fin (incluse)').fill(inDays(30))
  await admin.getByRole('checkbox', { name: /Spray hydratant 250 ml/ }).check()
  await admin.getByRole('checkbox', { name: /Shampooing sans sulfate/ }).check()
  log(await admin.getByRole('checkbox', { name: /Gamme complète/ }).isDisabled(), 'Nouvelle promotion : la gamme (prix membre) ne peut pas être cochée')
  const marge = await text(admin.locator('section', { has: admin.getByRole('heading', { name: 'Avant de lancer : la marge' }) }))
  log(/4 000 F CFA/.test(marge) && /3 650 F CFA · 91,3 %/.test(marge), 'Avant de lancer : spray 5 000 → 4 000 F, marge 3 650 F (91,3 %)')
  await admin.screenshot({ path: `${SHOTS}/70-erp-nouvelle-promotion.png`, fullPage: true })
  await admin.getByRole('button', { name: 'Programmer la promotion' }).click()
  await admin.getByText('Promotion « Fêtes de fin d’année » enregistrée.').waitFor()
  log((await text(admin.getByRole('row', { name: /Fêtes de fin d’année/ }))).includes('En cours'), 'Liste : la promotion est « En cours »')
  await admin.screenshot({ path: `${SHOTS}/71-erp-promotions.png`, fullPage: true })

  // 2. Une cliente sur le site : badge, prix promo, panier, commande
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/produits/spray-hydratant-250-ml')
  await page.getByText(/Promotion jusqu’au/).waitFor()
  const prix = await text(page.locator('main'))
  log(/4 000 F CFA\s*5 000 F CFA\s*−20 %/.test(prix), 'Fiche : 4 000 F, 5 000 F barré, badge −20 %')
  await page.screenshot({ path: `${SHOTS}/72-site-produit-promo.png`, fullPage: true })
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.getByRole('link', { name: 'Voir le panier' }).click()
  await page.getByText(/Promotion −20 % : 4 000/).waitFor()
  const total = await text(page.getByRole('complementary', { name: 'Total' }))
  log(/Promotions\s*−1 000 F CFA/.test(total) && /Total\s*4 000 F CFA/.test(total), 'Panier : « Promotion −20 % », remise −1 000 F, total 4 000 F')
  await page.screenshot({ path: `${SHOTS}/73-site-panier-promo.png`, fullPage: true })
  await page.getByRole('link', { name: 'Valider la commande' }).click()
  await page.getByLabel('Prénom *').fill('Khady')
  await page.getByLabel('Nom *', { exact: true }).fill('Fall')
  await page.getByLabel('Téléphone mobile *').fill('76 444 55 66')
  const consent = page.getByRole('checkbox', { name: /accepte|confidentialité/ })
  if (await consent.count()) await consent.first().check()
  await page.getByRole('button', { name: 'Confirmer la commande' }).click()
  await page.getByRole('heading', { name: 'Commande enregistrée' }).waitFor()
  log((await text(page.locator('main'))).includes('4 000 F CFA'), 'Commande enregistrée à 4 000 F (prix calculé par le serveur)')

  // 3. Le prix initial n'a pas bougé dans l'ERP
  await admin.getByRole('navigation', { name: 'Menu ERP' }).getByRole('link', { name: 'Produits et stock' }).click()
  const row = admin.getByRole('row', { name: /Spray hydratant 250 ml/ })
  log(await row.getByRole('spinbutton').first().inputValue() === '5000', 'ERP : le prix initial du spray reste 5 000 F')

  // 4. Résultats, puis « Arrêter maintenant »
  await admin.getByRole('navigation', { name: 'Menu ERP' }).getByRole('link', { name: 'Promotions' }).click()
  await admin.getByRole('link', { name: 'Résultats de Fêtes de fin d’année' }).click()
  await admin.getByRole('heading', { name: 'Ce que disent les chiffres' }).waitFor()
  log((await text(admin.locator('main'))).includes('Trop tôt pour conclure'), 'Résultats : « trop tôt pour conclure » avant 3 jours de promotion')
  await admin.screenshot({ path: `${SHOTS}/74-erp-resultats-promotion.png`, fullPage: true })
  admin.once('dialog', (d) => d.accept())
  await admin.getByRole('button', { name: 'Arrêter maintenant' }).click()
  await admin.getByRole('button', { name: 'Arrêter maintenant' }).waitFor({ state: 'detached' })
  await page.goto(BASE + '/produits/spray-hydratant-250-ml')
  await page.getByRole('button', { name: 'Ajouter au panier' }).waitFor()
  log(!(await text(page.locator('main'))).includes('−20 %'), 'Promotion arrêtée : le site affiche de nouveau 5 000 F, sans badge')

  log(errors.length === 0, `Console : ${errors.length} erreur(s) JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
