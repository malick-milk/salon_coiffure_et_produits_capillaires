/**
 * TEST DE CONCURRENCE ET DE CHARGE (étape 9) — de VRAIES requêtes HTTP envoyées EN MÊME TEMPS.
 *
 * Les tests PHPUnit envoient les requêtes l'une après l'autre : ils ne prouvent pas que les verrous
 * de la base (lockForUpdate, index unique) tiennent quand 30 clientes cliquent à la même seconde.
 * Ce script le prouve, contre un serveur PHP à plusieurs processus.
 *
 * 1. Base propre :          cd backend && php artisan migrate:fresh --seed
 * 2. Serveur multi-processus, lancé DEPUIS backend/public (Linux / macOS ; sous Windows le serveur PHP n'a qu'un processus) :
 *    cd public && PHP_CLI_SERVER_WORKERS=8 API_RATE_LIMIT=100000 CHECKOUT_RATE_LIMIT=100000 \
 *      php -S 127.0.0.1:8001 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
 *    (les limites anti-abus sont relevées POUR CE SERVEUR LOCAL UNIQUEMENT : toutes les requêtes viennent de la même adresse)
 * 3. node tests/charge/concurrence.mjs
 *
 * Scénarios :
 *   A. 30 réservations simultanées du MÊME créneau, chez la même coiffeuse -> exactement 1 acceptée, 29 refusées (409)
 *   B. 40 commandes simultanées d'un produit dont il reste 24 unités      -> exactement 24 acceptées, stock final 0, jamais négatif
 *   C. Références uniques (pas deux CMD-… identiques), grand livre cohérent
 *   D. Charge de lecture : 300 consultations du catalogue, 30 en parallèle -> 0 erreur, temps de réponse mesurés
 */
const BASE = process.env.API_URL ?? 'http://127.0.0.1:8001'
const FRONT = 'http://localhost:5173' // origine « de confiance » pour Sanctum (SANCTUM_STATEFUL_DOMAINS)
let failures = 0
const check = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`) }

/** Un client = son propre jeu de cookies (session + jeton CSRF), comme un navigateur différent */
async function client() {
  const jar = new Map()
  const store = (res) => res.headers.getSetCookie().forEach((c) => { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) })
  const headers = () => ({
    Accept: 'application/json', 'Content-Type': 'application/json', Referer: FRONT + '/', Origin: FRONT,
    Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), 'X-XSRF-TOKEN': decodeURIComponent(jar.get('XSRF-TOKEN') ?? ''),
  })
  store(await fetch(BASE + '/sanctum/csrf-cookie', { headers: headers() }))
  const call = async (method, path, body) => {
    const res = await fetch(BASE + '/api/v1' + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined })
    store(res)
    return { status: res.status, body: await res.json().catch(() => null) }
  }
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b) }
}

const phone = (i) => `77${String(5000000 + i).padStart(7, '0')}` // numéros fictifs distincts
const customer = (i) => ({ first_name: 'Cliente', last_name: `Test${i}`, phone: phone(i), email: null })
const count = (results, status) => results.filter((r) => r.status === status).length

async function main() {
  const probe = await fetch(BASE + '/api/v1/products').catch(() => null)
  if (!probe?.ok) {
    console.error(`Serveur injoignable sur ${BASE}. Lancez-le d'abord (voir l'en-tête de ce fichier).`)
    process.exit(1)
  }
  const visitor = await client()

  // ---------- A. Le même créneau, 30 fois en même temps ----------
  const services = (await visitor.get('/services')).body.data
  const stylists = (await visitor.get('/stylists')).body.data
  const service = services.find((s) => s.slug === 'twist-simple') ?? services[0]
  const fatou = stylists[0] // une seule coiffeuse dans le vrai salon
  let slot = null
  for (let d = 2; d < 30 && !slot; d++) {
    const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)
    const day = (await visitor.get(`/availability?service_id=${service.id}&stylist_id=${fatou.id}&date=${date}`)).body.data
    const free = day?.slots?.find((s) => s.available)
    if (free) slot = { date, time: free.time }
  }
  check(slot !== null, `Créneau libre trouvé : ${slot?.date} à ${slot?.time}, ${service.name} avec ${fatou.display_name}`)

  const bookers = await Promise.all(Array.from({ length: 30 }, () => client()))
  const bookings = await Promise.all(bookers.map((c, i) => c.post('/bookings', {
    service_id: service.id, stylist_id: fatou.id, date: slot.date, time: slot.time, customer: customer(i), notes: null, consent: true,
  })))
  check(count(bookings, 201) === 1 && count(bookings, 409) === 29,
    `A. 30 réservations simultanées du même créneau : ${count(bookings, 201)} acceptée, ${count(bookings, 409)} refusées (409)${bookings.some((b) => ![201, 409].includes(b.status)) ? ' ; autres : ' + bookings.filter((b) => ![201, 409].includes(b.status)).map((b) => b.status).join(',') : ''}`)
  const after = (await visitor.get(`/availability?service_id=${service.id}&stylist_id=${fatou.id}&date=${slot.date}`)).body.data
  check(after.slots.find((s) => s.time === slot.time)?.available === false, 'A. Le créneau n’est plus proposé')

  // ---------- B. Les dernières unités en stock ----------
  const products = (await visitor.get('/products?per_page=50')).body.data
  const masque = products.find((p) => p.name.startsWith('Masque'))
  const buyers = await Promise.all(Array.from({ length: 40 }, () => client()))
  const t0 = performance.now()
  const orders = await Promise.all(buyers.map((c, i) => c.post('/orders', {
    items: [{ product_id: masque.id, quantity: 1 }], fulfillment_method: 'pickup', customer: customer(100 + i), consent: true,
  })))
  const elapsed = Math.round(performance.now() - t0)
  check(count(orders, 201) === 24 && count(orders, 409) === 16,
    `B. 40 commandes simultanées pour 24 masques : ${count(orders, 201)} acceptées, ${count(orders, 409)} refusées « stock insuffisant » (${elapsed} ms)`)

  // ---------- C. Cohérence, vérifiée avec le compte du propriétaire ----------
  const refs = orders.filter((o) => o.status === 201).map((o) => o.body.data.reference)
  check(new Set(refs).size === refs.length, `C. ${refs.length} références de commande toutes différentes`)
  const admin = await client()
  const login = await admin.post('/auth/login', { email: 'admin@dabohair.test', password: 'admin-dabo-2026', remember: false })
  check(login.status === 200, 'C. Connexion du propriétaire')
  const row = (await admin.get('/admin/products')).body.data.find((p) => p.id === masque.id)
  check(row.stock_quantity === 0, `C. Stock final du masque : ${row.stock_quantity} (attendu 0, jamais négatif)`)
  const ledger = (await admin.get(`/admin/products/${masque.id}/movements`)).body.data
  const sales = ledger.filter((m) => m.type === 'sale' && m.quantity === -1) // les ventes de CE test (la vente en gros de mars est aussi au grand livre)
  check(sales.length === 24 && ledger.every((m) => m.stock_after >= 0), `C. Grand livre : ${sales.length} ventes, aucun solde négatif`)
  const afters = sales.map((m) => m.stock_after).sort((a, b) => a - b)
  check(afters.every((v, i) => v === i), 'C. Soldes successifs 23, 22, … 0 : chaque vente a vu le stock à jour (verrou efficace)')

  // ---------- D. Charge de lecture ----------
  const durations = []
  let errors = 0
  const queue = Array.from({ length: 300 }, (_, i) => i)
  const worker = async () => {
    while (queue.length) {
      queue.pop()
      const t = performance.now()
      const res = await fetch(BASE + '/api/v1/products?per_page=12', { headers: { Accept: 'application/json' } })
      durations.push(performance.now() - t)
      if (!res.ok) errors++
      await res.arrayBuffer()
    }
  }
  const start = performance.now()
  await Promise.all(Array.from({ length: 30 }, worker))
  const total = (performance.now() - start) / 1000
  durations.sort((a, b) => a - b)
  const p = (q) => Math.round(durations[Math.floor(q * (durations.length - 1))])
  check(errors === 0, `D. 300 lectures du catalogue (30 en parallèle) : ${errors} erreur, ${Math.round(300 / total)} req/s, médiane ${p(0.5)} ms, 95 % sous ${p(0.95)} ms`)

  console.log(failures ? `\n${failures} échec(s)` : '\nTous les scénarios de concurrence sont réussis.')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
