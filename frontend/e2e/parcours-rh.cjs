/**
 * PARCOURS DE BOUT EN BOUT : Contrats et RH dans l'ERP (maquette validée le 26 novembre 2026).
 * 1. Liste : les 3 alertes de la démo (contrat non signé, fin d'essai, fin de CDD) et l'équipe.
 * 2. Fiche de Fatou (CDD qui finit) : « Passer en CDI » → le contrat devient un CDI.
 * 3. Mariama (apprentie) : ajouter le contrat signé (PDF) → l'alerte « Contrat non signé » disparaît.
 * 4. Nouveau contrat : la fin d'un CDD est exigée, 2 ans au plus (règle du serveur), puis enregistré.
 * 5. « Imprimer le contrat » : un PDF. Une caissière ne voit ni le menu ni les contrats.
 * Utilisation : API Laravel + site lancés (base fraîche), puis
 *   node e2e/parcours-rh.cjs ./captures
 */
const { chromium } = require('playwright')
const SHOTS = process.argv[2]
const BASE = 'http://localhost:5173'
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }
const text = async (l) => (await l.textContent()).replace(/[  ]/g, ' ')
const iso = (d) => d.toISOString().slice(0, 10)

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
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page, 'admin@dabohair.test', 'admin-dabo-2026')

  // 1. Liste
  await page.goto(BASE + '/admin')
  await page.getByRole('navigation', { name: 'Menu ERP' }).getByRole('link', { name: 'Contrats et RH' }).click()
  await page.getByRole('heading', { level: 1, name: 'Contrats et RH' }).waitFor()
  const alerts = page.getByRole('region', { name: 'À traiter' })
  await alerts.waitFor()
  const alertText = await text(alerts)
  log(alertText.includes('Contrat non signé') && alertText.includes('Fin de période d’essai') && alertText.includes('Fin de CDD dans 18 jours'), 'Liste : 3 alertes (non signé, fin d’essai, fin de CDD dans 18 jours)')
  const rows = page.locator('table tbody tr')
  log(await rows.count() === 4, `L’équipe : ${await rows.count()} contrats en cours`)
  await page.screenshot({ path: `${SHOTS}/98-rh-liste.png`, fullPage: true })

  // 2. Fatou : passer en CDI
  await alerts.getByRole('link', { name: /Ouvrir le contrat de Fatou Ndiaye/ }).click()
  await page.getByRole('heading', { level: 1, name: /Fatou Ndiaye/ }).waitFor()
  log(await page.getByRole('button', { name: 'Renouveler le CDD (1 fois)' }).count() === 1, 'Fiche de Fatou : « Passer en CDI », « Renouveler le CDD (1 fois) », « Terminer le contrat »')
  await page.screenshot({ path: `${SHOTS}/99-rh-fiche.png`, fullPage: true })
  await page.getByRole('button', { name: 'Passer en CDI' }).click()
  await page.getByRole('button', { name: 'Confirmer' }).click()
  await page.getByRole('status').filter({ hasText: 'Fatou passe en CDI.' }).waitFor()
  await page.getByRole('radio', { name: /^CDI/, checked: true }).waitFor({ state: 'attached' })
  log(await page.getByRole('heading', { name: 'Fin du contrat' }).count() === 1, 'Passer en CDI : le contrat est maintenant un CDI (plus de date de fin)')

  // 3. Mariama : le contrat signé
  await page.goto(BASE + '/admin/contrats')
  await page.getByRole('link', { name: /Ajouter le contrat signé de Mariama Diop/ }).click()
  await page.getByRole('heading', { level: 1, name: /Mariama Diop/ }).waitFor()
  await page.locator('input[type=file]').setInputFiles({ name: 'contrat-mariama.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF') })
  await page.getByRole('link', { name: /Contrat signé ·/ }).waitFor()
  await page.goto(BASE + '/admin/contrats')
  await page.getByRole('region', { name: 'À traiter' }).waitFor()
  const after = await text(page.getByRole('region', { name: 'À traiter' }))
  log(!after.includes('Mariama Diop'), 'Contrat signé ajouté : l’alerte « Contrat non signé » de Mariama disparaît')
  log(after.includes('Fatou Ndiaye, coiffeuse : le contrat signé'), 'Le nouveau CDI de Fatou est à faire signer : il apparaît dans les alertes')

  // 4. Nouveau contrat
  await page.getByRole('link', { name: 'Nouveau contrat' }).click()
  await page.getByLabel('Prénom *').fill('Aïda')
  await page.getByLabel('Nom *', { exact: true }).fill('Sy')
  await page.getByLabel('Téléphone').fill('77 222 33 44')
  await page.locator('label').filter({ hasText: /^CDD/ }).click()
  await page.getByLabel('Poste *').fill('Coiffeuse')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  log(await page.getByText('Indiquez la date de fin.').count() === 1, 'Nouveau CDD sans date de fin : « Indiquez la date de fin. »')
  const start = new Date()
  await page.getByLabel('Fin (CDD) *').fill(iso(new Date(start.getFullYear() + 3, start.getMonth(), 1)))
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByText('Un CDD dure 2 ans au plus (Code du travail, art. 100).').waitFor()
  log(true, 'CDD de 3 ans refusé par le serveur : « Un CDD dure 2 ans au plus (Code du travail, art. 100). »')
  await page.getByLabel('Fin (CDD) *').fill(iso(new Date(start.getFullYear(), start.getMonth() + 6, 1)))
  await page.getByLabel('Salaire fixe mensuel brut (F CFA)').fill('90000')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByRole('heading', { level: 1, name: 'Aïda Sy · Coiffeuse' }).waitFor()
  log(await page.getByRole('status').filter({ hasText: 'Contrat enregistré.' }).count() === 1, 'Nouveau contrat enregistré, fiche ouverte')

  // 5. Imprimer ; la caissière n'y a pas accès
  const href = await page.getByRole('link', { name: 'Imprimer le contrat' }).getAttribute('href')
  const pdf = await page.request.get(BASE + href, { headers: { Referer: BASE + '/admin' } })
  log(pdf.ok() && pdf.headers()['content-type'] === 'application/pdf', '« Imprimer le contrat » : un PDF')

  const xsrf = decodeURIComponent((await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN').value)
  const created = await page.request.post(`${BASE}/api/v1/admin/users`, { headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf, Referer: BASE + '/admin' },
    data: { first_name: 'Ndèye', last_name: 'Caisse', email: 'caisse-rh@dabohair.test', phone: null, role: 'cashier', password: 'caisse2026dabo' } })
  const cashier = await (await browser.newContext()).newPage()
  await login(cashier, 'caisse-rh@dabohair.test', 'caisse2026dabo')
  await cashier.goto(BASE + '/admin/commandes')
  await cashier.getByRole('navigation', { name: 'Menu ERP' }).waitFor()
  const api = await cashier.request.get(`${BASE}/api/v1/admin/hr/employees`, { headers: { Accept: 'application/json', Referer: BASE + '/admin' } })
  log(created.ok() && await cashier.getByRole('link', { name: 'Contrats et RH' }).count() === 0 && api.status() === 403, 'Caissière : pas de menu « Contrats et RH », API refusée (403)')

  log(errors.length === 0, `Console : ${errors.length} erreur(s) JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('FAIL exception', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
