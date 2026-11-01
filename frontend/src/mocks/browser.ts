import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/** Le « service worker » MSW s'installe dans le navigateur et intercepte les appels /api */
export const worker = setupWorker(...handlers)
