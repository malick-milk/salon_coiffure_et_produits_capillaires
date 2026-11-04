/**
 * PARCOURS DE BOUT EN BOUT de la vitrine, dans un vrai navigateur (Chromium).
 * Vérifie 24 comportements (catalogue, variantes, panier, réservation, mobile) et prend des captures.
 *
 * Utilisation (le serveur de développement doit tourner avec VITE_ENABLE_MOCKS=true) :
 *   npm install -D playwright && npx playwright install chromium
 *   node e2e/parcours-vitrine.cjs ./captures
 * Ce script deviendra une vraie suite @playwright/test à l'étape 9 (Tests).
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
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))

  // 1. Accueil
  await page.goto(BASE + '/')
  await page.getByRole('heading', { name: 'Produits phares' }).waitFor()
  await page.locator('article').first().waitFor()
  log((await page.locator('#prestations article').count()) === 3, 'Accueil : 3 prestations affichées')
  log((await page.title()).includes('Dabo Hair'), `Accueil : titre de page = "${await page.title()}"`)
  await page.screenshot({ path: `${SHOTS}/01-accueil.png`, fullPage: true })

  // 2. Catalogue + filtre dans l'URL
  await page.goto(BASE + '/boutique')
  await page.getByText('9 produits').waitFor()
  log(true, 'Catalogue : 9 produits')
  await page.getByRole('complementary', { name: 'Filtres' }).getByRole('button', { name: /Sérums/ }).click()
  await page.getByText('3 produits').waitFor()
  log(page.url().includes('category=serums'), `Catalogue : filtre Sérums dans l'URL (${page.url().replace(BASE, '')})`)
  await page.screenshot({ path: `${SHOTS}/02-catalogue-serums.png`, fullPage: true })
  await page.fill('#catalog-search', 'creme')
  await page.press('#catalog-search', 'Enter')
  await page.getByText('Aucun produit ne correspond').waitFor()
  log(true, 'Catalogue : recherche « creme » dans Sérums = aucun résultat (filtres combinés)')
  await page.getByRole('button', { name: 'Tout effacer' }).click()
  await page.getByText('9 produits').waitFor() // attendre la fin de la réinitialisation
  await page.fill('#catalog-search', 'creme')
  await page.press('#catalog-search', 'Enter')
  await page.getByText('1 produit', { exact: true }).waitFor()
  log(true, 'Catalogue : recherche insensible aux accents (« creme » trouve « Crème »)')

  // 3. Fiche produit + variantes + panier
  await page.goto(BASE + '/produits/serum-activ-pousse-30-ml')
  await page.getByRole('heading', { level: 1, name: 'Sérum Activ’Pousse' }).waitFor()
  await page.getByRole('link', { name: /15 ml/ }).click()
  await page.waitForURL('**/serum-activ-pousse-15-ml')
  await page.getByText('1 500 F CFA').first().waitFor()
  log(true, 'Fiche produit : passage à la variante 15 ml (1 500 F CFA)')
  await page.getByRole('button', { name: 'Augmenter la quantité' }).click()
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.getByRole('button', { name: 'Ajouté au panier' }).waitFor()
  log((await page.getByRole('link', { name: /Panier, 2 articles/ }).count()) === 1, 'Panier : compteur = 2 après ajout de 2 unités')
  await page.screenshot({ path: `${SHOTS}/03-fiche-produit.png`, fullPage: true })
  await page.goto(BASE + '/produits/produit-inexistant')
  await page.getByText('Cette page n\'existe pas').waitFor()
  log(true, 'Fiche produit : un produit inexistant affiche la page 404')

  // 4. Panier persistant (localStorage) après rechargement
  await page.goto(BASE + '/panier')
  await page.reload()
  await page.getByText('3 000 F CFA', { exact: true }).first().waitFor()
  log(true, 'Panier : conservé après rechargement, total 2 x 1 500 = 3 000 F CFA')
  await page.screenshot({ path: `${SHOTS}/04-panier.png`, fullPage: true })

  // 5. Réservation complète
  await page.goto(BASE + '/reserver')
  await page.getByRole('button', { name: /Nattes collées/ }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByRole('button', { name: /Fatou/ }).waitFor()
  log((await page.getByRole('button', { name: /Bineta/ }).count()) === 0, 'Réservation : Bineta absente pour « Nattes collées »')
  await page.getByRole('button', { name: /Fatou/ }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()
  // Premier lundi disponible du mois suivant (toujours dans l'horizon de 60 jours)
  await page.getByRole('button', { name: 'Mois suivant' }).click()
  const monday = page.getByRole('button', { name: /^lundi \d+/ }).first()
  const mondayLabel = await monday.getAttribute('aria-label')
  await monday.click()
  await page.getByRole('button', { name: /^\d\d:\d\d$/ }).first().waitFor()
  const slotTimes = await page.getByRole('button', { name: /^\d\d:\d\d(, indisponible)?$/ }).allTextContents()
  log(!slotTimes.includes('12:00') && !slotTimes.includes('13:00'), `Réservation : ${mondayLabel} — pas de créneau 12:00/13:00 pour 1 h 30 (pause) → ${slotTimes.join(' ')}`)
  const sundayDisabled = await page.getByRole('button', { name: /^dimanche .*fermé/ }).first().isDisabled()
  log(sundayDisabled, 'Réservation : dimanches désactivés')
  await page.getByRole('button', { name: '14:00', exact: true }).click()
  await page.screenshot({ path: `${SHOTS}/05-reservation-creneaux.png`, fullPage: true })
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Validation côté client : envoi d'un formulaire invalide
  await page.getByRole('button', { name: 'Envoyer la demande' }).click()
  await page.getByText('Indiquez votre prénom.').waitFor()
  log((await page.getByRole('alert').count()) >= 3, `Réservation : erreurs affichées sous les champs (${await page.getByRole('alert').count()} alertes)`)
  await page.screenshot({ path: `${SHOTS}/06-reservation-erreurs.png`, fullPage: true })
  await page.getByLabel('Prénom *').fill('Mariama')
  await page.getByLabel('Nom *', { exact: true }).fill('Sow')
  await page.getByLabel('Téléphone mobile *').fill('77 123 45 67')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Envoyer la demande' }).click()
  await page.getByText('Demande de rendez-vous envoyée').waitFor()
  const ref = await page.getByText(/RDV-2026-\d{6}/).textContent()
  log(/RDV-2026-000011/.test(ref), `Réservation : confirmée avec le code ${ref}`)
  await page.screenshot({ path: `${SHOTS}/07-reservation-confirmee.png`, fullPage: true })

  // Le créneau réservé n'est plus disponible
  await page.getByRole('button', { name: 'Nouvelle réservation' }).click()
  await page.getByRole('button', { name: /Nattes collées/ }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByRole('button', { name: /Fatou/ }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByRole('button', { name: 'Mois suivant' }).click()
  await page.getByRole('button', { name: mondayLabel }).click()
  await page.getByRole('button', { name: /^14:00/ }).waitFor()
  log(await page.getByRole('button', { name: /^14:00/ }).isDisabled(), 'Réservation : le créneau 14:00 réservé est désormais indisponible')

  // 6. Mobile
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  mobile.on('pageerror', (e) => errors.push(e.message))
  await mobile.goto(BASE + '/')
  await mobile.locator('article').first().waitFor()
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  log(!overflow, 'Mobile 390 px : aucun défilement horizontal')
  log(await mobile.getByRole('navigation', { name: 'Navigation mobile' }).isVisible(), 'Mobile : barre de navigation du bas visible')
  await mobile.screenshot({ path: `${SHOTS}/08-mobile-accueil.png`, fullPage: true })
  await mobile.goto(BASE + '/reserver')
  await mobile.getByRole('button', { name: /Tresses africaines/ }).click()
  const mOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  log(!mOverflow, 'Mobile 390 px : tunnel de réservation sans défilement horizontal')
  await mobile.screenshot({ path: `${SHOTS}/09-mobile-reservation.png`, fullPage: true })
  for (const path of ['/boutique', '/produits/spray-hydratant-250-ml', '/panier']) {
    await mobile.goto(BASE + path)
    await mobile.waitForLoadState('networkidle')
    const o = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    log(!o, `Mobile 390 px : ${path} sans défilement horizontal`)
  }

  // Une seule 404 est ATTENDUE : celle du test « produit inexistant »
  const expected404 = errors.filter((e) => e.includes('404')).length
  log(expected404 === 1, `Console : ${expected404} réponse 404 (1 attendue, aucune nouvelle tentative)`)
  // 401 attendus : GET /auth/me répond « non authentifié » pour un visiteur (comportement standard de Sanctum)
  const real = errors.filter((e) => !e.includes('Download the React DevTools') && !e.includes('404') && !e.includes('401'))
  log(real.length === 0, `Console : ${real.length} erreur(s) JavaScript${real.length ? ' → ' + real.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message); process.exit(1) })
