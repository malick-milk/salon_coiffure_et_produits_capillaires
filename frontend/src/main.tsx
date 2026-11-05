/**
 * Point d'entrée de l'application.
 * 1. Démarre le faux serveur MSW si VITE_ENABLE_MOCKS=true (développement sans Laravel).
 * 2. Monte React dans <div id="root">.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
// Polices hébergées SUR NOTRE SERVEUR (étape 11) et non chez Google Fonts : aucune adresse IP de visiteur
// envoyée à un tiers (données personnelles), une connexion réseau de moins depuis Dakar, et une politique
// de sécurité (CSP) qui n'autorise que notre propre domaine.
import '@fontsource-variable/inter'
import '@fontsource/playfair-display/500.css'
import '@fontsource/playfair-display/600.css'
import '@fontsource/playfair-display/700.css'
import './index.css'

async function enableMocks() {
  // import.meta.env.DEV vaut false dans un build de production : Vite supprime alors tout ce bloc
  // (élimination du code mort). Le faux serveur ne peut donc JAMAIS partir en production,
  // même si un fichier .env.local contient VITE_ENABLE_MOCKS=true.
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  // import() dynamique : le code de MSW n'est téléchargé QUE si les mocks sont activés
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  showMockBadge()
}

/** Pastille visible en permanence : impossible d'oublier que l'on parle au faux serveur et non à Laravel */
function showMockBadge() {
  const badge = document.createElement('div')
  badge.textContent = 'Faux serveur (MSW) actif — pour Laravel et l’ERP : VITE_ENABLE_MOCKS=false'
  badge.setAttribute('role', 'status')
  badge.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;padding:6px 10px;border-radius:8px;background:#7a5a00;color:#fff;font:600 12px/1.3 system-ui,sans-serif;max-width:calc(100vw - 16px);pointer-events:none'
  document.body.appendChild(badge)
}

enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
