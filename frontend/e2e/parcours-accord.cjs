/**
 * PARCOURS DE BOUT EN BOUT : accord pour les nouveautés et offres par e-mail (maquette validée le 28 novembre 2026).
 * 1. Inscription : la case est distincte, non cochée, facultative ; cochée → « accepté » dans l'espace client.
 * 2. Espace client : « Les messages que je reçois » ; retirer l'accord, couper les rappels.
 * 3. Commande sans compte : la case reste décochée, la commande passe quand même.
 * 4. ERP, caisse : colonne « Offres par e-mail » sans les montants ; accord noté au salon avec son nom.
 * 5. Lien de désinscription falsifié : refusé.
 * Utilisation : API Laravel + site lancés (base fraîche), puis
 *   node e2e/parcours-accord.cjs ./captures
 */
const { chromium } = require('playwright')
const SHOTS = process.argv[2]
const BASE = 'http://localhost:5173'
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
const MARKETING = /nouveautés et offres de Dabo Hair/

async function login(page, email, pw) {
  await page.goto(BASE + '/connexion')
  await page.getByLabel('E-mail ou téléphone').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(pw)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/connexion'))
}

;(async () => {
  const browser = await chromium.launch()
  const errors = []

  // 1. Inscription avec la case cochée
  const page = await (await browser.newContext(PHONE)).newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/inscription')
  const box = page.getByRole('checkbox', { name: MARKETING })
  await box.waitFor()
  log(!(await box.isChecked()) && await page.getByRole('checkbox', { name: /politique de confidentialité/ }).count() === 1, 'Inscription : case des offres distincte de la confidentialité, non cochée')
  await page.getByLabel('Prénom').fill('Coumba')
  await page.getByLabel('Téléphone mobile').fill('+221 76 555 44 33') // avec l'indicatif : un seul format en base
  await page.getByLabel('Mot de passe', { exact: true }).fill('Lancement-2026')
  await page.getByLabel('Confirmer le mot de passe').fill('Lancement-2026')
  await page.getByRole('checkbox', { name: /politique de confidentialité/ }).check()
  await box.check()
  await page.screenshot({ path: `${SHOTS}/100-accord-inscription.png`, fullPage: true })
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/inscription'))

  // 2. Espace client
  await page.goto(BASE + '/compte/profil')
  const offers = page.getByRole('switch', { name: /Nouveautés et offres/ })
  await offers.waitFor()
  const status = page.getByRole('status').filter({ hasText: '« Nouveautés et offres »' })
  log(await offers.getAttribute('aria-checked') === 'true' && /accepté le .+ \(inscription sur le site\)/.test(await status.textContent()), 'Espace client : « Nouveautés et offres » activé, preuve « inscription sur le site »')
  await page.screenshot({ path: `${SHOTS}/101-accord-espace-client.png`, fullPage: true })
  await offers.click()
  await page.getByText(/« Nouveautés et offres » refusé le/).waitFor()
  const reminders = page.getByRole('switch', { name: /Rappels de resserrage/ })
  await reminders.click()
  await page.waitForFunction(() => document.querySelector('[role=switch]')?.getAttribute('aria-checked') === 'false')
  log(await offers.getAttribute('aria-checked') === 'false' && await reminders.getAttribute('aria-checked') === 'false', 'Espace client : offres retirées et rappels coupés en un toucher')
  await page.reload()
  await offers.waitFor()
  log(await offers.getAttribute('aria-checked') === 'false' && await reminders.getAttribute('aria-checked') === 'false', 'Après rechargement : les choix sont bien enregistrés')

  // 3. Commande sans compte, case laissée décochée
  const guest = await (await browser.newContext(PHONE)).newPage()
  guest.on('pageerror', (e) => errors.push(e.message))
  await guest.goto(BASE + '/produits/spray-hydratant-250-ml')
  await guest.getByRole('button', { name: 'Ajouter au panier' }).click()
  await guest.goto(BASE + '/commande')
  await guest.getByLabel('Prénom *').fill('Ndèye')
  await guest.getByLabel('Nom *', { exact: true }).fill('Faye')
  await guest.getByLabel('Téléphone mobile *').fill('77 990 11 22')
  await guest.getByRole('checkbox', { name: /accepte les conditions de vente/ }).check()
  log(!(await guest.getByRole('checkbox', { name: MARKETING }).isChecked()), 'Commande : case des offres présente et décochée')
  await guest.getByRole('button', { name: 'Confirmer la commande' }).click()
  await guest.getByRole('heading', { name: 'Commande enregistrée' }).waitFor()
  log(true, 'Commande enregistrée SANS accepter les offres (case facultative)')

  // 4. ERP, caisse
  const admin = await (await browser.newContext()).newPage()
  await login(admin, 'admin@dabohair.test', 'admin-dabo-2026')
  const xsrf = decodeURIComponent((await admin.context().cookies()).find((c) => c.name === 'XSRF-TOKEN').value)
  await admin.request.post(`${BASE}/api/v1/admin/users`, { headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf, Referer: BASE + '/admin' },
    data: { first_name: 'Khady', last_name: 'Caisse', email: 'caisse-accord@dabohair.test', phone: null, role: 'cashier', password: 'caisse2026dabo' } })
  await admin.goto(BASE + '/admin/clients')
  await admin.getByRole('columnheader', { name: 'Offres par e-mail' }).waitFor()
  log(await admin.getByRole('columnheader', { name: 'Dépensé' }).count() === 1, 'Gérante : colonnes « Offres par e-mail » et « Dépensé »')

  const cashier = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  cashier.on('pageerror', (e) => errors.push(e.message))
  await login(cashier, 'caisse-accord@dabohair.test', 'caisse2026dabo')
  await cashier.goto(BASE + '/admin/clients')
  await cashier.getByRole('columnheader', { name: 'Offres par e-mail' }).waitFor()
  log(await cashier.getByRole('columnheader', { name: 'Dépensé' }).count() === 0 && !(await cashier.locator('main').textContent()).includes('Dépensé'), 'Caisse : la liste des clientes SANS les montants dépensés')
  const row = cashier.getByRole('row').filter({ hasText: 'Ndèye Faye' })
  await row.getByRole('button', { name: /Noter son accord donné au salon/ }).click()
  await cashier.getByRole('heading', { name: 'Noter l’accord de Ndèye Faye, donné au salon' }).waitFor()
  await cashier.screenshot({ path: `${SHOTS}/102-accord-erp-caisse.png`, fullPage: true })
  await cashier.getByRole('button', { name: 'Elle accepte les offres par e-mail' }).click()
  await row.getByText('au salon (Khady)').waitFor()
  log((await row.textContent()).includes('Accepte'), 'Caisse : accord noté « au salon (Khady) », avec la date')
  await cashier.getByRole('button', { name: /Acceptent les offres \(1\)/ }).click()
  await cashier.waitForURL('**/admin/clients?marketing=1')
  // La liste précédente reste affichée pendant le chargement : on attend qu'elle soit remplacée (une seule ligne)
  const filtered = await cashier.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1, null, { timeout: 10000 }).then(() => true, () => false)
  log(filtered && await cashier.getByRole('row').filter({ hasText: 'Ndèye Faye' }).count() === 1 && await cashier.getByRole('row').filter({ hasText: 'Coumba' }).count() === 0, 'Filtre « Acceptent les offres (1) » : seulement Ndèye (Coumba a retiré son accord)')

  // 5. Lien de désinscription falsifié
  await guest.goto(BASE + '/offres/desinscription/1?signature=faux')
  await guest.getByRole('button', { name: 'Ne plus recevoir les offres' }).click()
  await guest.getByText('Ce lien n’est pas valide').waitFor()
  log(true, 'Lien de désinscription falsifié : « Ce lien n’est pas valide »')

  log(errors.length === 0, `Console : ${errors.length} erreur(s) JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
