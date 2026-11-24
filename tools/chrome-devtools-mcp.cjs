#!/usr/bin/env node
/**
 * Lanceur de Chrome DevTools MCP (outil officiel de l'équipe Chrome), déclaré dans .mcp.json.
 * Le même fichier sert partout :
 *  - session Claude Code dans le cloud (Linux) : utilise le Chromium déjà installé (/opt/pw-browsers/chromium), sans fenêtre ;
 *  - ordinateur Windows ou Mac avec Claude Code installé : utilise le Chrome de l'ordinateur.
 * Toujours : profil jetable (--isolated, jamais vos comptes ni mots de passe), aucune statistique envoyée
 * (--no-usage-statistics) et aucune adresse de page envoyée à Google pendant les analyses (--performanceCrux=false).
 * Version FIXÉE : on monte de version volontairement, après lecture des notes de version.
 */
const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')

const VERSION = '1.13.0'
// --performanceCrux=false : les analyses de performance n'envoient pas les adresses des pages à Google (CrUX)
const args = ['-y', `chrome-devtools-mcp@${VERSION}`, '--isolated', '--no-usage-statistics', '--performanceCrux=false']
const cloudChromium = '/opt/pw-browsers/chromium'
if (existsSync(cloudChromium)) {
  args.push('--headless', `--executablePath=${cloudChromium}`)
  // Le cloud lance tout en administrateur (root), et Chrome refuse alors de démarrer avec son « bac à sable ».
  // On l'enlève SEULEMENT ici : la machine du cloud est jetable et déjà isolée. Jamais sur un ordinateur personnel.
  if (process.getuid?.() === 0) args.push('--chromeArg=--no-sandbox')
}

// Sous Windows, npx est un script .cmd : il faut passer par le shell
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: process.platform === 'win32' })
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
