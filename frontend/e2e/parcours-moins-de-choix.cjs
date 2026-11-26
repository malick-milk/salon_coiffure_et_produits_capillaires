/**
 * PARCOURS DE BOUT EN BOUT : « moins de choix, plus de ventes » et pages légales (maquettes validées le 25 novembre 2026).
 * 1. La gérante publie « Gamme au coco » (via l'API de l'ERP, photo comprise).
 * 2. Fiche du spray : « Mieux en routine » propose la gamme ; « Prendre la gamme » la met au panier.
 * 3. Accueil : « Quelle gamme pour moi ? » → Pour moi → Longueur et volume → la Gamme au coco, au panier.
 * 4. Mes commandes : « Racheter la même chose » remplit le panier.
 * 5. Pages légales : liens du pied de page et de la case « J'accepte », cases à compléter surlignées.
 * Utilisation : API Laravel + site lancés (base fraîche), puis
 *   node e2e/parcours-moins-de-choix.cjs ./captures
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const SHOTS = process.argv[2]
const BASE = 'http://localhost:5173'
const PHOTO = path.join(__dirname, '..', 'public', 'images', 'publicites', 'gamme-horizontale.webp')
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
const text = async (l) => (await l.textContent()).replace(/[\u202f\u00a0]/g, ' ')

async function login(page, email, pw) {
  await page.goto(BASE + '/connexion')
  await page.getByLabel('E-mail ou téléphone').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(pw)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/connexion'))
}
const cartNames = async (page) => (await page.getByRole('list', { name: 'Articles du panier' }).textContent()) ?? ''

;(async () => {
  const browser = await chromium.launch()
  const errors = []

  // 1. La gérante publie « Gamme au coco » (shampooing, spray, sérum Booster : 11 000 F séparément)
  const admin = await (await browser.newContext()).newPage()
  await login(admin, 'admin@dabohair.test', 'admin-dabo-2026')
  const xsrf = decodeURIComponent((await admin.context().cookies()).find((c) => c.name === 'XSRF-TOKEN').value)
  const H = { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf, Referer: BASE + '/admin' }
  const rows = (await (await admin.request.get(`${BASE}/api/v1/admin/products`, { headers: H })).json()).data
  const id = (sku) => rows.find((r) => r.sku === sku).id
  const created = await admin.request.post(`${BASE}/api/v1/admin/bundles`, { headers: H, data: {
    name: 'Gamme au coco', price: 9000, short_description: 'Longueur et volume',
    items: ['DAB-SHA-001', 'DAB-SPH-250', 'DAB-SBO-030'].map((s) => ({ product_id: id(s), quantity: 1 })),
  } })
  const bundleId = (await created.json()).data.id
  await admin.request.post(`${BASE}/api/v1/admin/products/${bundleId}/images`, { headers: H, multipart: { image: { name: 'gamme.webp', mimeType: 'image/webp', buffer: fs.readFileSync(PHOTO) } } })
  const published = await admin.request.patch(`${BASE}/api/v1/admin/products/${bundleId}`, { headers: H, data: { is_active: true } })
  log(created.status() === 201 && published.ok(), 'ERP : « Gamme au coco » créée et publiée')

  // 2. Fiche du spray : la gamme qui le contient, avec l'économie
  const page = await (await browser.newContext(PHONE)).newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/produits/spray-hydratant-250-ml')
  const offer = page.getByRole('region', { name: /Spray hydratant est dans la Gamme au coco/ })
  await offer.waitFor()
  const offerText = await text(offer)
  log(offerText.includes('9 000 F CFA au lieu de 11 000 F CFA') && offerText.includes('2 000 F CFA d’économie'), 'Fiche du spray : « Mieux en routine », 9 000 F au lieu de 11 000 F, 2 000 F d’économie')
  log(await page.getByRole('button', { name: 'Ajouter ce produit seul' }).count() === 1, 'Le produit seul passe au second plan (« Ajouter ce produit seul »)')
  await page.screenshot({ path: `${SHOTS}/95-fiche-mieux-en-routine.png`, fullPage: true })
  await offer.getByRole('button', { name: 'Prendre la gamme' }).click()
  await page.waitForURL('**/panier')
  log((await cartNames(page)).includes('Gamme au coco'), '« Prendre la gamme » : la gamme est au panier')

  // 3. Accueil : « Quelle gamme pour moi ? »
  const home = await (await browser.newContext(PHONE)).newPage()
  home.on('pageerror', (e) => errors.push(e.message))
  await home.goto(BASE + '/')
  const quiz = home.getByRole('region', { name: 'Quelle gamme pour moi ?' })
  await quiz.waitFor()
  log(await quiz.getByRole('button', { name: 'Mon enfant' }).count() === 0, 'Questionnaire : « Mon enfant » masqué (la gamme enfants n’existe pas encore)')
  await quiz.getByRole('button', { name: 'Pour moi' }).click()
  await quiz.getByRole('button', { name: 'Longueur et volume' }).click()
  log((await text(quiz)).includes('Votre gamme') && (await text(quiz)).includes('Gamme au coco'), 'Pour moi + Longueur et volume → UNE gamme : la Gamme au coco')
  await quiz.scrollIntoViewIfNeeded()
  await home.screenshot({ path: `${SHOTS}/96-quelle-gamme-pour-moi.png` })
  await quiz.getByRole('button', { name: 'Ajouter au panier' }).click()
  await home.waitForURL('**/panier')
  log((await cartNames(home)).includes('Gamme au coco'), 'Questionnaire : la gamme proposée est au panier')

  // 4. Racheter la même chose (Mariama a une commande livrée dans les données de démonstration)
  const client = await (await browser.newContext(PHONE)).newPage()
  client.on('pageerror', (e) => errors.push(e.message))
  await login(client, 'mariama@client.test', 'demo-dabo-2026')
  await client.goto(BASE + '/compte/commandes')
  const again = client.getByRole('button', { name: 'Racheter la même chose' }).first()
  await again.waitFor()
  await again.click()
  await client.waitForURL('**/panier')
  const notice = await text(client.getByRole('status').filter({ hasText: 'est dans le panier' }))
  log(/Votre commande CMD-2026-\d{6} est dans le panier, aux prix du jour/.test(notice) && (await cartNames(client)).length > 0, 'Racheter : la commande est dans le panier, aux prix du jour')

  // 5. Pages légales
  await client.goto(BASE + '/')
  await client.getByRole('navigation', { name: 'Informations légales' }).getByRole('link', { name: 'Conditions de vente' }).click()
  await client.getByRole('heading', { level: 1, name: 'Conditions de vente' }).waitFor()
  const marks = await client.locator('mark').count()
  log(marks > 0, `Conditions de vente : ${marks} case(s) « À COMPLÉTER » surlignée(s) en jaune`)
  await client.getByRole('link', { name: 'Mentions légales' }).first().click()
  await client.getByRole('heading', { level: 1, name: 'Mentions légales' }).waitFor()
  log((await text(client.locator('main'))).includes('OVHcloud'), 'Mentions légales : éditeur et hébergeur')
  await client.screenshot({ path: `${SHOTS}/97-mentions-legales.png`, fullPage: true })
  // Inscription : une VISITEUSE (une cliente connectée est renvoyée vers son compte, plus ou moins vite :
  // le test lisait parfois le lien avant la redirection, parfois après — échec aléatoire en CI le 26 novembre 2026)
  const visitor = await (await browser.newContext(PHONE)).newPage()
  visitor.on('pageerror', (e) => errors.push(e.message))
  await visitor.goto(BASE + '/inscription')
  const consentLink = visitor.getByRole('link', { name: 'politique de confidentialité' })
  log(await consentLink.getAttribute('href') === '/confidentialite' && await consentLink.getAttribute('target') === '_blank', 'Inscription : la case « J’accepte » mène à la politique de confidentialité (nouvel onglet)')

  log(errors.length === 0, `Console : ${errors.length} erreur(s) JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
