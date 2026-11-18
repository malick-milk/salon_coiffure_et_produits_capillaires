/**
 * Exporte chaque maquette HTML d'un dossier en image PNG, à la taille exacte de la maquette.
 *
 *   node marketing/outils/exporter.cjs <dossier des sources> <dossier des images> [début du nom]
 *   ex. : node marketing/outils/exporter.cjs marketing/sources/lancement marketing/lancement 04-
 *
 * La taille vient de la maquette elle-même (le premier bloc de la page : 1080 × 1350, 1080 × 1920…).
 * Le script attend les polices et les photos, puis signale toute image cassée au lieu d'exporter une image vide.
 * Besoin de Playwright (déjà là pour les parcours e2e : npm install --no-save playwright dans frontend/).
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

;(async () => {
  const [src, out, prefix = ''] = process.argv.slice(2)
  if (!src || !out) {
    console.error('Usage : node marketing/outils/exporter.cjs <sources> <images> [début du nom]')
    process.exit(1)
  }
  fs.mkdirSync(out, { recursive: true })
  const files = fs.readdirSync(src).filter((f) => f.endsWith('.html') && f.startsWith(prefix)).sort()
  const browser = await chromium.launch()
  let failed = 0
  for (const file of files) {
    const page = await browser.newPage({ viewport: { width: 2200, height: 2000 }, deviceScaleFactor: 1 })
    await page.goto('file://' + path.resolve(src, file))
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')))
    const box = await page.evaluate(() => {
      const r = document.body.firstElementChild.getBoundingClientRect()
      return { x: 0, y: 0, width: Math.round(r.width), height: Math.round(r.height) }
    })
    if (broken.length) {
      failed++
      console.error(`ÉCHEC ${file} : image introuvable ${broken.join(', ')}`)
    } else {
      await page.screenshot({ path: path.join(out, file.replace(/\.html$/, '.png')), clip: box })
      console.log(`${file.replace(/\.html$/, '.png')}  ${box.width} × ${box.height}`)
    }
    await page.close()
  }
  await browser.close()
  process.exit(failed ? 1 : 0)
})()
