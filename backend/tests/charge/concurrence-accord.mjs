/**
 * CONCURRENCE : accord pour les offres (QA du 28 novembre 2026).
 * Un double clic (ou deux caisses en même temps) ne doit laisser QU'UNE preuve dans customer_consents.
 * ÉCHOUE tant que MarketingConsent::record() ne verrouille pas la fiche (lockForUpdate) avant de relire l'état.
 *
 * Lancer : base fraîche, puis le serveur multi-processus (comme concurrence.mjs) :
 *   cd backend/public && PHP_CLI_SERVER_WORKERS=8 API_RATE_LIMIT=100000 CHECKOUT_RATE_LIMIT=100000 \
 *     php -S 127.0.0.1:8001 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
 *   node backend/tests/charge/concurrence-accord.mjs
 * Les preuves sont comptées par la réponse de l'ERP (colonne « Offres par e-mail ») et par la commande artisan
 * lancée depuis backend/ (lecture seule).
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.API_URL ?? 'http://127.0.0.1:8001'
const FRONT = 'http://localhost:5173'
const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
let failures = 0
const check = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }

async function client() {
  const jar = new Map()
  const store = (res) => res.headers.getSetCookie().forEach((c) => { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) })
  const headers = () => ({
    Accept: 'application/json', 'Content-Type': 'application/json', Referer: FRONT + '/', Origin: FRONT,
    Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), 'X-XSRF-TOKEN': decodeURIComponent(jar.get('XSRF-TOKEN') ?? ''),
  })
  store(await fetch(BASE + '/sanctum/csrf-cookie', { headers: headers() }))
  return async (method, path, body) => {
    const res = await fetch(BASE + '/api/v1' + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined })
    store(res)
    return res.status
  }
}

const proofs = (customerId) => Number(execFileSync('php', ['artisan', 'tinker', `--execute=echo App\\Models\\CustomerConsent::where('customer_id', ${customerId})->count();`], { cwd: BACKEND }).toString().trim())

// Mariama (cliente de démo AVEC e-mail : l'accord aux offres par e-mail exige une adresse)
const mariamaId = Number(execFileSync('php', ['artisan', 'tinker', "--execute=echo App\\Models\\Customer::where('phone', '770000003')->value('id');"], { cwd: BACKEND }).toString().trim())

const admin = await client()
check(await admin('POST', '/auth/login', { email: 'admin@dabohair.test', password: 'admin-dabo-2026', remember: false }) === 200, 'Connexion de la gérante')
const salon = await Promise.all(Array.from({ length: 8 }, () => admin('POST', `/admin/customers/${mariamaId}/marketing-consent`)))
// Déjà accepté = réponse OK sans nouvelle preuve (un double clic ne doit pas afficher d'erreur à la caisse)
check(salon.every((s) => s === 200), `8 « Elle accepte » simultanés : toutes les réponses 200 (${salon.join(',')})`)
check(proofs(mariamaId) === 1, `8 « Elle accepte » simultanés : une seule preuve (${proofs(mariamaId)})`)

const mariama = await client()
check(await mariama('POST', '/auth/login', { email: 'mariama@client.test', password: 'demo-dabo-2026', remember: false }) === 200, 'Connexion de Mariama')
const before = proofs(mariamaId)
await Promise.all(Array.from({ length: 8 }, () => mariama('PATCH', '/me/preferences', { marketing_email: false })))
check(proofs(mariamaId) - before === 1, `8 retraits « Nouveautés et offres » simultanés : une seule preuve (${proofs(mariamaId) - before})`)

process.exit(failures ? 1 : 0)
