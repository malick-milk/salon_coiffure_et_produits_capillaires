/**
 * TÉLÉCHARGER UN FICHIER PROTÉGÉ (PDF du contrat, pièce d'un dossier…).
 *
 * Pourquoi pas un simple lien <a href target="_blank"> ? Sanctum ne reconnaît le cookie de session que si la
 * requête dit d'où elle vient (en-tête Referer). Un lien ouvert dans un nouvel onglet avec rel="noreferrer"
 * ne l'envoie pas : l'API répondait « Non authentifié » (bug du 26 novembre 2026). On passe donc par axios
 * (même session, mêmes en-têtes que le reste de l'ERP), puis on enregistre le fichier reçu.
 */
import { http } from './http'

/** Nom du fichier annoncé par le serveur (Content-Disposition), sinon le nom par défaut */
export function fileNameFrom(disposition: string | undefined | null, fallback: string): string {
  if (!disposition) return fallback
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8?.[1]) return decodeURIComponent(utf8[1].trim())
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain?.[1]?.trim() || fallback
}

/** Télécharge `url` (relative à /api/v1) et l'enregistre dans le dossier Téléchargements */
export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const res = await http.get<Blob>(url, { responseType: 'blob' })
  const objectUrl = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = fileNameFrom(res.headers['content-disposition'] as string | undefined, fallbackName)
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}
