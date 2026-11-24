/**
 * PARCOURS DE BOUT EN BOUT : réserver un twist en 3 touchers depuis l'accueil (maquette validée le 24 novembre 2026).
 * Cliente connectée : créneau → accord → « Réserver ce créneau ». Visiteuse sans compte : même chemin + ses coordonnées.
 * La bannière Twists ouvre la réservation avec « Twist simple » déjà choisi.
 * Utilisation : API Laravel + site lancés (base fraîche), puis
 *   node e2e/parcours-twist-express.cjs ./captures
 */
const { chromium } = require('playwright')
const SHOTS = process.argv[2]
const BASE = 'http://localhost:5173'
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }

;(async () => {
  const browser = await chromium.launch()
  const errors = []

  // 1. Cliente connectée : 3 touchers
  const page = await (await browser.newContext(PHONE)).newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/connexion')
  await page.getByLabel('E-mail ou téléphone').fill('mariama@client.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo-dabo-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/connexion'))
  await page.goto(BASE + '/')
  const express = page.getByRole('region', { name: 'Réserver un twist en 1 clic' })
  const slots = express.getByRole('link', { name: /Réserver le Twist simple/ })
  await slots.first().waitFor({ timeout: 15000 })
  log(await slots.count() === 4, `Accueil : ${await slots.count()} prochains créneaux libres du twist simple`)
  await express.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -140))
  await page.screenshot({ path: `${SHOTS}/93-accueil-twist-express.png` })
  const firstLabel = await slots.first().getAttribute('aria-label')

  let touches = 0
  await slots.first().click(); touches++
  await page.getByRole('heading', { name: 'Confirmer votre rendez-vous' }).waitFor()
  const step = (await page.locator('main').textContent()).replace(/[\u202f\u00a0]/g, ' ')
  log(step.includes('Twist simple · 5 000 F CFA') && step.includes('Avec la première coiffeuse libre') && step.includes('Changer de créneau'), 'Dernière étape directement : prestation, coiffeuse et heure déjà choisies')
  log(step.includes('Mariama') && (await page.getByRole('button', { name: 'Modifier' }).count()) === 1, 'Coordonnées de la cliente connectée : un résumé, avec « Modifier »')
  await page.screenshot({ path: `${SHOTS}/94-twist-express-confirmer.png`, fullPage: true })
  await page.getByRole('checkbox', { name: /J'accepte/ }).check(); touches++
  await page.getByRole('button', { name: 'Réserver ce créneau' }).click(); touches++
  await page.getByRole('heading', { name: 'Demande de rendez-vous envoyée' }).waitFor()
  log(touches === 3, `Réservé en ${touches} touchers depuis l’accueil (${firstLabel})`)

  // 2. « Changer de créneau » ramène au choix de l'heure ; la bannière Twists présélectionne le twist simple
  const guest = await (await browser.newContext(PHONE)).newPage()
  guest.on('pageerror', (e) => errors.push(e.message))
  await guest.goto(BASE + '/')
  const gSlots = guest.getByRole('region', { name: 'Réserver un twist en 1 clic' }).getByRole('link', { name: /Réserver le Twist simple/ })
  await gSlots.first().waitFor({ timeout: 15000 })
  await gSlots.nth(1).click()
  await guest.getByRole('heading', { name: 'Confirmer votre rendez-vous' }).waitFor()
  await guest.getByRole('button', { name: 'Changer de créneau' }).click()
  await guest.getByRole('heading', { name: '3. Date et heure' }).waitFor()
  log(true, '« Changer de créneau » ramène au choix de la date et de l’heure')
  await guest.getByRole('button', { name: 'Continuer' }).waitFor()

  // 3. Visiteuse sans compte : créneau, coordonnées, accord, réserver
  await guest.goto(BASE + '/')
  await gSlots.nth(1).click()
  await guest.getByRole('heading', { name: 'Confirmer votre rendez-vous' }).waitFor()
  await guest.getByLabel('Prénom *').fill('Ndèye')
  await guest.getByLabel('Nom *', { exact: true }).fill('Faye')
  await guest.getByLabel('Téléphone mobile *').fill('78 333 22 11')
  await guest.getByRole('checkbox', { name: /J'accepte/ }).check()
  await guest.getByRole('button', { name: 'Réserver ce créneau' }).click()
  await guest.getByRole('heading', { name: 'Demande de rendez-vous envoyée' }).waitFor()
  log(true, 'Visiteuse sans compte : créneau, coordonnées, accord, réservée')

  // 4. La bannière Twists : « Twist simple » déjà choisi
  await guest.goto(BASE + '/')
  await guest.getByRole('img', { name: /Twists sur vos propres cheveux/ }).click()
  await guest.waitForURL('**/reserver?prestation=twist-simple')
  await guest.getByRole('heading', { name: '1. Choisissez votre prestation' }).waitFor()
  log(await guest.getByRole('button', { name: 'Continuer' }).isEnabled(), 'Bannière Twists : la réservation s’ouvre avec « Twist simple » déjà choisi')

  log(errors.length === 0, `Console : ${errors.length} erreur(s) JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
