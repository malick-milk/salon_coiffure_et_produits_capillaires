/**
 * PARCOURS DE BOUT EN BOUT : tarifs de livraison gérés dans l'ERP (maquette validée le 21 novembre 2026).
 * La gérante change les frais d'une zone, son délai, et active la livraison offerte ; une cliente le voit
 * au panier et à la commande, et le serveur facture les bons frais.
 * Utilisation : API Laravel + site lancés (base fraîche), puis
 *   node e2e/parcours-livraison.cjs ./captures
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
  const admin = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  admin.on('pageerror', (e) => errors.push(e.message))

  // 1. La gérante règle les tarifs
  await admin.goto(BASE + '/connexion')
  await admin.getByLabel('E-mail ou téléphone').fill('admin@dabohair.test')
  await admin.getByLabel('Mot de passe', { exact: true }).fill('admin-dabo-2026')
  await admin.getByRole('button', { name: 'Se connecter' }).click()
  await admin.waitForURL('**/admin')
  await admin.getByRole('navigation', { name: 'Menu ERP' }).getByRole('link', { name: 'Livraison' }).click()
  await admin.getByLabel('Frais pour Dakar Plateau').fill('500')
  await admin.getByLabel('Délai pour Dakar Plateau').fill('Le jour même')
  await admin.getByLabel('Proposer Rufisque sur le site').uncheck()
  await admin.getByRole('checkbox', { name: 'Non' }).check() // livraison offerte
  await admin.getByLabel('à partir de').fill('10000')
  await admin.getByRole('button', { name: 'Enregistrer les modifications' }).click()
  await admin.getByText('Tarifs enregistrés. Ils valent pour les nouvelles commandes.').waitFor()
  await admin.getByText(/livraison offerte : 10\s000/).waitFor() // l'historique se recharge après l'enregistrement
  const histo = await text(admin.locator('section', { has: admin.getByRole('heading', { name: 'Dernières modifications' }) }))
  log(/Dakar Plateau : 1 000 F CFA → 500 F CFA/.test(histo) && histo.includes('Rufisque cachée') && /livraison offerte : 10 000 F CFA/.test(histo), 'ERP : frais, zone cachée et livraison offerte notés dans « Dernières modifications »')
  await admin.screenshot({ path: `${SHOTS}/80-erp-livraison.png`, fullPage: true })

  // 2. Une cliente : panier (1 spray = 5 000 F) puis commande livrée
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/produits/spray-hydratant-250-ml')
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.goto(BASE + '/panier')
  await page.getByText(/Plus que 5 000 F CFA pour la livraison offerte/).waitFor()
  log(true, 'Panier : « Plus que 5 000 F pour la livraison offerte »')
  await page.getByRole('link', { name: 'Valider la commande' }).click()
  await page.getByRole('radio', { name: /Livraison/ }).check()
  const options = await page.getByLabel('Zone de livraison *').locator('option').allTextContents()
  log(!options.some((o) => o.includes('Rufisque')) && options.some((o) => /Dakar Plateau — 500 F CFA/.test(o.replace(/[\u202f\u00a0]/g, ' '))), `Commande : Rufisque cachée, Dakar Plateau à 500 F (${options.join(' | ')})`)
  await page.getByLabel('Zone de livraison *').selectOption({ label: options.find((o) => o.includes('Dakar Plateau')) })
  await page.getByText('Délai annoncé : Le jour même').waitFor()
  log(true, 'Commande : « Délai annoncé : Le jour même » sous la zone')
  await page.screenshot({ path: `${SHOTS}/81-site-commande-livraison.png`, fullPage: true })

  // 3. Deux sprays : 10 000 F, la livraison devient offerte ; le serveur facture 0 F
  await page.goto(BASE + '/panier')
  await page.getByRole('button', { name: 'Augmenter' }).click()
  await page.getByRole('link', { name: 'Valider la commande' }).click()
  await page.getByRole('radio', { name: /Livraison/ }).check()
  await page.getByLabel('Zone de livraison *').selectOption({ label: options.find((o) => o.includes('Dakar Plateau')) })
  // Bug du 24 novembre 2026 : bouton pressé avec des champs vides → le curseur doit aller au 1er champ en erreur (Prénom), pas en bas
  await page.getByRole('button', { name: 'Confirmer la commande' }).click()
  await page.waitForFunction(() => document.activeElement?.labels?.[0]?.textContent?.startsWith('Prénom'), null, { timeout: 5000 }).then(() => log(true, 'Commande incomplète : le curseur va sur « Prénom », le 1er champ en erreur'), () => log(false, 'Commande incomplète : le curseur ne va pas sur « Prénom »'))
  // Maquette du 24 novembre 2026 : « Il manque … » près du bouton, chaque ligne amène sur le champ
  const recapBox = page.getByRole('group', { name: /Il manque \d+ informations?/ })
  await recapBox.waitFor()
  log(/Votre nom/.test(await recapBox.textContent()), `Près du bouton : « ${(await recapBox.locator('strong').textContent()).trim()} », avec « Votre nom »`)
  await recapBox.getByRole('link', { name: 'Votre nom' }).click()
  await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'last_name', null, { timeout: 5000 }).then(() => log(true, '« Votre nom » amène sur le champ Nom'), () => log(false, '« Votre nom » n’amène pas sur le champ Nom'))
  await page.getByLabel('Prénom *').fill('Khady')
  await page.getByLabel('Nom *', { exact: true }).fill('Fall')
  await page.getByLabel('Téléphone mobile *').fill('76 444 55 66')
  await page.getByLabel('Ville *').fill('Dakar')
  await page.getByLabel('Adresse *').fill('Rue 10')
  const recap = await text(page.getByRole('complementary', { name: 'Récapitulatif de la commande' }))
  log(/Livraison\s*Offerte/.test(recap) && /Total\s*10 000 F CFA/.test(recap), 'Commande : 2 sprays (10 000 F), livraison « Offerte »')
  const consent = page.getByRole('checkbox', { name: /accepte|confidentialité/ })
  if (await consent.count()) await consent.first().check()
  log(await page.getByRole('group', { name: /Il manque/ }).waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false), 'Tout rempli : l’encadré « Il manque » disparaît')
  await page.getByRole('button', { name: 'Confirmer la commande' }).click()
  await page.getByRole('heading', { name: 'Commande enregistrée' }).waitFor()
  log((await text(page.locator('main'))).includes('10 000 F CFA'), 'Commande enregistrée à 10 000 F, livraison comprise (serveur)')

  log(errors.length === 0, `Console : ${errors.length} erreur(s) JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
