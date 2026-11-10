import type { Ad } from '@/content/home'

/** Date du jour au format AAAA-MM-JJ, à l'heure de Dakar (UTC toute l'année) */
const today = () => new Date().toISOString().slice(0, 10)

/** Publicités à afficher aujourd'hui : visibles, dans leurs dates, et promotion pas épuisée */
export function currentAds(ads: readonly Ad[], day = today()): Ad[] {
  return ads.filter((a) =>
    a.visible !== false
    && (!a.startsAt || a.startsAt <= day)
    && (!a.endsAt || day <= a.endsAt)
    && a.promo?.remaining !== 0)
}
