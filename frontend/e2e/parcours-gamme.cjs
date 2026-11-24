/**
 * PARCOURS DE BOUT EN BOUT : créer une gamme dans l'ERP (maquette validée le 24 novembre 2026).
 * La gérante compose « Gamme au coco » (3 produits), voit l'économie, la marge et les gammes possibles,
 * ajoute une photo et publie ; une cliente l'achète, et chaque produit sort du stock.
 * Utilisation : API Laravel + site lancés (base fraîche), puis
 *   node e2e/parcours-gamme.cjs ./captures
 */
const path = require('node:path')
const { chromium } = require('playwright')
const SHOTS = process.argv[2]
const BASE = 'http://localhost:5173'
const PHOTO = path.join(__dirname, '..', 'public', 'images', 'publicites', 'gamme-horizontale.webp')
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }
const text = async (locator) => (await locator.textContent()).replace(/[\u202f\u00a0]/g, ' ')

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const admin = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  admin.on('pageerror', (e) => errors.push(e.message))

  await admin.goto(BASE + '/connexion')
  await admin.getByLabel('E-mail ou téléphone').fill('admin@dabohair.test')
  await admin.getByLabel('Mot de passe', { exact: true }).fill('admin-dabo-2026')
  await admin.getByRole('button', { name: 'Se connecter' }).click()
  await admin.waitForURL('**/admin')
  // Stock exact, lu dans l'ERP (la fiche publique ne donne le chiffre que lorsqu'il reste peu)
  const COMPONENTS = ['DAB-SHA-001', 'DAB-SPH-250', 'DAB-SBO-030']
  const stocks = async () => {
    const rows = (await (await admin.request.get(`${BASE}/api/v1/admin/products`, { headers: { Accept: 'application/json', Referer: BASE + '/admin' } })).json()).data
    return COMPONENTS.map((sku) => rows.find((r) => r.sku === sku).stock_quantity)
  }
  await admin.getByRole('navigation', { name: 'Menu ERP' }).getByRole('link', { name: 'Produits et stock' }).click()
  await admin.getByRole('link', { name: 'Nouvelle gamme' }).click()
  await admin.getByRole('heading', { name: 'Nouvelle gamme' }).waitFor()

  // 1. Composition : 3 produits en stock
  await admin.getByRole('textbox', { name: 'Nom de la gamme' }).fill('Gamme au coco')
  const pick = admin.getByLabel('Ajouter un produit')
  await pick.locator('option').nth(1).waitFor({ state: 'attached' })
  for (const name of ['Shampooing sans sulfate', 'Spray hydratant 250 ml', 'Sérum Booster 30 ml']) {
    const value = await pick.locator('option', { hasText: name }).first().getAttribute('value')
    await pick.selectOption(value)
    await admin.getByRole('button', { name: 'Ajouter', exact: true }).click()
  }
  const content = await text(admin.locator('section', { has: admin.getByRole('heading', { name: '2. Ce qu’il y a dedans' }) }))
  log(content.includes('Acheter ces produits un par un : 11 000 F CFA'), 'Composition : 3 produits, 11 000 F achetés un par un')

  // 2. Prix : économie et marge en direct, prix membre
  await admin.getByLabel('Prix de la gamme (F CFA)').fill('9000')
  await admin.getByText(/La cliente économise 2 000 F CFA \(18,2 %\)/).waitFor()
  log(true, 'Prix 9 000 F : « La cliente économise 2 000 F (18,2 %) »')
  await admin.getByLabel('Prix membre (réservé aux clientes avec un compte)').check()
  await admin.getByLabel('Prix membre (F CFA)').fill('7500')
  await admin.getByLabel('Nombre de gammes au prix membre').fill('50')
  const aside = await text(admin.locator('aside').filter({ has: admin.getByRole('heading', { name: 'Combien je peux en vendre' }) }))
  log(/\d+ gammes? possibles? aujourd’hui/.test(aside) && aside.includes('Limité par'), `« Combien je peux en vendre » : ${aside.match(/\d+ gammes? possibles?/)?.[0]}, produit limitant indiqué`)
  log(!(await admin.getByRole('button', { name: 'Publier la gamme' }).isEnabled()), '« Publier la gamme » grisé sans photo')

  // 3. Photo, publication
  await admin.locator('input[type=file]').setInputFiles(PHOTO)
  await admin.getByRole('button', { name: 'Publier la gamme' }).click()
  await admin.getByText('« Gamme au coco » est créée et en vente sur le site.').waitFor({ timeout: 20000 })
  log(true, 'Publiée : retour à la liste, « est créée et en vente sur le site »')
  const row = await text(admin.getByRole('row', { name: /Gamme au coco/ }))
  log(/1 016,67 F/.test(row) && /88,7 %/.test(row), 'Liste : coût de la gamme calculé avec ses produits (400 + 350 + 266,67 = 1 016,67 F) et marge 88,7 %')
  
  await admin.screenshot({ path: `${SHOTS}/90-erp-gamme-publiee.png`, fullPage: true })
  await admin.goto(BASE + '/')
  await admin.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Gammes' }).click()
  await admin.getByRole('region', { name: 'Nos gammes' }).getByRole('link', { name: /Gamme au coco/ }).waitFor()
  log(true, 'Menu Gammes (ordinateur) : ouvert depuis l’en-tête, la gamme publiée y figure')
  await admin.screenshot({ path: `${SHOTS}/92-menu-gammes-ordinateur.png` })

  // 4. Une cliente l'achète sur le site (sans compte : prix normal) ; chaque produit sort du stock
  const before = await stocks()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  page.on('pageerror', (e) => errors.push(e.message))
  // Menu « Gammes » de l'en-tête (maquette validée le 24 novembre 2026) : la nouvelle gamme y apparaît toute seule
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: 'Gammes' }).click()
  const menu = page.getByRole('region', { name: 'Nos gammes' })
  const card = menu.getByRole('link', { name: /Gamme au coco/ })
  await card.waitFor()
  const cardText = await text(card)
  log(cardText.includes('Shampooing sans sulfate · Spray hydratant 250 ml · Sérum Booster 30 ml') && cardText.includes('7 500 F CFA'),
    'Menu Gammes (téléphone) : la nouvelle gamme, son contenu et le prix membre')
  await page.screenshot({ path: `${SHOTS}/91-menu-gammes-telephone.png` })
  const sold = menu.getByRole('link', { name: /Gamme complète Dabo Hair/ })
  log((await text(sold)).includes('Bientôt de retour') && !(await text(sold)).includes('Prix membre'), 'Gamme en rupture : « Bientôt de retour », sans badge « Prix membre »')
  await page.keyboard.press('Escape')
  log(await menu.count() === 0, 'Échap ferme le menu')
  await page.getByRole('button', { name: 'Gammes' }).click()
  await page.getByRole('region', { name: 'Nos gammes' }).getByRole('link', { name: /Gamme au coco/ }).click()
  await page.getByRole('heading', { level: 1, name: 'Gamme au coco' }).waitFor()
  log(await page.getByRole('region', { name: 'Nos gammes' }).count() === 0, 'Un toucher sur la gamme ouvre sa fiche et referme le menu')
  const fiche = await text(page.locator('main'))
  log(fiche.includes('9 000 F CFA') && fiche.includes('7 500 F CFA'), 'Site : la fiche montre 9 000 F et le prix membre 7 500 F')
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.goto(BASE + '/commande')
  await page.getByLabel('Prénom *').fill('Aïda')
  await page.getByLabel('Nom *', { exact: true }).fill('Sow')
  await page.getByLabel('Téléphone mobile *').fill('77 555 66 77')
  await page.getByRole('checkbox', { name: /accepte/ }).check()
  await page.getByRole('button', { name: 'Confirmer la commande' }).click()
  await page.getByRole('heading', { name: 'Commande enregistrée' }).waitFor()
  log((await text(page.locator('main'))).includes('9 000 F CFA'), 'Commande enregistrée à 9 000 F')
  const after = await stocks()
  log(before.every((b, i) => after[i] === b - 1), `Chaque produit de la gamme est sorti du stock (${before.join(', ')} → ${after.join(', ')})`)

  log(errors.length === 0, `Console : ${errors.length} erreur(s) JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
