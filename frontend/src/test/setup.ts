// Ajoute des vérifications lisibles aux tests : expect(element).toBeInTheDocument(), toBeDisabled()…
import '@testing-library/jest-dom/vitest'

/**
 * Node 25 et suivants exposent leur PROPRE localStorage global. Sans l'option --localstorage-file,
 * il est inutilisable (pas de setItem) et masque celui du navigateur simulé (jsdom) : le panier,
 * qui se mémorise dans localStorage, ne fonctionnait plus dans les tests.
 * On installe alors un stockage en mémoire, avec la même interface (Web Storage).
 * Sans effet dans un vrai navigateur ni avec Node 22 : uniquement pour les tests.
 */
class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, String(value)) }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const storage = (() => { try { return globalThis[name] } catch { return undefined } })()
  if (typeof storage?.setItem !== 'function') {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true })
  }
}
