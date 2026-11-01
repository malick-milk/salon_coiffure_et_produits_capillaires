/**
 * Point d'entrée de l'application.
 * 1. Démarre le faux serveur MSW si VITE_ENABLE_MOCKS=true (développement sans Laravel).
 * 2. Monte React dans <div id="root">.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'

async function enableMocks() {
  // import.meta.env.DEV vaut false dans un build de production : Vite supprime alors tout ce bloc
  // (élimination du code mort). Le faux serveur ne peut donc JAMAIS partir en production,
  // même si un fichier .env.local contient VITE_ENABLE_MOCKS=true.
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  // import() dynamique : le code de MSW n'est téléchargé QUE si les mocks sont activés
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}

enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
