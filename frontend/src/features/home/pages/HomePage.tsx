/** PAGE D'ACCUEIL : hero, engagements, bannière promo, produits phares, prestations, horaires */
import { ArrowRight, CalendarDays, Check, Clock, MapPin, Phone, Scissors, ShoppingBag, Truck } from 'lucide-react'
import { Link } from 'react-router'
import { ImagePlaceholder } from '@/components/common/Placeholder'
import { Seo } from '@/components/common/Seo'
import { Eyebrow, QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { homeContent } from '@/content/home'
import { salon, salonMapsUrl } from '@/content/salon'
import { useBusinessHours, useServices } from '@/features/booking/hooks'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { useProducts } from '@/features/catalog/hooks'
import { ReviewsSection } from '@/features/reviews/components/ReviewsSection'
import { formatDuration, formatPrice } from '@/lib/format'
import { apiErrorMessage } from '@/lib/http'
import type { BusinessHour } from '@/types/api'

// Une icône par engagement (dans l'ordre de homeContent.commitments)
const COMMITMENT_ICONS = [CalendarDays, ShoppingBag, Truck, Check]
const { hero, promoBanner: promo } = homeContent

function PromoBanner({ image, alt, link }: { image: string; alt: string; link: string | null }) {
  const img = <img src={image} alt={alt} width={1280} height={320} loading="lazy" className="mx-auto w-full max-w-7xl rounded-3xl object-cover" />
  return link ? <Link to={link} className="block">{img}</Link> : img
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** "09:00" + pause "13:00-14:00" -> "09:00 – 13:00 · 14:00 – 19:00" */
function hoursLabel(h: BusinessHour): string {
  if (h.is_closed || !h.opens_at || !h.closes_at) return 'Fermé'
  if (h.break_start && h.break_end) return `${h.opens_at} – ${h.break_start} · ${h.break_end} – ${h.closes_at}`
  return `${h.opens_at} – ${h.closes_at}`
}

export function HomePage() {
  const featured = useProducts({ featured: true, sort: 'newest' })
  const services = useServices()
  const hours = useBusinessHours()

  return (
    <>
      <Seo title="Salon de coiffure et soins capillaires" description="Soins capillaires Dabo Hair fabriqués par nos soins et réservation en ligne au salon, à Dakar." />
      {/* Fiche « commerce local » lue par Google : adresse, téléphone, horaires (aide à apparaître dans les recherches « salon Dakar ») */}
      <script type="application/ld+json">{JSON.stringify({
        '@context': 'https://schema.org', '@type': 'HairSalon', name: salon.name, telephone: salon.phoneE164,
        address: { '@type': 'PostalAddress', streetAddress: salon.address, addressLocality: salon.city, addressCountry: 'SN' },
        openingHours: 'Mo-Su 09:00-19:00',
      })}</script>

      <section className="px-4 pt-14 pb-20 sm:px-6 sm:pt-[72px]">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-col gap-7 motion-safe:animate-fade-up">
            <Eyebrow>{hero.eyebrow}</Eyebrow>
            <h1 className="font-display text-[40px] leading-[1.05] font-semibold sm:text-6xl">{hero.title}</h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted">{hero.subtitle}</p>
            <div className="flex flex-wrap gap-3.5">
              <Button asChild className="min-h-[52px]"><Link to="/reserver">{hero.primaryButton} <ArrowRight aria-hidden="true" /></Link></Button>
              <Button asChild variant="outline" className="min-h-[52px]"><Link to="/boutique">{hero.secondaryButton}</Link></Button>
            </div>
          </div>
          {hero.image ? (
            // Image la plus visible de la page : chargée en priorité (fetchPriority) et jamais en différé.
            // width/height réservent la place avant le chargement : la page ne « saute » pas.
            <img src={hero.image} alt={hero.imageAlt} width={1200} height={1400} fetchPriority="high"
              className="aspect-[6/7] max-h-[620px] w-full flex-1 rounded-3xl object-cover lg:w-auto" />
          ) : (
            <ImagePlaceholder label="Image hero" hint="1200 × 1400 px · à déposer dans public/images, puis src/content/home.ts" className="aspect-[6/7] max-h-[620px] flex-1 rounded-3xl" />
          )}
        </div>
      </section>

      <section aria-label="Nos engagements" className="border-y border-ink-line px-4 py-7 sm:px-6">
        <ul className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {homeContent.commitments.map((label, i) => {
            const Icon = COMMITMENT_ICONS[i] ?? Check // un 5e engagement ajouté prend l’icône « coche »
            return (
              <li key={label} className="flex items-center gap-3.5 text-[15px]">
                <Icon className="size-7 text-gold" aria-hidden="true" />
                {label}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="px-4 pt-[72px] sm:px-6">
        {promo.image ? (
          <PromoBanner image={promo.image} alt={promo.imageAlt} link={promo.link} />
        ) : (
          <ImagePlaceholder label="Bannière promotionnelle" hint="1280 × 320 px · à déposer dans public/images, puis src/content/home.ts" className="mx-auto min-h-56 max-w-7xl rounded-3xl border-gold-dark bg-gold-soft text-gold" />
        )}
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-9">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <Eyebrow>Fabrication maison</Eyebrow>
              <h2 className="font-display text-4xl font-semibold">Produits phares</h2>
            </div>
            <Link to="/boutique" className="inline-flex min-h-11 items-center gap-2 font-semibold text-gold">
              Voir toute la boutique <ArrowRight className="size-[18px]" aria-hidden="true" />
            </Link>
          </div>
          {featured.isError ? (
            <QueryError message={apiErrorMessage(featured.error)} onRetry={() => featured.refetch()} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {featured.isPending
                ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[4/6]" />)
                : featured.data.data.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      <section id="prestations" className="scroll-mt-24 bg-ivory px-4 py-20 text-ink sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-9">
          <div className="flex max-w-2xl flex-col gap-2.5">
            <Eyebrow light>Le salon</Eyebrow>
            <h2 className="font-display text-4xl font-semibold">Nos prestations</h2>
            <p className="text-[17px] leading-relaxed text-[#3f3f46]">Durée et prix affichés à l'avance. Réservez en ligne avec Awa Dabo, tous les jours de 9 h à 19 h. Twists uniquement sur vos propres cheveux, sans mèches.</p>
          </div>
          {services.isError ? (
            <QueryError message={apiErrorMessage(services.error)} onRetry={() => services.refetch()} />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {services.isPending
                ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-64 bg-[#e4e4e7]" />)
                : services.data.map((s) => (
                    <article key={s.id} className="flex flex-col gap-3.5 rounded-2xl border border-[#e4e4e7] bg-white p-7">
                      <span className="flex size-[52px] items-center justify-center rounded-[14px] bg-ink text-gold"><Scissors className="size-6" aria-hidden="true" /></span>
                      <p className="text-[13px] font-medium text-[#52525b]">{s.category}</p>
                      <h3 className="font-display text-2xl font-semibold">{s.name}</h3>
                      {s.description && <p className="text-[15px] leading-relaxed text-[#3f3f46]">{s.description}</p>}
                      {/* mt-auto : durée, prix et bouton collés au bas de la carte, alignés d'une carte à l'autre
                          quelle que soit la longueur de la description */}
                      <p className="mt-auto flex gap-5 pt-1 text-[15px] text-[#3f3f46]">
                        <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden="true" />{formatDuration(s.duration_minutes)}</span>
                        <strong className="text-ink">{formatPrice(s.price)}</strong>
                      </p>
                      <Button asChild variant="dark"><Link to="/reserver">Réserver</Link></Button>
                    </article>
                  ))}
            </div>
          )}
        </div>
      </section>

      <ReviewsSection />

      <section id="salon" className="scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:flex-row">
          <div className="flex flex-1 flex-col gap-6">
            <h2 className="font-display text-4xl font-semibold">Horaires d'ouverture</h2>
            {hours.data ? (
              <table className="w-full border-collapse text-base">
                <caption className="pb-3 text-left text-sm text-muted">Fermetures exceptionnelles annoncées sur cette page.</caption>
                <tbody>
                  {hours.data.map((h) => (
                    <tr key={h.day_of_week} className="border-b border-ink-line">
                      <th scope="row" className="py-3.5 text-left font-medium">{DAYS[h.day_of_week - 1]}</th>
                      <td className={`py-3.5 text-right ${h.is_closed ? 'text-[#a3a3a3]' : ''}`}>{hoursLabel(h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Skeleton className="h-72" />
            )}
            <ul className="flex flex-col gap-3.5 text-[#d9d9d9]">
              <li className="flex items-start gap-3"><MapPin className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
                <a href={salonMapsUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">{salon.address}, {salon.city}</a></li>
              <li className="flex items-center gap-3"><Phone className="size-5 text-gold" aria-hidden="true" /><a href={`tel:${salon.phoneE164}`} className="underline-offset-4 hover:underline">{salon.phoneDisplay}</a></li>
            </ul>
          </div>
          <ImagePlaceholder label="Carte ou photo du salon" className="min-h-[380px] flex-1 rounded-3xl" />
        </div>
      </section>
    </>
  )
}
