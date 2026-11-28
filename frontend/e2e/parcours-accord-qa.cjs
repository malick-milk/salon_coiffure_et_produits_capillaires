/**
 * PARCOURS QA (28 novembre 2026) : défauts trouvés sur l'accord pour les offres, à corriger.
 * Ce parcours ÉCHOUE tant que les corrections ne sont pas faites (voir docs/qa/2026-11-28-accord-offres.md).
 * 1. ERP Clients sur téléphone (caisse) : la page ne doit pas être plus large que l'écran
 *    (le <span class="sr-only"> du bouton « Noter son accord » sortait du tableau défilant).
 * 2. « Noter son accord donné au salon » : zone de toucher de 44 px au moins.
 * 3. Double clic sur « Elle accepte » : pas de message d'erreur, le panneau se ferme.
 * 4. Espace client : après un appui sur Espace, le focus reste sur l'interrupteur.
 * 5. Commande sur téléphone (panier rempli) : pas de défilement horizontal (libellé de la case obligatoire).
 * Utilisation : API Laravel + site lancés (base fraîche), puis
 *   node e2e/parcours-accord-qa.cjs ./captures
 */
const { chromium } = require('playwright')
const SHOTS = process.argv[2]
const BASE = 'http://localhost:5173'
const WIDTH = 390
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }
const PHONE = { viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true }
// Avec isMobile, le navigateur élargit la fenêtre au contenu : on compare donc à 390, pas à window.innerWidth
const pageWidth = (page) => page.evaluate(() => document.documentElement.scrollWidth)

async function login(page, email, pw) {
  await page.goto(BASE + '/connexion')
  await page.getByLabel('E-mail ou téléphone').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(pw)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/connexion'))
}
async function step(name, fn) {
  try { await fn() } catch (e) { log(false, `${name} : exception ${e.message.split('\n')[0]}`) }
}

;(async () => {
  const browser = await chromium.launch()
  const errors = []

  // Caisse créée par la gérante
  const admin = await (await browser.newContext()).newPage()
  await login(admin, 'admin@dabohair.test', 'admin-dabo-2026')
  const xsrf = decodeURIComponent((await admin.context().cookies()).find((c) => c.name === 'XSRF-TOKEN').value)
  await admin.request.post(`${BASE}/api/v1/admin/users`, { headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf, Referer: BASE + '/admin' },
    data: { first_name: 'Khady', last_name: 'Caisse', email: 'caisse-qa@dabohair.test', phone: null, role: 'cashier', password: 'caisse2026dabo' } })

  await step('ERP Clients téléphone', async () => {
    const cash = await (await browser.newContext(PHONE)).newPage()
    cash.on('pageerror', (e) => errors.push(e.message))
    await login(cash, 'caisse-qa@dabohair.test', 'caisse2026dabo')
    await cash.goto(BASE + '/admin/clients')
    await cash.getByRole('columnheader', { name: 'Offres par e-mail' }).waitFor()
    const w = await pageWidth(cash)
    await cash.screenshot({ path: `${SHOTS}/200-qa-erp-clients-390.png`, fullPage: true })
    log(w <= WIDTH, `ERP Clients (caisse, 390 px) : page de ${w} px, pas plus large que l’écran`)
    const btn = cash.getByRole('button', { name: /Noter son accord donné au salon/ }).first()
    const b = await btn.boundingBox()
    log(b && b.height >= 44, `« Noter son accord donné au salon » : ${b ? Math.round(b.height) : '?'} px de haut (44 au moins)`)
  })

  await step('Double clic « Elle accepte »', async () => {
    const cash = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    cash.on('pageerror', (e) => errors.push(e.message))
    await login(cash, 'caisse-qa@dabohair.test', 'caisse2026dabo')
    await cash.goto(BASE + '/admin/clients')
    const row = cash.getByRole('row').filter({ hasText: 'Mariama Sow' }) // cliente avec e-mail : « Noter son accord » n'est proposé qu'aux clientes joignables par e-mail
    await row.getByRole('button', { name: /Noter son accord donné au salon/ }).click()
    await cash.getByRole('button', { name: 'Elle accepte les offres par e-mail' }).dblclick()
    await row.getByText(/au salon \(Khady\)/).waitFor()
    await cash.waitForTimeout(1000)
    await cash.screenshot({ path: `${SHOTS}/201-qa-double-clic.png` })
    const shownError = await cash.getByText('Cette cliente a déjà accepté les offres.').count()
    const panelOpen = await cash.getByRole('heading', { name: /Noter l’accord de/ }).count()
    log(shownError === 0 && panelOpen === 0, `Double clic « Elle accepte » : accord noté, sans message d’erreur (${shownError}) et panneau fermé (${panelOpen ? 'ouvert' : 'fermé'})`)
  })

  await step('Interrupteur au clavier', async () => {
    const page = await (await browser.newContext(PHONE)).newPage()
    page.on('pageerror', (e) => errors.push(e.message))
    await login(page, 'mariama@client.test', 'demo-dabo-2026')
    await page.goto(BASE + '/compte/profil')
    const sw = page.getByRole('switch', { name: /Nouveautés et offres/ })
    await sw.waitFor()
    await sw.focus()
    await page.keyboard.press('Space')
    await page.waitForFunction(() => [...document.querySelectorAll('[role=switch]')].find((e) => e.textContent.includes('Nouveautés'))?.getAttribute('aria-checked') === 'true')
    await page.waitForTimeout(500)
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'switch' && document.activeElement.textContent.includes('Nouveautés'))
    log(focused, 'Espace client : après Espace, le focus reste sur l’interrupteur « Nouveautés et offres »')
  })

  await step('Commande téléphone', async () => {
    const guest = await (await browser.newContext(PHONE)).newPage()
    guest.on('pageerror', (e) => errors.push(e.message))
    await guest.goto(BASE + '/produits/spray-hydratant-250-ml')
    await guest.getByRole('button', { name: 'Ajouter au panier' }).click()
    await guest.goto(BASE + '/commande')
    await guest.getByRole('checkbox', { name: /nouveautés et offres/ }).waitFor()
    const w = await pageWidth(guest)
    await guest.screenshot({ path: `${SHOTS}/202-qa-commande-390.png`, fullPage: true })
    log(w <= WIDTH, `Commande (panier rempli, 390 px) : page de ${w} px, pas plus large que l’écran`)
  })

  log(errors.length === 0, `Console : ${errors.length} erreur(s) JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
